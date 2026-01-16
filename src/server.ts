import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import { findRoot, dbPath } from "./workspace";
import { getDb, runMigrations } from "./db";
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
import { runDoctor } from "./commands/doctor";
import { generateCoverLetterStream } from "./llm/gemini";
import { generateCompanyResearch } from "./llm/research";
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

const app = new Hono();

let migrationsChecked = false;

function ensureMigrations(root: string): void {
  if (migrationsChecked) {
    return;
  }

  runMigrations(getDb(dbPath(root)));
  migrationsChecked = true;
}

function ensureWorkspaceRoot(): string {
  const root = findRoot(undefined, { throwOnMissing: false });
  if (root) {
    ensureMigrations(root);
    return root;
  }

  initWorkspace();

  const initializedRoot = findRoot(undefined, { throwOnMissing: false });
  if (initializedRoot) {
    ensureMigrations(initializedRoot);
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

app.use("*", cors());

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.get("/api/doctor", async (c) => {
  const results = await runDoctor();
  const checks = results.map((r) => ({
    name: r.label,
    status: r.ok ? "ok" : "error",
    message: r.ok ? "Operational" : "Check failed",
  }));
  const allOk = results.every((r) => r.ok);
  return c.json({ checks, allOk });
});

app.get("/api/companies", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const companies = getAllCompanies(db);
  return c.json(companies);
});

app.get("/api/companies/:id", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const company = getCompanyById(db, c.req.param("id"));
  if (!company) return c.json({ error: "Company not found" }, 404);
  return c.json(company);
});

app.post("/api/companies", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const body = await c.req.json();
  const company = createCompany(db, body);
  return c.json(company, 201);
});

app.get("/api/roles", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const roles = getAllRoles(db);
  return c.json(roles);
});

app.get("/api/roles/:id", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const role = getRoleWithDetails(db, c.req.param("id"));
  if (!role) return c.json({ error: "Role not found" }, 404);
  return c.json(role);
});

app.post("/api/roles", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  try {
    const body = await c.req.json<AddRoleOptions>();
    const role = await addRole(body);
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
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const body = await c.req.json();
  const role = updateRole(db, c.req.param("id"), body);
  return c.json(role);
});

app.put("/api/roles/:id/jd", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const body = await c.req.json<{ jd_text: string }>();
  const role = updateRoleJd(db, c.req.param("id"), body.jd_text);
  return c.json(role);
});

app.post("/api/roles/:id/applications", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const roleId = c.req.param("id");
  const body = await c.req.json<{ status?: string }>();
  
  const existing = db.prepare("SELECT id, status FROM applications WHERE role_id = ?").get(roleId) as { id: string; status: string } | undefined;
  if (existing) {
    return c.json(existing);
  }
  
  try {
    const status = (body.status || "wishlist") as "wishlist" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";
    const application = createApplication(db, { role_id: roleId, status });
    return c.json(application);
  } catch (error) {
    console.error("Failed to create application:", error);
    return c.json({ error: "Failed to create application" }, 500);
  }
});

app.post("/api/roles/:id/refresh", async (c) => {
  try {
    const roleId = c.req.param("id");
    const result = await refreshRole(roleId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refresh role";
    return c.json({ error: message }, 400);
  }
});

app.post("/api/roles/:id/generate-linkedin-message", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const roleId = c.req.param("id");
  const role = getRoleWithDetails(db, roleId);
  
  if (!role) return c.json({ error: "Role not found" }, 404);
  
  const profile = getUserProfile(db);
  if (!profile) return c.json({ error: "Profile not found. Please complete your profile in Settings." }, 400);
  
  const candidateContext = getCandidateContext(db, profile.id);
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
    const updatedRole = updateRole(db, roleId, { linkedin_message: storedMessage });

    return c.json({ subject: parsedMessage.subject, message: parsedMessage.message, role: updatedRole });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate LinkedIn message";
    return c.json({ error: message }, 500);
  }
});

app.delete("/api/roles/:id", async (c) => {
  try {
    const root = ensureWorkspaceRoot();
    if (!root) return c.json({ error: "Workspace not initialized" }, 500);
    
    const roleId = c.req.param("id");
    const db = getDb(dbPath(root));
    const role = getRoleById(db, roleId);
    
    if (!role) return c.json({ error: "Role not found" }, 404);
    
    deleteRole(db, roleId);
    return c.json({ success: true, message: "Role deleted successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete role";
    return c.json({ error: message }, 500);
  }
});

app.post("/api/pipeline/refresh", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const roles = db
    .query<{ id: string; job_url: string | null }, []>(
      `SELECT r.id, r.job_url 
       FROM roles r
       JOIN applications a ON a.role_id = r.id
       WHERE a.status IN ('wishlist', 'applied', 'interviewing', 'offer')
       AND r.job_url IS NOT NULL`
    )
    .all();

  const results = {
    total: roles.length,
    updated: 0,
    failed: 0,
    skipped: 0,
  };

  for (const role of roles) {
    try {
      const result = await refreshRole(role.id);
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
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const stats = getPipelineStats(db);
  return c.json(stats);
});

app.get("/api/roles/:id/artifacts", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const roleId = c.req.param("id");
  const application = getApplicationByRoleId(db, roleId);
  if (!application) return c.json([]);
  const artifacts = db
    .query<{ id: string; kind: string; path: string; created_at: string }, [string]>(
      "SELECT id, kind, path, created_at FROM artifacts WHERE application_id = ?"
    )
    .all(application.id);
  return c.json(artifacts);
});

app.get("/api/artifacts/:id", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const artifact = db
    .query<{ path: string }, [string]>("SELECT path FROM artifacts WHERE id = ?")
    .get(c.req.param("id"));
  if (!artifact) return c.json({ error: "Artifact not found" }, 404);
  const file = Bun.file(artifact.path);
  if (!(await file.exists())) return c.json({ error: "File not found" }, 404);
  return new Response(file);
});

app.get("/api/applications", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const status = c.req.query("status");
  const applications = status
    ? getApplicationsByStatus(db, status)
    : getAllApplications(db);
  return c.json(applications);
});

app.get("/api/applications/stats", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const stats = getPipelineStats(db);
  return c.json(stats);
});

app.get("/api/applications/:id", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const application = getApplicationById(db, c.req.param("id"));
  if (!application) return c.json({ error: "Application not found" }, 404);
  return c.json(application);
});

app.put("/api/applications/:id", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const body = await c.req.json();
  const application = updateApplication(db, c.req.param("id"), body);
  return c.json(application);
});

app.post("/api/applications/:id/apply", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);

  const applicationId = c.req.param("id");
  const db = getDb(dbPath(root));
  const application = getApplicationById(db, applicationId);
  if (!application) return c.json({ error: "Application not found" }, 404);

  const result = await applyToRole(application.role_id);
  return c.json(result);
});

app.post("/api/stream/cover-letter/:roleId", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);

  const roleId = c.req.param("roleId");
  const body = await c.req.json().catch(() => ({}));
  const additionalContext = body.additionalContext || "";

  const db = getDb(dbPath(root));
  const role = getRoleById(db, roleId);
  if (!role) return c.json({ error: "Role not found" }, 404);

  const { apiKey, error, provider, model } = resolveLlmCredentials(root);
  if (!apiKey || !provider || !model) {
    return c.json({ error: error ?? "LLM API key not configured" }, 500);
  }

  const userProfile = getUserProfile(db);
  if (!userProfile) return c.json({ error: "No user profile found" }, 404);

  const candidateContext = getCandidateContext(db, userProfile.id);

  const contextToUse = candidateContext?.full_context || `
Name: ${userProfile.full_name || 'Unknown'}
About: ${userProfile.about_me || 'No about info'}
Resume: ${userProfile.resume_text || 'No resume uploaded'}
  `.trim();

  const profile = {
    candidateContext: contextToUse,
    apiKey,
    model,
    provider,
  };

  return streamSSE(c, async (stream) => {
    try {
      const generator = generateCoverLetterStream(profile, role, additionalContext);
      for await (const chunk of generator) {
        await stream.writeSSE({ data: chunk });
      }
      await stream.writeSSE({ event: "done", data: "" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await stream.writeSSE({ event: "error", data: message });
    }
  });
});

app.get("/api/roles/:id/research", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);

  const roleId = c.req.param("id");
  const db = getDb(dbPath(root));
  const research = getResearchByRoleId(db, roleId);
  return c.json(research ?? null);
});

app.post("/api/stream/research/:roleId", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);

  const roleId = c.req.param("roleId");
  const db = getDb(dbPath(root));

  const roleWithDetails = getRoleWithDetails(db, roleId);
  if (!roleWithDetails) return c.json({ error: "Role not found" }, 404);

  const { apiKey, error, provider, model } = resolveLlmCredentials(root);
  if (!apiKey || !provider || !model) {
    return c.json({ error: error ?? "LLM API key not configured" }, 500);
  }

  const profile = getUserProfile(db);
  if (!profile) return c.json({ error: "User profile not found" }, 404);

  const candidateContext = getCandidateContext(db, profile.id);

  const contextToUse = candidateContext?.full_context || `
CANDIDATE PROFILE:
Name: ${profile.full_name}
Resume: ${profile.resume_text?.slice(0, 3000) || 'Not provided'}
About: ${profile.about_me || 'Not provided'}
  `.trim();

  void getOrCreateResearch(db, roleId);

  return streamSSE(c, async (stream) => {
    try {
      const generator = generateCompanyResearch({
        provider,
        apiKey,
        model,
        companyName: roleWithDetails.company_name,
        companyWebsite: roleWithDetails.company_website,
        companyDescription: roleWithDetails.company_description,
        companyHeadquarters: roleWithDetails.company_headquarters,
        roleTitle: roleWithDetails.title,
        jobDescription: roleWithDetails.jd_text ?? "",
        candidateContext: contextToUse,
      });

      for await (const { section, content } of generator) {
        updateResearch(db, roleId, { [section]: content });
        await stream.writeSSE({ event: section, data: content });
      }

      await stream.writeSSE({ event: "done", data: "" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await stream.writeSSE({ event: "error", data: message });
    }
  });
});

app.get("/api/tasks", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const pending = c.req.query("pending") === "true";
  const tasks = pending ? getPendingTasks(db) : getAllTasks(db);
  return c.json(tasks);
});

app.put("/api/tasks/:id", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const body = await c.req.json();
  const task = updateTask(db, c.req.param("id"), body);
  return c.json(task);
});

app.post("/api/tasks", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const body = await c.req.json();
  const task = createTask(db, body);
  return c.json(task);
});

app.get("/api/profile", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  initUserProfileTable(db);
  const profile = getUserProfile(db);
  return c.json(profile);
});

app.post("/api/profile", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  initUserProfileTable(db);
  const body = await c.req.json();
  const profile = createUserProfile(db, body);
  return c.json(profile);
});

app.put("/api/profile/:id", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));
  const body = await c.req.json();
  const profile = updateUserProfile(db, c.req.param("id"), body);
  return c.json(profile);
});

app.post("/api/profile/:id/resume", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  const db = getDb(dbPath(root));

  const body = await c.req.parseBody();
  const file = body.resume as File;

  if (!file) {
    return c.json({ error: "No file uploaded" }, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let resumeText = "";

  if (file.name.toLowerCase().endsWith(".pdf")) {
    const { extractTextFromPDF } = await import("./lib/pdf-parser");
    resumeText = await extractTextFromPDF(buffer);
  } else {
    resumeText = await file.text();
  }

  const llmCredentials = getOptionalLlmCredentials(root);
  let parsedData: Record<string, unknown> = {};

  if (llmCredentials?.apiKey) {
    try {
      const parsed = await generateJson({
        provider: llmCredentials.provider,
        apiKey: llmCredentials.apiKey,
        model: llmCredentials.model,
        prompt: `Parse this resume and extract structured data as JSON. Include: full_name, email, phone, linkedin_url, work_experience (array with company, title, start_date, end_date, highlights), education (array), skills (array). Return ONLY valid JSON, no markdown formatting.\n\nResume:\n${resumeText}`,
        temperature: 0.1,
        maxTokens: 2048,
      });

      if (isRecord(parsed)) {
        parsedData = parsed;
      }
    } catch (error) {
      console.error("Failed to parse resume with AI:", error);
    }
  }

  const updates: Record<string, unknown> = {
    resume_text: resumeText,
    resume_file_path: file.name,
  };

  const fullName = typeof parsedData.full_name === "string" ? parsedData.full_name : undefined;
  const email = typeof parsedData.email === "string" ? parsedData.email : undefined;
  const phone = typeof parsedData.phone === "string" ? parsedData.phone : undefined;
  const linkedinUrl = typeof parsedData.linkedin_url === "string" ? parsedData.linkedin_url : undefined;
  const workExperience = Array.isArray(parsedData.work_experience) ? parsedData.work_experience : undefined;
  const education = Array.isArray(parsedData.education) ? parsedData.education : undefined;
  const skills = Array.isArray(parsedData.skills) ? parsedData.skills : undefined;

  if (fullName) updates.full_name = fullName;
  if (email) updates.email = email;
  if (phone) updates.phone = phone;
  if (linkedinUrl) updates.linkedin_url = linkedinUrl;
  if (workExperience || education || skills) {
    updates.experience_json = JSON.stringify({
      work_experience: workExperience ?? [],
      education: education ?? [],
      skills: skills ?? []
    });
  }

  const profile = updateUserProfile(db, c.req.param("id"), updates);

  return c.json(profile);
});

app.post("/api/candidate-context/refresh", async (c) => {
  try {
    const root = ensureWorkspaceRoot();
    if (!root) return c.json({ error: "Workspace not initialized" }, 500);

    const db = getDb(dbPath(root));
    const { apiKey, error, provider, model } = resolveLlmCredentials(root);
    if (!apiKey || !provider || !model) {
      return c.json({ error: error ?? "LLM API key not configured" }, 500);
    }

    const profile = getUserProfile(db);
    if (!profile) {
      return c.json({ error: "No user profile found" }, 404);
    }

    let linkedinData = null;
    let portfolioData = null;

    if (profile.linkedin_url) {
      try {
        linkedinData = await scrapeLinkedInProfile(profile.linkedin_url);
      } catch (error) {
        console.error("Failed to scrape LinkedIn:", error);
      }
    }

    if (profile.portfolio_url) {
      try {
        portfolioData = await scrapePortfolioSite(profile.portfolio_url);
      } catch (error) {
        console.error("Failed to scrape portfolio:", error);
      }
    }

    const synthesized = await buildCandidateContext(
      { profile, linkedinData, portfolioData },
      { provider, apiKey, model }
    );

    const existingContext = getCandidateContext(db, profile.id);

    const now = new Date().toISOString();
    const contextData = {
      ...synthesized,
      linkedin_scraped_at: profile.linkedin_url ? now : null,
      portfolio_scraped_at: profile.portfolio_url ? now : null,
      resume_parsed_at: profile.resume_text ? now : null,
    };

    let candidateContext;
    if (existingContext) {
      candidateContext = updateCandidateContext(db, existingContext.id, contextData);
    } else {
      candidateContext = createCandidateContext(db, profile.id, contextData);
    }

    return c.json(candidateContext);
  } catch (error) {
    console.error("Failed to refresh candidate context:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

app.get("/api/candidate-context", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const profile = getUserProfile(db);
  
  if (!profile) {
    return c.json({ error: "No user profile found" }, 404);
  }
  
  const context = getCandidateContext(db, profile.id);
  
  if (!context) {
    return c.json({ error: "No candidate context found. Please refresh to generate." }, 404);
  }
  
  return c.json(context);
});

app.get("/api/applications/:id/interviews", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const applicationId = c.req.param("id");
  const interviews = getInterviewsByApplication(db, applicationId);
  
  return c.json(interviews);
});

app.post("/api/applications/:id/interviews", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const applicationId = c.req.param("id");
  const body = await c.req.json();
  
  const interview = createInterview(db, {
    application_id: applicationId,
    scheduled_at: body.scheduled_at,
    interview_type: body.interview_type,
    interviewer_name: body.interviewer_name,
    interviewer_title: body.interviewer_title,
    notes: body.notes,
    outcome: body.outcome,
    duration_minutes: body.duration_minutes,
    location: body.location,
    video_link: body.video_link,
    google_calendar_event_id: body.google_calendar_event_id,
  });
  
  return c.json(interview);
});

app.put("/api/interviews/:id", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const interviewId = c.req.param("id");
  const body = await c.req.json();
  
  const interview = updateInterview(db, interviewId, body);
  
  return c.json(interview);
});

app.delete("/api/interviews/:id", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const interviewId = c.req.param("id");
  
  deleteInterview(db, interviewId);
  
  return c.json({ success: true });
});

app.get("/api/roles/:roleId/questions", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const roleId = c.req.param("roleId");
  const questions = getQuestionsByRoleId(db, roleId);
  return c.json(questions);
});

app.post("/api/roles/:roleId/questions/generate", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const roleId = c.req.param("roleId");
  const body = await c.req.json<{ question: string }>();
  
  if (!body.question?.trim()) {
    return c.json({ error: "Question is required" }, 400);
  }
  
  const role = getRoleById(db, roleId);
  if (!role) return c.json({ error: "Role not found" }, 404);
  
  const company = db.query<{ name: string }, [string]>(
    "SELECT name FROM companies WHERE id = ?"
  ).get(role.company_id);
  const companyName = company?.name || 'Unknown Company';
  
  const userProfile = getUserProfile(db);
  if (!userProfile) return c.json({ error: "No user profile found" }, 404);
  
  const candidateContext = getCandidateContext(db, userProfile.id);
  const { apiKey, error, provider, model } = resolveLlmCredentials(root);
  
  if (!apiKey || !provider || !model) {
    return c.json({ error: error ?? "LLM API key not configured" }, 500);
  }
  
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
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const roleId = c.req.param("roleId");
  const body = await c.req.json<{ question: string; generated_answer?: string; submitted_answer?: string }>();
  
  if (!body.question?.trim()) {
    return c.json({ error: "Question is required" }, 400);
  }
  
  try {
    const question = createQuestion(db, roleId, body.question, body.generated_answer || null);
    
    if (body.submitted_answer) {
      updateQuestion(db, question.id, { submitted_answer: body.submitted_answer });
    }
    
    return c.json(question);
  } catch (error) {
    console.error("Failed to create question:", error);
    return c.json({ error: "Failed to save question" }, 500);
  }
});

app.put("/api/questions/:questionId", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const questionId = c.req.param("questionId");
  const body = await c.req.json<{ generated_answer?: string; submitted_answer?: string }>();
  
  const updated = updateQuestion(db, questionId, body);
  if (!updated) return c.json({ error: "Question not found" }, 404);
  
  return c.json(updated);
});

app.delete("/api/questions/:questionId", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const questionId = c.req.param("questionId");
  
  deleteQuestion(db, questionId);
  return c.json({ success: true });
});

app.get("/api/backup", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const dbFile = dbPath(root);
  const file = Bun.file(dbFile);
  
  if (!await file.exists()) {
    return c.json({ error: "Database file not found" }, 404);
  }
  
  const buffer = await file.arrayBuffer();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `jobsearch-backup-${timestamp}.sqlite`;
  
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/x-sqlite3",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

app.post("/api/restore", async (c) => {
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const formData = await c.req.formData();
  const file = formData.get("backup") as File | null;
  
  if (!file) {
    return c.json({ error: "No backup file provided" }, 400);
  }
  
  if (!file.name.endsWith(".sqlite")) {
    return c.json({ error: "Invalid file type. Expected .sqlite file" }, 400);
  }
  
  const buffer = await file.arrayBuffer();
  
  const header = new Uint8Array(buffer.slice(0, 16));
  const sqliteHeader = "SQLite format 3\0";
  const isValidSqlite = String.fromCharCode(...header) === sqliteHeader;
  
  if (!isValidSqlite) {
    return c.json({ error: "Invalid SQLite database file" }, 400);
  }
  
  const dbFile = dbPath(root);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${dbFile}.pre-restore-${timestamp}`;
  
  const existingDb = Bun.file(dbFile);
  if (await existingDb.exists()) {
    await Bun.write(backupPath, existingDb);
  }
  
  await Bun.write(dbFile, buffer);
  
  return c.json({ 
    success: true, 
    message: "Database restored successfully",
    previousBackup: backupPath 
  });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 180, // 3 minutes timeout for long-running operations like research generation
};

console.log(`Server running at http://localhost:${port}`);

app.post("/api/companies/:id/research", async (c) => {
  const { id } = c.req.param();
  const root = ensureWorkspaceRoot();
  const db = getDb(dbPath(root));
  const { apiKey, error, provider, model } = resolveLlmCredentials(root);
  
  if (!apiKey || !provider || !model) {
    return c.json({ error: error ?? "LLM API key not configured" }, 500);
  }

  const company = getCompanyById(db, id);
  if (!company) return c.json({ error: "Company not found" }, 404);

  const { researchCompany } = await import("./llm/company-research");
  const result = await researchCompany(provider, apiKey, model, company.name);
  
  if (!result) return c.json({ error: "Failed to research company" }, 500);

  const fundingStatus = result.funding_status.type 
    ? JSON.stringify(result.funding_status)
    : null;
  
  const industry = result.industry.primary
    ? JSON.stringify(result.industry)
    : null;
  
  const companySize = result.company_size.employees_estimate
    ? JSON.stringify(result.company_size)
    : null;

  const updated = updateCompany(db, id, {
    website: result.website || company.website || undefined,
    headquarters: result.headquarters.city && result.headquarters.country 
      ? `${result.headquarters.city}, ${result.headquarters.state_province || ''} ${result.headquarters.country}`.trim()
      : company.headquarters || undefined,
    description: result.description || company.description || undefined,
    industry: industry || undefined,
    funding_status: fundingStatus || undefined,
    company_size: companySize || undefined,
    established_date: result.established_date || undefined,
    research_sources: result.sources.length > 0 ? JSON.stringify(result.sources) : undefined
  });

  return c.json({ company: updated, research: result });
});

app.get("/api/interviews/upcoming", (c) => {
  const root = ensureWorkspaceRoot();
  const db = getDb(dbPath(root));
  
  const interviews = db.query<{
    id: string;
    scheduled_at: string;
    interview_type: string | null;
    duration_minutes: number | null;
    location: string | null;
    video_link: string | null;
    role_id: string;
    role_title: string;
    company_name: string;
    company_logo_url: string | null;
  }, []>(`
    SELECT 
      i.id,
      i.scheduled_at,
      i.interview_type,
      i.duration_minutes,
      i.location,
      i.video_link,
      r.id as role_id,
      r.title as role_title,
      c.name as company_name,
      c.logo_url as company_logo_url
    FROM interviews i
    JOIN applications a ON i.application_id = a.id
    JOIN roles r ON a.role_id = r.id
    JOIN companies c ON r.company_id = c.id
    WHERE i.scheduled_at >= datetime('now')
    ORDER BY i.scheduled_at ASC
    LIMIT 10
  `).all();
  
  return c.json(interviews);
});

app.get("/api/oauth/google/status", (c) => {
  const root = ensureWorkspaceRoot();
  const db = getDb(dbPath(root));
  const secrets = loadSecrets();
  const profile = getUserProfile(db);
  
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

app.get("/api/oauth/google/authorize", (c) => {
  void ensureWorkspaceRoot();
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
  
  const root = ensureWorkspaceRoot();
  const db = getDb(dbPath(root));
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
      const profile = getUserProfile(db);
      if (profile) {
        updateUserProfile(db, profile.id, { google_calendar_refresh_token: refreshToken });
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
    const root = ensureWorkspaceRoot();
    const db = getDb(dbPath(root));
    const profile = getUserProfile(db);
    
    if (profile) {
      updateUserProfile(db, profile.id, { google_calendar_refresh_token: null, google_calendar_id: null });
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error("Disconnect error:", error);
    return c.json({ error: String(error) }, 500);
  }
});

app.get("/api/calendars", async (c) => {
  const root = ensureWorkspaceRoot();
  const db = getDb(dbPath(root));
  const secrets = loadSecrets();
  const profile = getUserProfile(db);

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
  const root = ensureWorkspaceRoot();
  const db = getDb(dbPath(root));
  const profile = getUserProfile(db);
  const body = await c.req.json<{ calendarId: string }>();

  if (!profile) {
    return c.json({ error: "No profile found" }, 404);
  }

  updateUserProfile(db, profile.id, { google_calendar_id: body.calendarId });
  return c.json({ success: true });
});

app.get("/api/calendar/events", async (c) => {
  const root = ensureWorkspaceRoot();
  const db = getDb(dbPath(root));
  const secrets = loadSecrets();
  const profile = getUserProfile(db);

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
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const eventId = c.req.param("eventId");
  const body = await c.req.json<{
    role_id: string;
    summary: string;
    startTime: string;
    endTime: string;
    location?: string;
    conferenceLink?: string;
  }>();

  const application = getApplicationByRoleId(db, body.role_id);
  if (!application) {
    return c.json({ error: "No application found for this role" }, 404);
  }

  const startDate = new Date(body.startTime);
  const endDate = new Date(body.endTime);
  const durationMins = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

  const interview = createInterview(db, {
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
  const root = ensureWorkspaceRoot();
  if (!root) return c.json({ error: "Workspace not initialized" }, 500);
  
  const db = getDb(dbPath(root));
  const interviewId = c.req.param("id");
  const { apiKey, error, provider, model } = resolveLlmCredentials(root);
  
  if (!apiKey || !provider || !model) {
    return c.json({ error: error ?? "LLM API key not configured" }, 500);
  }
  
  const interview = getInterviewById(db, interviewId);
  if (!interview) return c.json({ error: "Interview not found" }, 404);
  
  const application = getApplicationById(db, interview.application_id);
  if (!application) return c.json({ error: "Application not found" }, 404);
  
  const role = getRoleById(db, application.role_id);
  if (!role) return c.json({ error: "Role not found" }, 404);
  
  const company = getCompanyById(db, role.company_id);
  const companyName = company?.name || "Unknown Company";
  
  const userProfile = getUserProfile(db);
  const candidateContext = userProfile ? getCandidateContext(db, userProfile.id) : null;
  
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
  const root = ensureWorkspaceRoot();
  const db = getDb(dbPath(root));
  const secrets = loadSecrets();
  const profile = getUserProfile(db);
  
  const refreshToken = secrets.google_calendar_refresh_token || profile?.google_calendar_refresh_token;
  
  if (!secrets.google_calendar_client_id || !secrets.google_calendar_client_secret || !refreshToken) {
    return c.json({ error: "Google Calendar not connected" }, 400);
  }
  
  const interview = getInterviewById(db, id);
  if (!interview) {
    return c.json({ error: "Interview not found" }, 404);
  }
  
  const role = db.query<{ title: string; company_name: string }, [string]>(
    `SELECT r.title, c.name as company_name 
     FROM roles r 
     JOIN applications a ON r.application_id = a.id 
     JOIN companies c ON r.company_id = c.id 
     WHERE a.id = ?`
  ).get(interview.application_id);
  
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
    ? interview.interview_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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
        updateInterview(db, id, { google_calendar_event_id: eventId });
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
  const root = ensureWorkspaceRoot();
  const db = getDb(dbPath(root));
  const secrets = loadSecrets();
  const profile = getUserProfile(db);
  
  const interview = getInterviewById(db, id);
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
    
    updateInterview(db, id, { google_calendar_event_id: undefined });
    return c.json({ success: true });
  } catch (error) {
    console.error("Calendar delete error:", error);
    return c.json({ error: String(error) }, 500);
  }
});

app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));
