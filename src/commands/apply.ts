import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { findRoot, dbPath, companiesDir } from "../workspace";
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

export async function applyToRole(roleId: string): Promise<ApplyResult> {
  const root = findRoot();
  const db = getDb(dbPath(root));
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

  const userProfile = getUserProfile(db);
  if (!userProfile) {
    throw new Error("No user profile found. Please set up your profile in Settings.");
  }

  const candidateContext = getCandidateContext(db, userProfile.id);
  const contextToUse = candidateContext?.full_context || userProfile.resume_text || "";

  if (!contextToUse) {
    throw new Error("No resume or candidate context found. Please upload your resume in Settings.");
  }

  const role = db
    .query<
      {
        id: string;
        title: string;
        jd_text: string | null;
        company_id: string;
      },
      [string]
    >("SELECT id, title, jd_text, company_id FROM roles WHERE id = ?")
    .get(roleId);

  if (!role) {
    throw new Error(`Role not found: ${roleId}`);
  }

  if (!role.jd_text) {
    throw new Error("No job description for this role. Run: jobsearch paste-jd " + roleId);
  }

  const company = db
    .query<{ name: string }, [string]>("SELECT name FROM companies WHERE id = ?")
    .get(role.company_id);

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

  db.run(
    `INSERT INTO applications (id, role_id, status, applied_at, next_followup_at)
     VALUES (?, ?, 'applied', datetime('now'), ?)`,
    [applicationId, roleId, followupDate.toISOString()]
  );

  db.run(`INSERT INTO artifacts (id, application_id, kind, path) VALUES (?, ?, 'cover_letter_md', ?)`, [
    randomUUID(),
    applicationId,
    coverLetterPath,
  ]);

  if (pdfGenerated) {
    db.run(`INSERT INTO artifacts (id, application_id, kind, path) VALUES (?, ?, 'cover_letter_pdf', ?)`, [
      randomUUID(),
      applicationId,
      pdfPath,
    ]);
  }

  db.run(`INSERT INTO tasks (id, application_id, kind, due_at, status) VALUES (?, ?, 'followup', ?, 'pending')`, [
    randomUUID(),
    applicationId,
    followupDate.toISOString(),
  ]);

  db.run(`INSERT INTO events (id, application_id, event_type, payload_json) VALUES (?, ?, 'applied', ?)`, [
    randomUUID(),
    applicationId,
    JSON.stringify({}),
  ]);

  return {
    applicationId,
    pdfPath,
    mdPath: coverLetterPath,
  };
}

export async function apply(roleId: string): Promise<void> {
  try {
    const result = await applyToRole(roleId);
    console.log(`\nApplication created: ${result.applicationId}`);
    console.log(`Cover letter: ${result.pdfPath}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
