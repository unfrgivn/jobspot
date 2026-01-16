import { v4 as uuidv4 } from "uuid";
import type { DbClient } from "./index";

export interface CandidateContext {
  id: string;
  user_profile_id: string;
  executive_summary: string | null;
  key_strengths: string | null;
  leadership_narrative: string | null;
  technical_expertise: string | null;
  impact_highlights: string | null;
  career_trajectory: string | null;
  linkedin_scraped_at: string | null;
  portfolio_scraped_at: string | null;
  resume_parsed_at: string | null;
  full_context: string | null;
  created_at: string;
  updated_at: string;
}

export async function initCandidateContextTable(db: DbClient): Promise<void> {
  await db.unsafe(`
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
      created_at TEXT NOT NULL DEFAULT (now()::text),
      updated_at TEXT NOT NULL DEFAULT (now()::text),
      FOREIGN KEY (user_profile_id) REFERENCES user_profile(id)
    )
  `);
}

export async function getCandidateContext(
  db: DbClient,
  userProfileId: string
): Promise<CandidateContext | null> {
  const rows = (await db.unsafe(
    `SELECT * FROM candidate_context
     WHERE user_profile_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userProfileId]
  )) as CandidateContext[];

  return rows[0] ?? null;
}

export async function createCandidateContext(
  db: DbClient,
  userProfileId: string,
  context: Partial<CandidateContext>
): Promise<CandidateContext> {
  const id = uuidv4();

  const rows = (await db.unsafe(
    `INSERT INTO candidate_context (
      id, user_profile_id, executive_summary, key_strengths,
      leadership_narrative, technical_expertise, impact_highlights,
      career_trajectory, linkedin_scraped_at, portfolio_scraped_at,
      resume_parsed_at, full_context
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
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
  )) as CandidateContext[];

  return rows[0]!;
}

export async function updateCandidateContext(
  db: DbClient,
  id: string,
  updates: Partial<CandidateContext>
): Promise<CandidateContext> {
  const sets: string[] = [];
  const values: Array<string | null> = [];
  let index = 1;

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
      sets.push(`${field} = $${index++}`);
      values.push(updates[field] ?? null);
    }
  }

  if (sets.length > 0) {
    sets.push("updated_at = now()::text");
    values.push(id);
    const query = `UPDATE candidate_context SET ${sets.join(", ")} WHERE id = $${index} RETURNING *`;
    const rows = (await db.unsafe(query, values)) as CandidateContext[];
    return rows[0]!;
  }

  const rows = (await db.unsafe("SELECT * FROM candidate_context WHERE id = $1", [id])) as CandidateContext[];
  return rows[0]!;
}
