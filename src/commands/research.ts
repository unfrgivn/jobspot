import { findRoot, dbPath } from "../workspace";
import { getDb } from "../db";
import { loadConfig, loadSecrets, requireLlmApiKey } from "../config";
import { getRoleWithDetails } from "../db/roles";
import { generateCompanyResearch } from "../llm/research";
import { getUserProfile } from "../db/user_profile";
import { getCandidateContext } from "../db/candidate_context";
import { randomUUID } from "crypto";
import { researchCompany } from "../llm/company-research";
import { updateCompany } from "../db/companies";

export async function generateRoleResearch(roleId: string): Promise<void> {
  const root = findRoot();
  const db = getDb(dbPath(root));
  const config = loadConfig(root);
  const provider = config.llm.provider;

  const secrets = loadSecrets();
  const apiKey = requireLlmApiKey(provider, secrets);

  const roleWithDetails = getRoleWithDetails(db, roleId);
  if (!roleWithDetails) {
    throw new Error("Role not found");
  }

  if (!roleWithDetails.jd_text) {
    throw new Error("No job description available for research");
  }

  const profile = getUserProfile(db);
  if (!profile) {
    throw new Error("User profile not found");
  }

  const candidateContext = getCandidateContext(db, profile.id);
  
  const contextToUse = candidateContext?.full_context || `
CANDIDATE PROFILE:
Name: ${profile.full_name}
Resume: ${profile.resume_text?.slice(0, 3000) || 'Not provided'}
About: ${profile.about_me || 'Not provided'}
  `.trim();

  const existing = db
    .query<{ id: string }, [string]>("SELECT id FROM role_research WHERE role_id = ?")
    .get(roleId);

  const researchId = existing?.id || randomUUID();

  if (!existing) {
    db.run(
      `INSERT INTO role_research (id, role_id, generated_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`,
      [researchId, roleId]
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
      db.run(
        `UPDATE role_research SET company_profile = ?, updated_at = datetime('now') WHERE id = ?`,
        [content, researchId]
      );
    } else if (section === "fit_analysis") {
      db.run(
        `UPDATE role_research SET fit_analysis = ?, updated_at = datetime('now') WHERE id = ?`,
        [content, researchId]
      );
    } else if (section === "interview_questions") {
      db.run(
        `UPDATE role_research SET interview_questions = ?, updated_at = datetime('now') WHERE id = ?`,
        [content, researchId]
      );
    } else if (section === "talking_points") {
      db.run(
        `UPDATE role_research SET talking_points = ?, updated_at = datetime('now') WHERE id = ?`,
        [content, researchId]
      );
    }
  }
}

export async function backfillCompanyResearch(): Promise<{ success: number; failed: number; skipped: number }> {
  const root = findRoot();
  const db = getDb(dbPath(root));
  const config = loadConfig(root);
  const provider = config.llm.provider;

  const secrets = loadSecrets();
  const apiKey = requireLlmApiKey(provider, secrets);

  const companies = db.query<{ id: string; name: string }, []>(
    `SELECT id, name FROM companies WHERE industry IS NULL OR funding_status IS NULL`
  ).all();

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const company of companies) {
    if (company.name.toLowerCase().includes("test") || company.name.toLowerCase().includes("acme")) {
      skipped++;
      continue;
    }

    console.log(`Researching: ${company.name}...`);
    
    try {
      const result = await researchCompany(provider, apiKey, config.llm.model, company.name);
      
      if (result) {
        const fundingStatus = result.funding_status.type 
          ? JSON.stringify(result.funding_status)
          : null;
        const industry = result.industry.primary
          ? JSON.stringify(result.industry)
          : null;
        const companySize = result.company_size.employees_estimate
          ? JSON.stringify(result.company_size)
          : null;

        updateCompany(db, company.id, {
          website: result.website || undefined,
          headquarters: result.headquarters.city && result.headquarters.country 
            ? `${result.headquarters.city}, ${result.headquarters.state_province || ''} ${result.headquarters.country}`.trim()
            : undefined,
          description: result.description || undefined,
          industry: industry || undefined,
          funding_status: fundingStatus || undefined,
          company_size: companySize || undefined,
          established_date: result.established_date || undefined,
          research_sources: result.sources.length > 0 ? JSON.stringify(result.sources) : undefined
        });
        
        console.log(`  ✓ ${company.name}`);
        success++;
      } else {
        console.log(`  ✗ ${company.name} - no results`);
        failed++;
      }
    } catch (error) {
      console.error(`  ✗ ${company.name} - ${error}`);
      failed++;
    }
  }

  return { success, failed, skipped };
}
