import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { findRoot, companiesDir } from "../workspace";
import { getDb } from "../db";
import { loadConfig, loadSecrets, requireLlmApiKey } from "../config";
import { generateCoverLetter } from "../llm/gemini";
import { renderPdf, findLatexEngine } from "../render/pandoc";
import { getUserProfile } from "../db/user_profile";
import { getCandidateContext } from "../db/candidate_context";
import slug from "slug";

export interface ApplyResult {
  applicationId: string;
  pdfPath: string;
  mdPath: string;
}

export async function applyToRole(userId: string, roleId: string): Promise<ApplyResult> {
  const root = findRoot();
  const db = getDb();
  const config = loadConfig(root);
  const provider = config.llm.provider;
  const secrets = loadSecrets();

  let apiKey: string;
  try {
    apiKey = requireLlmApiKey(provider, secrets);
  } catch (error) {
    const message = error instanceof Error ? error.message : "LLM API key not configured";
    throw new Error(`${message}. Run 'jobsearch doctor' for help.`);
  }

  const userProfile = await getUserProfile(db, userId);
  if (!userProfile) {
    throw new Error("No user profile found. Please set up your profile in Settings.");
  }

  const candidateContext = await getCandidateContext(db, userProfile.id);
  const contextToUse = candidateContext?.full_context || userProfile.resume_text || "";

  if (!contextToUse) {
    throw new Error("No resume or candidate context found. Please upload your resume in Settings.");
  }

  const roleRows = (await db.unsafe(
    "SELECT id, title, jd_text, company_id FROM roles WHERE user_id = $1 AND id = $2",
    [userId, roleId]
  )) as Array<{ id: string; title: string; jd_text: string | null; company_id: string }>;
  const role = roleRows[0];

  if (!role) {
    throw new Error(`Role not found: ${roleId}`);
  }

  if (!role.jd_text) {
    throw new Error("No job description for this role. Run: jobsearch paste-jd " + roleId);
  }

  const companyRows = (await db.unsafe(
    "SELECT name FROM companies WHERE user_id = $1 AND id = $2",
    [userId, role.company_id]
  )) as Array<{ name: string }>;
  const company = companyRows[0];

  if (!company) {
    throw new Error("Company not found");
  }

  const now = new Date();
  const dateSlug = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const roleSlug = slug(role.title, { lower: true });
  const companySlug = slug(company.name, { lower: true });

  const appDir = join(companiesDir(root), companySlug, `${roleSlug}_${dateSlug}`, "application");
  mkdirSync(appDir, { recursive: true });

  const coverLetterMd = await generateCoverLetter({
    provider,
    apiKey,
    model: config.llm.model,
    jobDescription: role.jd_text,
    candidateContext: contextToUse,
    companyName: company.name,
    roleTitle: role.title,
  });

  const coverLetterPath = join(appDir, "cover_letter.md");
  writeFileSync(coverLetterPath, coverLetterMd);

  const pdfPath = join(appDir, "cover_letter.pdf");
  const latexEngine = await findLatexEngine();
  const pdfGenerated = await renderPdf(coverLetterPath, pdfPath, latexEngine);

  const applicationId = randomUUID();
  const followupDays = config.defaults.followup_days;
  const followupDate = new Date(now.getTime() + followupDays * 24 * 60 * 60 * 1000);

  await db.unsafe(
    `INSERT INTO applications (id, user_id, role_id, status, applied_at, next_followup_at)
     VALUES ($1, $2, $3, 'applied', $4, $5)`,
    [applicationId, userId, roleId, new Date().toISOString(), followupDate.toISOString()]
  );

  await db.unsafe(
    "INSERT INTO artifacts (id, user_id, application_id, kind, path) VALUES ($1, $2, $3, 'cover_letter_md', $4)",
    [randomUUID(), userId, applicationId, coverLetterPath]
  );

  if (pdfGenerated) {
    await db.unsafe(
      "INSERT INTO artifacts (id, user_id, application_id, kind, path) VALUES ($1, $2, $3, 'cover_letter_pdf', $4)",
      [randomUUID(), userId, applicationId, pdfPath]
    );
  }

  await db.unsafe(
    "INSERT INTO tasks (id, user_id, application_id, kind, due_at, status) VALUES ($1, $2, $3, 'followup', $4, 'pending')",
    [randomUUID(), userId, applicationId, followupDate.toISOString()]
  );

  await db.unsafe(
    "INSERT INTO events (id, user_id, application_id, event_type, payload_json) VALUES ($1, $2, $3, 'applied', $4)",
    [randomUUID(), userId, applicationId, JSON.stringify({})]
  );

  return {
    applicationId,
    pdfPath,
    mdPath: coverLetterPath,
  };
}

export async function apply(_roleId: string): Promise<void> {
  console.error("CLI commands are disabled. Use the web UI.");
  process.exit(1);
}
