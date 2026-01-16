import { getDb } from "../db";
import { loadConfig, loadSecrets, requireLlmApiKey } from "../config";
import { getRoleWithDetails } from "../db/roles";
import { generateCompanyResearch } from "../llm/research";
import { getUserProfile } from "../db/user_profile";
import { getCandidateContext } from "../db/candidate_context";
import { randomUUID } from "crypto";
import { researchCompany } from "../llm/company-research";
import { updateCompany } from "../db/companies";
import { findRoot } from "../workspace";

export async function generateRoleResearch(userId: string, roleId: string): Promise<void> {
  const root = findRoot();
  const db = getDb();
  const localUser = { id: userId };
  const config = loadConfig(root);
  const provider = config.llm.provider;

  const secrets = loadSecrets();
  const apiKey = requireLlmApiKey(provider, secrets);

  const roleWithDetails = await getRoleWithDetails(db, localUser.id, roleId);
  if (!roleWithDetails) {
    throw new Error("Role not found");
  }

  if (!roleWithDetails.jd_text) {
    throw new Error("No job description available for research");
  }

  const profile = await getUserProfile(db, localUser.id);
  if (!profile) {
    throw new Error("User profile not found");
  }

  const candidateContext = await getCandidateContext(db, profile.id);
  
  const contextToUse = candidateContext?.full_context || `
CANDIDATE PROFILE:
Name: ${profile.full_name}
Resume: ${profile.resume_text?.slice(0, 3000) || 'Not provided'}
About: ${profile.about_me || 'Not provided'}
  `.trim();

  const existingRows = (await db.unsafe(
    "SELECT id FROM role_research WHERE user_id = $1 AND role_id = $2",
    [localUser.id, roleId]
  )) as Array<{ id: string }>;
  const existing = existingRows[0];

  const researchId = existing?.id || randomUUID();

  if (!existing) {
    await db.unsafe(
      "INSERT INTO role_research (id, user_id, role_id, generated_at, updated_at) VALUES ($1, $2, $3, now()::text, now()::text)",
      [researchId, localUser.id, roleId]
    );
  }

  const generator = generateCompanyResearch({
    provider,
    apiKey,
    model: config.llm.model,
    companyName: roleWithDetails.company_name,
    companyWebsite: roleWithDetails.company_website || "",
    companyDescription: roleWithDetails.company_description || "",
    companyHeadquarters: roleWithDetails.company_headquarters || "",
    roleTitle: roleWithDetails.title,
    jobDescription: roleWithDetails.jd_text,
    candidateContext: contextToUse,
  });

  for await (const { section, content } of generator) {
    if (section === "company_profile") {
      await db.unsafe(
        "UPDATE role_research SET company_profile = $1, updated_at = now()::text WHERE user_id = $2 AND id = $3",
        [content, localUser.id, researchId]
      );
    } else if (section === "fit_analysis") {
      await db.unsafe(
        "UPDATE role_research SET fit_analysis = $1, updated_at = now()::text WHERE user_id = $2 AND id = $3",
        [content, localUser.id, researchId]
      );
    } else if (section === "interview_questions") {
      await db.unsafe(
        "UPDATE role_research SET interview_questions = $1, updated_at = now()::text WHERE user_id = $2 AND id = $3",
        [content, localUser.id, researchId]
      );
    } else if (section === "talking_points") {
      await db.unsafe(
        "UPDATE role_research SET talking_points = $1, updated_at = now()::text WHERE user_id = $2 AND id = $3",
        [content, localUser.id, researchId]
      );
    }
  }
}

export async function backfillCompanyResearch(): Promise<{ success: number; failed: number; skipped: number }> {
  console.error("CLI commands are disabled. Use the web UI.");
  process.exit(1);
}

