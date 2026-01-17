import { Hono } from "hono";
import { readFile } from "fs/promises";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { streamSSE } from "hono/streaming";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { randomUUID } from "crypto";
import { findRoot } from "./workspace";
import { getDb, runMigrations } from "./db";
import { extractTextFromPDF } from "./lib/pdf-parser";
import {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany
} from "./db/companies";
import {
  getAllRoles,
  getRoleById,
  updateRole,
  updateRoleJd,
  getRoleWithDetails,
  deleteRole,
} from "./db/roles";
import {
  getOrCreateResearch,
  getResearchByRoleId,
  updateResearch,
} from "./db/research";
import {
  getCandidateContext,
  createCandidateContext,
  updateCandidateContext,
} from "./db/candidate_context";
import {
  scrapeLinkedInProfile,
  scrapePortfolioSite,
  buildCandidateContext,
} from "./llm/context-builder";
import {
  getInterviewsByApplication,
  getInterviewById,
  createInterview,
  updateInterview,
  deleteInterview,
} from "./db/interviews";
import {
  generateAuthUrl,
  exchangeCodeForTokens,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  isCalendarConfigured,
  isCalendarConnected,
} from "./integrations/google-calendar";
import {
  getAllApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  getApplicationsByStatus,
  getPipelineStats,
  getApplicationByRoleId,
} from "./db/applications";
import {
  getAllTasks,
  updateTask,
  createTask,
  getPendingTasks,
} from "./db/tasks";
import {
  getQuestionsByRoleId,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from "./db/application_questions";
import { applyToRole } from "./commands/apply";
import { addRole, refreshRole } from "./commands/add";
import type { AddRoleOptions } from "./commands/add";
import { initWorkspace } from "./commands/init";
import { generateCoverLetterStream } from "./llm/gemini";
import { generateCompanyResearch } from "./llm/research";
import { researchCompany } from "./llm/company-research";
import { generateJson, generateText } from "./llm/provider-client";
import {
  loadConfig,
  loadSecrets,
  requireLlmApiKey,
  resolveLlmApiKey,
  type LlmProvider,
} from "./config";
import {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  initUserProfileTable,
} from "./db/user_profile";
import type { UserProfile } from "./db/user_profile";
import type { User } from "./db/users";
import { getOrCreateUserFromGoogleProfile, getUserById } from "./db/users";
import { createSession, deleteExpiredSessions, deleteSession, getSessionById } from "./db/sessions";
import {
  exchangeCodeForGoogleProfile,
  generateGoogleAuthUrl,
  isGoogleAuthConfigured,
} from "./integrations/google-auth";

type AppVariables = {
  authUser?: User;
};

const app = new Hono<{ Variables: AppVariables }>();

let migrationsChecked = false;

async function ensureMigrations(): Promise<void> {
  if (migrationsChecked) {
    return;
  }

  await runMigrations(getDb());
  migrationsChecked = true;
}

async function ensureWorkspaceRoot(): Promise<string> {
  const root = findRoot(undefined, { throwOnMissing: false });
  if (root) {
    await ensureMigrations();
    return root;
  }

  initWorkspace();

  const initializedRoot = findRoot(undefined, { throwOnMissing: false });
  if (initializedRoot) {
    await ensureMigrations();
    return initializedRoot;
  }

  throw new Error("No jobsearch workspace found. Run `jobsearch init` first.");
}


function resolveLlmCredentials(
  root: string
): { provider?: LlmProvider; model?: string; apiKey?: string; error?: string } {
  try {
    const config = loadConfig(root);
    const apiKey = requireLlmApiKey(config.llm.provider, loadSecrets());
    return { provider: config.llm.provider, model: config.llm.model, apiKey };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "LLM provider not configured",
    };
  }
}

function getOptionalLlmCredentials(
  root: string
): { provider: LlmProvider; model: string; apiKey?: string } | null {
  try {
    const config = loadConfig(root);
    const { apiKey } = resolveLlmApiKey(config.llm.provider, loadSecrets());
    return { provider: config.llm.provider, model: config.llm.model, apiKey };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const SESSION_COOKIE_NAME = "jobsearch_session";
const SESSION_TTL_DAYS = 30;
const AUTH_REDIRECT_COOKIE_NAME = "auth_redirect";

function getSessionExpiry(): string {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
  return expiresAt.toISOString();
}

function setSessionCookie(responseContext: Parameters<typeof setCookie>[0], sessionId: string, expiresAt: string) {
  setCookie(responseContext, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

function clearSessionCookie(responseContext: Parameters<typeof deleteCookie>[0]) {
  deleteCookie(responseContext, SESSION_COOKIE_NAME, { path: "/" });
}

function resolveRedirectOrigin(candidate?: string | null): string | null {
  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

async function getAuthenticatedUser(responseContext: Parameters<typeof getCookie>[0]): Promise<User | null> {
  const sessionId = getCookie(responseContext, SESSION_COOKIE_NAME);
  if (!sessionId) {
    return null;
  }

  const db = getDb();
  const session = await getSessionById(db, sessionId);
  if (!session) {
    return null;
  }

  if (new Date(session.expires_at) <= new Date()) {
    await deleteSession(db, session.id);
    return null;
  }

  const user = await getUserById(db, session.user_id);
  if (!user) {
    await deleteSession(db, session.id);
    return null;
  }

  return user;
}

async function claimUnownedData(db: ReturnType<typeof getDb>, userId: string): Promise<void> {
  const tables = [
    "companies",
    "roles",
    "applications",
    "contacts",
    "interviews",
    "artifacts",
    "tasks",
    "events",
    "role_research",
    "application_questions",
    "user_profile",
  ];

  for (const table of tables) {
    await db.unsafe(`UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`, [userId]);
  }
}

app.use("*", cors());

app.use("/api/*", async (c, next) => {
  const path = c.req.path;
  if (path === "/api/health" || path === "/api/doctor" || path.startsWith("/api/auth/")) {
    await next();
    return;
  }

  await ensureWorkspaceRoot();
  await deleteExpiredSessions(getDb());

  const user = await getAuthenticatedUser(c);
  if (!user) {
    clearSessionCookie(c);
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("authUser", user);
  await next();
});

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.get("/api/doctor", async (c) => {
  const checks: Array<{ name: string; status: "ok" | "error"; message: string }> = [];
  let root: string | null = null;

  try {
    root = await ensureWorkspaceRoot();
    checks.push({ name: "Workspace", status: "ok", message: `Workspace found at ${root}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workspace not initialized";
    checks.push({ name: "Workspace", status: "error", message });
    return c.json({ checks, allOk: false });
  }

  try {
    const db = getDb();
    await db.unsafe("SELECT 1");
    checks.push({ name: "Database", status: "ok", message: "Connected" });
  } catch {
    checks.push({ name: "Database", status: "error", message: "Database connection failed" });
  }

  if (root) {
    const { apiKey, error, provider, model } = resolveLlmCredentials(root);
    if (apiKey && provider && model) {
      checks.push({ name: "LLM", status: "ok", message: `${provider} configured` });
    } else {
      checks.push({ name: "LLM", status: "error", message: error ?? "LLM provider not configured" });
    }
  }

  const allOk = checks.every((check) => check.status === "ok");
  return c.json({ checks, allOk });
});

app.get("/api/auth/session", async (c) => {
  await ensureWorkspaceRoot();
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ authenticated: false });
  }

  return c.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
    },
  });
});

app.get("/api/auth/google/authorize", async (c) => {
  await ensureWorkspaceRoot();
  const secrets = loadSecrets();
  if (!isGoogleAuthConfigured(secrets)) {
    return c.json({ error: "Google OAuth not configured" }, 400);
  }

  const state = randomUUID();
  setCookie(c, "google_oauth_state", state, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  const redirectOrigin =
    resolveRedirectOrigin(c.req.query("redirect")) ??
    resolveRedirectOrigin(c.req.header("origin")) ??
    resolveRedirectOrigin(c.req.header("referer"));

  if (redirectOrigin) {
    setCookie(c, AUTH_REDIRECT_COOKIE_NAME, redirectOrigin, {
      httpOnly: true,
      sameSite: "Lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
  }

  const url = generateGoogleAuthUrl(secrets, state);
  return c.json({ url });
});

app.get("/api/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const expectedState = getCookie(c, "google_oauth_state");

  if (!code) {
    return c.html("<html><body><h1>Error</h1><p>No authorization code received.</p></body></html>");
  }

  if (!state || !expectedState || state !== expectedState) {
    return c.html("<html><body><h1>Error</h1><p>Invalid OAuth state.</p></body></html>");
  }

  deleteCookie(c, "google_oauth_state", { path: "/" });

  const redirectOriginCookie = getCookie(c, AUTH_REDIRECT_COOKIE_NAME);
  if (redirectOriginCookie) {
    deleteCookie(c, AUTH_REDIRECT_COOKIE_NAME, { path: "/" });
  }
  const redirectOrigin = resolveRedirectOrigin(redirectOriginCookie);

  await ensureWorkspaceRoot();
  const db = getDb();
  const secrets = loadSecrets();

  if (!isGoogleAuthConfigured(secrets)) {
    return c.html("<html><body><h1>Error</h1><p>Google OAuth not configured.</p></body></html>");
  }

  try {
    const profile = await exchangeCodeForGoogleProfile(secrets, code);
    const user = await getOrCreateUserFromGoogleProfile(db, profile);

    await claimUnownedData(db, user.id);

    const existingProfile = await getUserProfile(db, user.id);
    if (!existingProfile) {
      await createUserProfile(db, user.id, {
        full_name: user.name ?? null,
        email: user.email ?? null,
      });
    }

    const expiresAt = getSessionExpiry();
    const session = await createSession(db, user.id, expiresAt);
    setSessionCookie(c, session.id, expiresAt);

    const redirectTarget = redirectOrigin ? `${redirectOrigin}/dashboard` : "/";
    return c.redirect(redirectTarget);
  } catch (error) {
    console.error("OAuth callback error:", error);
    return c.html(`<html><body><h1>Error</h1><p>${error}</p></body></html>`);
  }
});

app.post("/api/auth/logout", async (c) => {
  await ensureWorkspaceRoot();
  const db = getDb();
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionId) {
    await deleteSession(db, sessionId);
  }
  clearSessionCookie(c);
  return c.json({ success: true });
});

app.get("/api/profile", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb();
  let profile = await getUserProfile(db, authUser.id);
  if (!profile) {
    profile = await createUserProfile(db, authUser.id, {
      full_name: authUser.name ?? null,
      email: authUser.email ?? null,
    });
  }

  return c.json(profile);
});

app.put("/api/profile/:id", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb();
  const profile = await getUserProfile(db, authUser.id);
  if (!profile || profile.id !== c.req.param("id")) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const body = await c.req.json<Partial<UserProfile>>();
  const normalizeField = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };

  const updates = {
    full_name: normalizeField(body.full_name),
    email: normalizeField(body.email),
    phone: normalizeField(body.phone),
    linkedin_url: normalizeField(body.linkedin_url),
    portfolio_url: normalizeField(body.portfolio_url),
    about_me: normalizeField(body.about_me),
    why_looking: normalizeField(body.why_looking),
    building_teams: normalizeField(body.building_teams),
    ai_shift: normalizeField(body.ai_shift),
    experience_json: normalizeField(body.experience_json),
  };

  const updated = await updateUserProfile(db, profile.id, updates);
  return c.json(updated);
});

app.post("/api/profile/:id/resume", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb();
  const profile = await getUserProfile(db, authUser.id);
  if (!profile || profile.id !== c.req.param("id")) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const formData = await c.req.raw.formData();
  const entry = formData.get("file") ?? formData.get("resume");
  if (!entry || typeof entry === "string") {
    return c.json({ error: "Resume file is required" }, 400);
  }

  const filename = entry.name || "resume";
  const extension = filename.split(".").pop()?.toLowerCase();
  let resumeText: string;

  if (extension === "pdf") {
    try {
      const buffer = Buffer.from(await entry.arrayBuffer());
      resumeText = await extractTextFromPDF(buffer);
    } catch (error) {
      console.error("Resume PDF parse failed:", error);
      return c.json({ error: "Failed to parse PDF resume" }, 400);
    }
  } else if (extension === "txt") {
    resumeText = await entry.text();
  } else {
    return c.json({ error: "Unsupported file type. Upload a PDF or TXT." }, 400);
  }

  const updated = await updateUserProfile(db, profile.id, {
    resume_text: resumeText,
    resume_file_path: filename,
  });

  const timestamp = new Date().toISOString();
  const existingContext = await getCandidateContext(db, profile.id);
  if (existingContext) {
    await updateCandidateContext(db, existingContext.id, { resume_parsed_at: timestamp });
  } else {
    await createCandidateContext(db, profile.id, { resume_parsed_at: timestamp });
  }

  return c.json(updated);
});

app.get("/api/candidate-context", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb();
  let profile = await getUserProfile(db, authUser.id);
  if (!profile) {
    profile = await createUserProfile(db, authUser.id, {
      full_name: authUser.name ?? null,
      email: authUser.email ?? null,
    });
  }

  const candidateContext = await getCandidateContext(db, profile.id);
  return c.json(candidateContext);
});

app.post("/api/candidate-context/refresh", async (c) => {
  const root = await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb();
  const profile = await getUserProfile(db, authUser.id);
  if (!profile) return c.json({ error: "No profile found" }, 404);

  const { apiKey, error, provider, model } = resolveLlmCredentials(root);
  if (!apiKey || !provider || !model) {
    return c.json({ error: error ?? "LLM API key not configured" }, 500);
  }

  const linkedinData = profile.linkedin_url
    ? await scrapeLinkedInProfile(profile.linkedin_url)
    : null;
  const portfolioData = profile.portfolio_url
    ? await scrapePortfolioSite(profile.portfolio_url)
    : null;

  const synthesized = await buildCandidateContext(
    { profile, linkedinData, portfolioData },
    { provider, apiKey, model }
  );
  const timestamp = new Date().toISOString();

  const payload = {
    ...synthesized,
    linkedin_scraped_at: linkedinData ? timestamp : null,
    portfolio_scraped_at: portfolioData ? timestamp : null,
    resume_parsed_at: profile.resume_text?.trim() ? timestamp : null,
  };

  const existingContext = await getCandidateContext(db, profile.id);
  const updatedContext = existingContext
    ? await updateCandidateContext(db, existingContext.id, payload)
    : await createCandidateContext(db, profile.id, payload);

  return c.json(updatedContext);
});

app.get("/api/companies", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const companies = await getAllCompanies(db, authUser.id);
  return c.json(companies);
});

app.get("/api/companies/:id", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const company = await getCompanyById(db, authUser.id, c.req.param("id"));
  if (!company) return c.json({ error: "Company not found" }, 404);
  return c.json(company);
});

app.post("/api/companies", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const body = await c.req.json();
  const company = await createCompany(db, authUser.id, body);
  return c.json(company, 201);
});

app.get("/api/roles", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const roles = await getAllRoles(db, authUser.id);
  return c.json(roles);
});

app.get("/api/roles/:id", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const role = await getRoleWithDetails(db, authUser.id, c.req.param("id"));
  if (!role) return c.json({ error: "Role not found" }, 404);
  return c.json(role);
});

app.post("/api/roles", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  try {
    const body = await c.req.json<AddRoleOptions>();
    const role = await addRole(authUser.id, body);
    return c.json(role, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Role already added") {
      const existingRoleId = (error as any).existingRoleId;
      return c.json({ error: "Role already added", existingRoleId }, 409);
    }
    const message = error instanceof Error ? error.message : "Failed to add role";
    return c.json({ error: message }, 400);
  }
});

app.put("/api/roles/:id", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const body = await c.req.json();
  const role = await updateRole(db, authUser.id, c.req.param("id"), body);
  return c.json(role);
});

app.put("/api/roles/:id/jd", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const body = await c.req.json<{ jd_text: string }>();
  const role = await updateRoleJd(db, authUser.id, c.req.param("id"), body.jd_text);
  return c.json(role);
});

app.post("/api/roles/:id/applications", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb();
  const roleId = c.req.param("id");
  const body = await c.req.json<{ status?: string }>();

  const existingRows = (await db.unsafe(
    "SELECT id, status FROM applications WHERE user_id = $1 AND role_id = $2",
    [authUser.id, roleId]
  )) as Array<{ id: string; status: string }>;
  const existing = existingRows[0];
  if (existing) {
    return c.json(existing);
  }

  try {
    const status = (body.status || "wishlist") as "wishlist" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";
    const application = await createApplication(db, authUser.id, { role_id: roleId, status });
    return c.json(application);
  } catch (error) {
    console.error("Failed to create application:", error);
    return c.json({ error: "Failed to create application" }, 500);
  }
});

app.post("/api/roles/:id/refresh", async (c) => {
  try {
    await ensureWorkspaceRoot();
    const authUser = c.get("authUser");
    if (!authUser) return c.json({ error: "Unauthorized" }, 401);
    const roleId = c.req.param("id");
    const result = await refreshRole(authUser.id, roleId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refresh role";
    return c.json({ error: message }, 400);
  }
});

app.post("/api/roles/:id/generate-linkedin-message", async (c) => {
  const root = await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb();
  const roleId = c.req.param("id");
  const role = await getRoleWithDetails(db, authUser.id, roleId);

  if (!role) return c.json({ error: "Role not found" }, 404);

  const profile = await getUserProfile(db, authUser.id);
  if (!profile) return c.json({ error: "Profile not found. Please complete your profile in Settings." }, 400);
  
  const candidateContext = await getCandidateContext(db, profile.id);
  const { apiKey, error, provider, model } = resolveLlmCredentials(root);
  
  if (!apiKey || !provider || !model) {
    return c.json({ error: error ?? "LLM API key not configured" }, 500);
  }

  
  const contextToUse = candidateContext?.full_context || `
CANDIDATE PROFILE:
Name: ${profile.full_name}
About: ${profile.about_me}
Why Looking: ${profile.why_looking}
Team Building Philosophy: ${profile.building_teams}
AI/Tech Perspective: ${profile.ai_shift}
Resume: ${profile.resume_text?.slice(0, 2000) || 'Not provided'}
  `.trim();
  
  const prompt = `You're helping a candidate write a LinkedIn message to a hiring manager after applying.

THE ROLE:
${role.title} at ${role.company_name}
${role.jd_text || 'Not provided'}

CANDIDATE BACKGROUND:
${contextToUse}

CRITICAL: Only use achievements and metrics that are EXPLICITLY stated in the candidate background above. Do NOT invent or fabricate any numbers, percentages, or metrics. If no specific metrics are available, describe the achievement qualitatively.

WRITE A SHORT, PUNCHY MESSAGE:

SUBJECT LINE:
- Personal and simple, like you're writing to a colleague
- NOT formal or stiff (avoid "Re: Application for..." or "Director, Engineering - Platform:")
- Examples of good subjects: "Excited about the Platform role", "Quick note on my application", "${role.company_name} + my platform experience"

MESSAGE BODY (75 words max):
- Paragraph 1 (1-2 sentences): Quick hook - you applied, you're excited, and why this role specifically caught your attention
- Paragraph 2 (1-2 sentences): ONE achievement that directly maps to a SPECIFIC requirement from the JD. Be explicit: "The JD mentions [X] - at [Company], I [achieved Y]". Only use metrics if they appear in the candidate background.
- Paragraph 3 (1 sentence): Brief culture fit or closing excitement. No asks.

RULES:
- 1-2 sentences per paragraph MAX
- Tie your achievement to something SPECIFIC the JD asks for
- NEVER invent metrics - only use what's in the candidate background
- No "I would love to discuss" or calls to action
- Sound human, not like a template
- First person ("I")

OUTPUT FORMAT (exactly this JSON):
{"subject": "Your subject line here", "message": "Your message body here"}`;


  try {
    const system = "You are a professional writer helping a job candidate write a LinkedIn message. Write from the candidate's first-person perspective using 'I'. Do not address the candidate by name. Do not include questions or calls to action.";

    let parsedMessage: { subject: string; message: string };

    try {
      const parsed = await generateJson({
        provider,
        apiKey,
        model,
        prompt,
        system,
        temperature: 0.7,
        maxTokens: 300,
      });

      const parsedRecord = isRecord(parsed) ? parsed : {};
      const subject = typeof parsedRecord.subject === "string" ? parsedRecord.subject : "";
      const message = typeof parsedRecord.message === "string" ? parsedRecord.message : "";

      if (!message) {
        throw new Error("No message generated");
      }

      parsedMessage = { subject, message };
    } catch {
      const fallback = await generateText({
        provider,
        apiKey,
        model,
        prompt,
        system,
        temperature: 0.7,
        maxTokens: 300,
      });

      parsedMessage = { subject: "", message: fallback.trim() };
    }

    const storedMessage = JSON.stringify(parsedMessage);
    const updatedRole = await updateRole(db, authUser.id, roleId, { linkedin_message: storedMessage });

    return c.json({ subject: parsedMessage.subject, message: parsedMessage.message, role: updatedRole });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate LinkedIn message";
    return c.json({ error: message }, 500);
  }
});

app.delete("/api/roles/:id", async (c) => {
  try {
    await ensureWorkspaceRoot();
    const authUser = c.get("authUser");
    if (!authUser) return c.json({ error: "Unauthorized" }, 401);

    const roleId = c.req.param("id");
    const db = getDb();
    const role = await getRoleById(db, authUser.id, roleId);

    if (!role) return c.json({ error: "Role not found" }, 404);

    await deleteRole(db, authUser.id, roleId);
    return c.json({ success: true, message: "Role deleted successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete role";
    return c.json({ error: message }, 500);
  }
});

app.post("/api/pipeline/refresh", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb();
  const roles = (await db.unsafe(
    `SELECT r.id, r.job_url 
     FROM roles r
     JOIN applications a ON a.role_id = r.id
     WHERE a.user_id = $1 AND r.user_id = $1
     AND a.status IN ('wishlist', 'applied', 'interviewing', 'offer')
     AND r.job_url IS NOT NULL`,
    [authUser.id]
  )) as Array<{ id: string; job_url: string | null }>;

  const results = {
    total: roles.length,
    updated: 0,
    failed: 0,
    skipped: 0,
  };

  for (const role of roles) {
    try {
        const result = await refreshRole(authUser.id, role.id);

      if (result.updated) {
        results.updated++;
      } else {
        results.skipped++;
      }
    } catch (error) {
      results.failed++;
      console.error(`Failed to refresh role ${role.id}:`, error);
    }
  }

  return c.json(results);
});

app.get("/api/stats", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const stats = await getPipelineStats(db, authUser.id);
  return c.json(stats);
});

app.get("/api/tasks", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const status = c.req.query("status");
  const pending = c.req.query("pending");
  const wantsPending = status === "pending" || pending === "true";
  const tasks = wantsPending
    ? await getPendingTasks(db, authUser.id)
    : await getAllTasks(db, authUser.id);

  if (status && !wantsPending) {
    return c.json(tasks.filter((task) => task.status === status));
  }

  return c.json(tasks);
});

app.post("/api/tasks", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const body = await c.req.json();
  const task = await createTask(db, authUser.id, body);
  return c.json(task, 201);
});

app.put("/api/tasks/:id", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const body = await c.req.json();
  const task = await updateTask(db, authUser.id, c.req.param("id"), body);
  return c.json(task);
});

app.get("/api/roles/:id/artifacts", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const roleId = c.req.param("id");
  const application = await getApplicationByRoleId(db, authUser.id, roleId);
  if (!application) return c.json([]);
  const artifacts = (await db.unsafe(
    "SELECT id, kind, path, created_at FROM artifacts WHERE user_id = $1 AND application_id = $2",
    [authUser.id, application.id]
  )) as Array<{ id: string; kind: string; path: string; created_at: string }>;
  return c.json(artifacts);
});

app.get("/api/artifacts/:id", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const artifactRows = (await db.unsafe(
    "SELECT path FROM artifacts WHERE user_id = $1 AND id = $2",
    [authUser.id, c.req.param("id")]
  )) as Array<{ path: string }>;
  const artifact = artifactRows[0];
  if (!artifact) return c.json({ error: "Artifact not found" }, 404);
  try {
    const buffer = await readFile(artifact.path);
    return new Response(buffer);
  } catch {
    return c.json({ error: "File not found" }, 404);
  }
});

app.get("/api/applications", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const status = c.req.query("status");
  const applications = status
    ? await getApplicationsByStatus(db, authUser.id, status)
    : await getAllApplications(db, authUser.id);
  return c.json(applications);
});

app.get("/api/applications/stats", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const stats = await getPipelineStats(db, authUser.id);
  return c.json(stats);
});

app.get("/api/applications/:id", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const application = await getApplicationById(db, authUser.id, c.req.param("id"));
  if (!application) return c.json({ error: "Application not found" }, 404);
  return c.json(application);
});

app.put("/api/applications/:id", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const body = await c.req.json();
  const application = await updateApplication(db, authUser.id, c.req.param("id"), body);
  return c.json(application);
});

app.post("/api/applications/:id/apply", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const applicationId = c.req.param("id");
  const db = getDb();
  const application = await getApplicationById(db, authUser.id, applicationId);
  if (!application) return c.json({ error: "Application not found" }, 404);

  const result = await applyToRole(authUser.id, application.role_id);
  return c.json(result);
});

app.post("/api/stream/cover-letter/:roleId", async (c) => {
  const root = await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const roleId = c.req.param("roleId");
  const body = await c.req.json().catch(() => ({}));
  const additionalContext = body.additionalContext || "";

  const db = getDb();
  const role = await getRoleWithDetails(db, authUser.id, roleId);
  if (!role) return c.json({ error: "Role not found" }, 404);

  const { apiKey, error, provider, model } = resolveLlmCredentials(root);
  if (!apiKey || !provider || !model) {
    return c.json({ error: error ?? "LLM API key not configured" }, 500);
  }

  const userProfile = await getUserProfile(db, authUser.id);
  if (!userProfile) return c.json({ error: "No user profile found" }, 404);

  
  const candidateContext = await getCandidateContext(db, userProfile.id);
  const companyName = role.company_name || "Unknown Company";

  const contextToUse = candidateContext?.full_context || `
Name: ${userProfile.full_name}
About: ${userProfile.about_me}
Resume: ${userProfile.resume_text?.slice(0, 2000) || 'Not provided'}
  `.trim();
  
  const prompt = `You're helping a job candidate answer an application question.

THE ROLE:
${role.title} at ${companyName}
${role.jd_text || 'No job description available'}

CANDIDATE BACKGROUND:
${contextToUse}

APPLICATION QUESTION:
"${body.question}"

INSTRUCTIONS:
- Generate exactly 3 different answer options
- Each answer should be 2-4 sentences max
- Be specific - reference real experience from the candidate's background
- Match the tone to the question (casual if casual, professional if formal)
- Do NOT fabricate metrics or achievements not in the background
- Sound human, not robotic
- If the question asks "why this company", focus on genuine alignment between candidate's interests and company mission/product
- Make each option distinct: one concise, one detailed, one with a different angle/emphasis

Return ONLY a JSON array with exactly 3 strings, no other text:
["answer 1", "answer 2", "answer 3"]`;

  const parsed = await generateJson({
    provider,
    apiKey,
    model,
    prompt,
    temperature: 0.4,
    maxTokens: 800,
  });

  const answers = Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : typeof parsed === "string"
      ? [parsed]
      : [];

  if (answers.length === 0) {
    return c.json({ error: "Failed to generate answers" }, 500);
  }

  return c.json({ answers });
});

app.post("/api/roles/:roleId/questions", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb();
  const roleId = c.req.param("roleId");
  const body = await c.req.json<{ question: string; generated_answer?: string; submitted_answer?: string }>();

  if (!body.question?.trim()) {
    return c.json({ error: "Question is required" }, 400);
  }

  try {
    const question = await createQuestion(db, authUser.id, roleId, body.question, body.generated_answer || null);

    if (body.submitted_answer) {
      await updateQuestion(db, authUser.id, question.id, { submitted_answer: body.submitted_answer });
    }

    return c.json(question);
  } catch (error) {
    console.error("Failed to create question:", error);
    return c.json({ error: "Failed to save question" }, 500);
  }
});

app.put("/api/questions/:questionId", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb();
  const questionId = c.req.param("questionId");
  const body = await c.req.json<{ generated_answer?: string; submitted_answer?: string }>();

  const updated = await updateQuestion(db, authUser.id, questionId, body);
  if (!updated) return c.json({ error: "Question not found" }, 404);

  return c.json(updated);
});

app.delete("/api/questions/:questionId", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb();
  const questionId = c.req.param("questionId");

  await deleteQuestion(db, authUser.id, questionId);
  return c.json({ success: true });
});

app.get("/api/backup", async (c) => {
  await ensureWorkspaceRoot();
  return c.json({ error: "Backup is not supported for Postgres. Use pg_dump." }, 501);
});

app.post("/api/restore", async (c) => {
  await ensureWorkspaceRoot();
  return c.json({ error: "Restore is not supported for Postgres. Use psql to restore." }, 501);
});

app.post("/api/companies/:id/research", async (c) => {
  const { id } = c.req.param();
  const root = await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const { apiKey, error, provider, model } = resolveLlmCredentials(root);

  if (!apiKey || !provider || !model) {
    return c.json({ error: error ?? "LLM API key not configured" }, 500);
  }

  const company = await getCompanyById(db, authUser.id, id);
  if (!company) {
    return c.json({ error: "Company not found" }, 404);
  }

  const result = await researchCompany(provider, apiKey, model, company.name);

  if (!result) {
    return c.json({ error: "Failed to research company" }, 500);
  }

  const fundingStatus = result.funding_status.type ? JSON.stringify(result.funding_status) : null;
  const industry = result.industry.primary ? JSON.stringify(result.industry) : null;
  const companySize = result.company_size.employees_estimate ? JSON.stringify(result.company_size) : null;

  const updated = await updateCompany(db, authUser.id, id, {
    website: result.website || company.website || undefined,
    headquarters: result.headquarters.city && result.headquarters.country 
      ? `${result.headquarters.city}, ${result.headquarters.state_province || ''} ${result.headquarters.country}`.trim()
      : company.headquarters || undefined,
    description: result.description || company.description || undefined,
    industry: industry || undefined,
    funding_status: fundingStatus || undefined,
    company_size: companySize || undefined,
    established_date: result.established_date || undefined,
    research_sources: result.sources.length > 0 ? JSON.stringify(result.sources) : undefined,
  });

  return c.json({ company: updated, research: result });
});

app.get("/api/interviews/upcoming", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();

  const interviews = (await db.unsafe(
    `
    SELECT i.id, i.round_name, i.scheduled_at, i.interview_type, i.interviewer_name, i.interviewer_title,
           c.name as company_name, r.title as role_title
    FROM interviews i
    JOIN applications a ON i.application_id = a.id
    JOIN roles r ON a.role_id = r.id
    JOIN companies c ON r.company_id = c.id
    WHERE i.user_id = $1
      AND i.scheduled_at IS NOT NULL
      AND i.scheduled_at <> ''
      AND i.scheduled_at::timestamptz >= now()
    ORDER BY i.scheduled_at ASC
    LIMIT 10
  `,
    [authUser.id]
  )) as Array<{
    id: string;
    round_name: string;
    scheduled_at: string | null;
    interview_type: string | null;
    interviewer_name: string | null;
    interviewer_title: string | null;
    company_name: string;
    role_title: string;
  }>;

  return c.json(interviews);
});

app.get("/api/oauth/google/status", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();
  const secrets = loadSecrets();
  const profile = await getUserProfile(db, authUser.id);

  const refreshToken = secrets.google_calendar_refresh_token || profile?.google_calendar_refresh_token;

  return c.json({
    configured: isCalendarConfigured({
      clientId: secrets.google_calendar_client_id,
      clientSecret: secrets.google_calendar_client_secret,
    }),
    connected: isCalendarConnected({
      clientId: secrets.google_calendar_client_id,
      clientSecret: secrets.google_calendar_client_secret,
      refreshToken: refreshToken || undefined,
    }),
  });
});

app.get("/api/oauth/google/authorize", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const secrets = loadSecrets();

  if (!secrets.google_calendar_client_id || !secrets.google_calendar_client_secret) {
    return c.json({ error: "Google Calendar credentials not configured" }, 400);
  }

  const authUrl = generateAuthUrl({
    clientId: secrets.google_calendar_client_id,
    clientSecret: secrets.google_calendar_client_secret,
  });

  return c.json({ url: authUrl });
});

app.get("/api/oauth/google/callback", async (c) => {
  const code = c.req.query("code");

  if (!code) {
    return c.html("<html><body><h1>Error</h1><p>No authorization code received.</p></body></html>");
  }

  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.html("<html><body><h1>Error</h1><p>Unauthorized.</p></body></html>");
  const db = getDb();
  const secrets = loadSecrets();

  if (!secrets.google_calendar_client_id || !secrets.google_calendar_client_secret) {
    return c.html("<html><body><h1>Error</h1><p>Google Calendar credentials not configured.</p></body></html>");
  }

  try {
    const refreshToken = await exchangeCodeForTokens(
      {
        clientId: secrets.google_calendar_client_id,
        clientSecret: secrets.google_calendar_client_secret,
      },
      code
    );

    if (refreshToken) {
      const profile = await getUserProfile(db, authUser.id);
      if (profile) {
        await updateUserProfile(db, profile.id, { google_calendar_refresh_token: refreshToken });
      }

      return c.html(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1>✓ Google Calendar Connected</h1>
            <p>Your calendar has been linked successfully.</p>
            <p style="margin-top: 20px;">You can close this window.</p>
            <script>window.opener?.postMessage({ type: 'google-calendar-connected' }, '*'); setTimeout(() => window.close(), 2000);</script>
          </body>
        </html>
      `);
    } else {
      return c.html("<html><body><h1>Error</h1><p>Failed to get refresh token. Try again.</p></body></html>");
    }
  } catch (error) {
    console.error("OAuth callback error:", error);
    return c.html(`<html><body><h1>Error</h1><p>${error}</p></body></html>`);
  }
});

app.delete("/api/oauth/google/disconnect", async (c) => {
  try {
    await ensureWorkspaceRoot();
    const authUser = c.get("authUser");
    if (!authUser) return c.json({ error: "Unauthorized" }, 401);
    const db = getDb();

    const profile = await getUserProfile(db, authUser.id);

    if (profile) {
      await updateUserProfile(db, profile.id, { google_calendar_refresh_token: null, google_calendar_id: null });
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Disconnect error:", error);
    return c.json({ error: String(error) }, 500);
  }
});

app.get("/api/calendars", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();

  const secrets = loadSecrets();
  const profile = await getUserProfile(db, authUser.id);

  if (!secrets.google_calendar_client_id || !secrets.google_calendar_client_secret || !profile?.google_calendar_refresh_token) {
    return c.json({ calendars: [], selectedId: null });
  }

  try {
    const { listCalendars } = await import("./integrations/google-calendar");
    const calendars = await listCalendars({
      clientId: secrets.google_calendar_client_id,
      clientSecret: secrets.google_calendar_client_secret,
      refreshToken: profile.google_calendar_refresh_token,
    });
    return c.json({ calendars, selectedId: profile.google_calendar_id || "primary" });
  } catch (error) {
    console.error("Failed to list calendars:", error);
    return c.json({ calendars: [], selectedId: null, error: String(error) }, 500);
  }
});

app.put("/api/settings/calendar", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();

  const profile = await getUserProfile(db, authUser.id);
  const body = await c.req.json<{ calendarId: string }>();

  if (!profile) {
    return c.json({ error: "No profile found" }, 404);
  }

  await updateUserProfile(db, profile.id, { google_calendar_id: body.calendarId });
  return c.json({ success: true });
});

app.get("/api/calendar/events", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();

  const secrets = loadSecrets();
  const profile = await getUserProfile(db, authUser.id);

  const refreshToken = profile?.google_calendar_refresh_token;
  if (!secrets.google_calendar_client_id || !secrets.google_calendar_client_secret || !refreshToken) {
    return c.json({ events: [], connected: false });
  }

  try {
    const { getUpcomingEvents } = await import("./integrations/google-calendar");
    const calendarId = profile?.google_calendar_id || "primary";
    const events = await getUpcomingEvents(
      {
        clientId: secrets.google_calendar_client_id,
        clientSecret: secrets.google_calendar_client_secret,
        refreshToken,
      },
      calendarId,
      20
    );
    return c.json({ events, connected: true });
  } catch (error) {
    console.error("Failed to fetch calendar events:", error);
    return c.json({ events: [], connected: true, error: String(error) }, 500);
  }
});

app.post("/api/calendar/events/:eventId/link", async (c) => {
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb();
  const eventId = c.req.param("eventId");
  const body = await c.req.json<{
    role_id: string;
    summary: string;
    startTime: string;
    endTime: string;
    location?: string;
    conferenceLink?: string;
  }>();

  const application = await getApplicationByRoleId(db, authUser.id, body.role_id);
  if (!application) {
    return c.json({ error: "No application found for this role" }, 404);
  }

  const startDate = new Date(body.startTime);
  const endDate = new Date(body.endTime);
  const durationMins = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

  const interview = await createInterview(db, authUser.id, {
    application_id: application.id,
    scheduled_at: body.startTime,
    interview_type: "calendar_event",
    notes: body.summary,
    duration_minutes: durationMins,
    location: body.location,
    video_link: body.conferenceLink,
    google_calendar_event_id: eventId,
  });

  return c.json(interview);
});

app.post("/api/interviews/:id/generate-prep", async (c) => {
  const root = await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb();
  const interviewId = c.req.param("id");
  const { apiKey, error, provider, model } = resolveLlmCredentials(root);

  if (!apiKey || !provider || !model) {
    return c.json({ error: error ?? "LLM API key not configured" }, 500);
  }

  const interview = await getInterviewById(db, authUser.id, interviewId);
  if (!interview) return c.json({ error: "Interview not found" }, 404);

  const application = await getApplicationById(db, authUser.id, interview.application_id);
  if (!application) return c.json({ error: "Application not found" }, 404);

  const role = await getRoleById(db, authUser.id, application.role_id);
  if (!role) return c.json({ error: "Role not found" }, 404);

  const company = await getCompanyById(db, authUser.id, role.company_id);
  const companyName = company?.name || "Unknown Company";

  const userProfile = await getUserProfile(db, authUser.id);
  const candidateContext = userProfile ? await getCandidateContext(db, userProfile.id) : null;
  
  const contextToUse = candidateContext?.full_context || `
Name: ${userProfile?.full_name || "Candidate"}
About: ${userProfile?.about_me || ""}
  `.trim();
  
  const prompt = `You're helping a job candidate prepare for an interview.

THE ROLE:
${role.title} at ${companyName}
${role.jd_text || 'No job description available'}

COMPANY INFO:
- Industry: ${company?.industry || 'Unknown'}
- Size: ${company?.company_size || 'Unknown'}
- Description: ${company?.description || 'Unknown'}

INTERVIEW TYPE: ${interview.interview_type || 'General'}
INTERVIEWER: ${interview.interviewer_name || 'Unknown'} ${interview.interviewer_title ? `(${interview.interviewer_title})` : ''}

CANDIDATE BACKGROUND:
${contextToUse}

Generate interview preparation material with the following sections:

1. KEY TALKING POINTS (3-5 bullet points of things the candidate should emphasize based on their background and this role)

2. LIKELY QUESTIONS (5-7 questions the interviewer might ask, tailored to this role type)

3. QUESTIONS TO ASK (4-5 thoughtful questions the candidate should ask the interviewer)

4. RESEARCH NOTES (Key facts about the company and role to mention or reference)

Return as JSON:
{
  "prep_notes": "bullet points as a string with newlines",
  "likely_questions": ["question 1", "question 2", ...],
  "questions_to_ask": "bullet points as a string with newlines", 
  "research_notes": "key facts as a string with newlines"
}`;

  try {
    const prepData = await generateJson({
      provider,
      apiKey,
      model,
      prompt,
      temperature: 0.6,
      maxTokens: 1200,
    });

    if (!isRecord(prepData)) {
      return c.json({ error: "Failed to parse AI response" }, 500);
    }

    return c.json(prepData);
  } catch (error) {
    console.error("Failed to generate interview prep:", error);
    return c.json({ error: String(error) }, 500);
  }
});

app.post("/api/interviews/:id/sync-calendar", async (c) => {
  const { id } = c.req.param();
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();

  const secrets = loadSecrets();
  const profile = await getUserProfile(db, authUser.id);

  const refreshToken = secrets.google_calendar_refresh_token || profile?.google_calendar_refresh_token;

  if (!secrets.google_calendar_client_id || !secrets.google_calendar_client_secret || !refreshToken) {
    return c.json({ error: "Google Calendar not connected" }, 400);
  }

  const interview = await getInterviewById(db, authUser.id, id);
  if (!interview) {
    return c.json({ error: "Interview not found" }, 404);
  }

  const roleRows = (await db.unsafe(
    `SELECT r.title, c.name as company_name 
     FROM applications a
     JOIN roles r ON a.role_id = r.id 
     JOIN companies c ON r.company_id = c.id 
     WHERE a.user_id = $1 AND a.id = $2`,
    [authUser.id, interview.application_id]
  )) as Array<{ title: string; company_name: string }>;
  const role = roleRows[0];
  
  if (!role) {
    return c.json({ error: "Role not found" }, 404);
  }
  
  const credentials = {
    clientId: secrets.google_calendar_client_id,
    clientSecret: secrets.google_calendar_client_secret,
    refreshToken: refreshToken,
  };
  
  const startTime = new Date(interview.scheduled_at);
  const endTime = new Date(startTime.getTime() + (interview.duration_minutes || 60) * 60 * 1000);
  
  const interviewTypeLabel = interview.interview_type 
    ? interview.interview_type.replace(/_/g, ' ').replace(/\b\w/g, (char: string) => char.toUpperCase())
    : "Interview";
  
  const eventData = {
    summary: `${interviewTypeLabel}: ${role.title} at ${role.company_name}`,
    description: [
      interview.interviewer_name ? `Interviewer: ${interview.interviewer_name}` : null,
      interview.interviewer_title ? `Title: ${interview.interviewer_title}` : null,
      interview.notes ? `\nNotes: ${interview.notes}` : null,
    ].filter(Boolean).join("\n"),
    startTime,
    endTime,
    location: interview.location || undefined,
    conferenceLink: interview.video_link || undefined,
  };
  
  const calendarId = profile?.google_calendar_id || "primary";
  
  try {
    if (interview.google_calendar_event_id) {
      await updateCalendarEvent(credentials, interview.google_calendar_event_id, eventData, calendarId);
      return c.json({ success: true, eventId: interview.google_calendar_event_id });
    } else {
      const eventId = await createCalendarEvent(credentials, eventData, calendarId);
      if (eventId) {
        await updateInterview(db, authUser.id, id, { google_calendar_event_id: eventId });
        return c.json({ success: true, eventId });
      }
      return c.json({ error: "Failed to create calendar event" }, 500);
    }
  } catch (error) {
    console.error("Calendar sync error:", error);
    return c.json({ error: String(error) }, 500);
  }
});

app.delete("/api/interviews/:id/calendar-event", async (c) => {
  const { id } = c.req.param();
  await ensureWorkspaceRoot();
  const authUser = c.get("authUser");
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);
  const db = getDb();

  const secrets = loadSecrets();
  const profile = await getUserProfile(db, authUser.id);

  const interview = await getInterviewById(db, authUser.id, id);
  if (!interview || !interview.google_calendar_event_id) {
    return c.json({ error: "No calendar event to delete" }, 404);
  }

  const refreshToken = secrets.google_calendar_refresh_token || profile?.google_calendar_refresh_token;

  if (!secrets.google_calendar_client_id || !secrets.google_calendar_client_secret || !refreshToken) {
    return c.json({ error: "Google Calendar not connected" }, 400);
  }

  const calendarId = profile?.google_calendar_id || "primary";

  try {
    await deleteCalendarEvent(
      {
        clientId: secrets.google_calendar_client_id,
        clientSecret: secrets.google_calendar_client_secret,
        refreshToken: refreshToken,
      },
      interview.google_calendar_event_id,
      calendarId
    );

    await updateInterview(db, authUser.id, id, { google_calendar_event_id: undefined });
    return c.json({ success: true });
  } catch (error) {
    console.error("Calendar delete error:", error);
    return c.json({ error: String(error) }, 500);
  }
});

app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

if (import.meta.main) {
  serve({ fetch: app.fetch, port });
  console.log(`Server running at http://localhost:${port}`);
}

export { app };
