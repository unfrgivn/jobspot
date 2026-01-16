import type { Database } from "bun:sqlite";
import { v4 as uuidv4 } from "uuid";

export interface CandidateContext {
  id: string;
  user_profile_id: string;
  
  // AI-synthesized context sections
  executive_summary: string | null;
  key_strengths: string | null;
  leadership_narrative: string | null;
  technical_expertise: string | null;
  impact_highlights: string | null;
  career_trajectory: string | null;
  
  // Source metadata
  linkedin_scraped_at: string | null;
  portfolio_scraped_at: string | null;
  resume_parsed_at: string | null;
  
  // Full context blob for AI prompts
  full_context: string | null;
  
  created_at: string;
  updated_at: string;
}

export function initCandidateContextTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS candidate_context (
      id TEXT PRIMARY KEY,
      user_profile_id TEXT NOT NULL,
      executive_summary TEXT,
      key_strengths TEXT,
      leadership_narrative TEXT,
      technical_expertise TEXT,
      impact_highlights TEXT,
      career_trajectory TEXT,
      linkedin_scraped_at TEXT,
      portfolio_scraped_at TEXT,
      resume_parsed_at TEXT,
      full_context TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_profile_id) REFERENCES user_profile(id)
    )
  `);
}

export function getCandidateContext(db: Database, userProfileId: string): CandidateContext | null {
  const row = db.query(`
    SELECT * FROM candidate_context 
    WHERE user_profile_id = ? 
    ORDER BY updated_at DESC 
    LIMIT 1
  `).get(userProfileId);
  
  return row as CandidateContext | null;
}

export function createCandidateContext(
  db: Database,
  userProfileId: string,
  context: Partial<CandidateContext>
): CandidateContext {
  const id = uuidv4();
  
  db.run(
    `INSERT INTO candidate_context (
      id, user_profile_id, executive_summary, key_strengths, 
      leadership_narrative, technical_expertise, impact_highlights, 
      career_trajectory, linkedin_scraped_at, portfolio_scraped_at, 
      resume_parsed_at, full_context
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userProfileId,
      context.executive_summary || null,
      context.key_strengths || null,
      context.leadership_narrative || null,
      context.technical_expertise || null,
      context.impact_highlights || null,
      context.career_trajectory || null,
      context.linkedin_scraped_at || null,
      context.portfolio_scraped_at || null,
      context.resume_parsed_at || null,
      context.full_context || null,
    ]
  );
  
  return getCandidateContext(db, userProfileId)!;
}

export function updateCandidateContext(
  db: Database,
  id: string,
  updates: Partial<CandidateContext>
): CandidateContext {
  const sets: string[] = [];
  const values: any[] = [];
  
  const fields = [
    "executive_summary",
    "key_strengths",
    "leadership_narrative",
    "technical_expertise",
    "impact_highlights",
    "career_trajectory",
    "linkedin_scraped_at",
    "portfolio_scraped_at",
    "resume_parsed_at",
    "full_context",
  ] as const;
  
  for (const field of fields) {
    if (updates[field] !== undefined) {
      sets.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }
  
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    db.run(`UPDATE candidate_context SET ${sets.join(", ")} WHERE id = ?`, values);
  }
  
  const row = db.query(`SELECT * FROM candidate_context WHERE id = ?`).get(id);
  return row as CandidateContext;
}
