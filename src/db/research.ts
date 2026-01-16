import { randomUUID } from "node:crypto";
import type { DbClient } from "./index";

export interface RoleResearch {
  id: string;
  role_id: string;
  company_profile: string | null;
  fit_analysis: string | null;
  interview_questions: string | null;
  talking_points: string | null;
  generated_at: string;
  updated_at: string;
}

export async function getResearchByRoleId(
  db: DbClient,
  userId: string,
  roleId: string
): Promise<RoleResearch | null> {
  const rows = (await db.unsafe(
    "SELECT * FROM role_research WHERE user_id = $1 AND role_id = $2",
    [userId, roleId]
  )) as RoleResearch[];
  return rows[0] ?? null;
}

export async function createResearch(
  db: DbClient,
  userId: string,
  roleId: string
): Promise<RoleResearch> {
  const id = randomUUID();
  const rows = (await db.unsafe(
    "INSERT INTO role_research (id, user_id, role_id) VALUES ($1, $2, $3) RETURNING *",
    [id, userId, roleId]
  )) as RoleResearch[];
  return rows[0]!;
}

export async function updateResearch(
  db: DbClient,
  userId: string,
  roleId: string,
  updates: {
    company_profile?: string;
    fit_analysis?: string;
    interview_questions?: string;
    talking_points?: string;
  }
): Promise<RoleResearch> {
  const sets: string[] = [];
  const values: (string | null)[] = [];
  let index = 1;

  if (updates.company_profile !== undefined) {
    sets.push(`company_profile = $${index++}`);
    values.push(updates.company_profile);
  }
  if (updates.fit_analysis !== undefined) {
    sets.push(`fit_analysis = $${index++}`);
    values.push(updates.fit_analysis);
  }
  if (updates.interview_questions !== undefined) {
    sets.push(`interview_questions = $${index++}`);
    values.push(updates.interview_questions);
  }
  if (updates.talking_points !== undefined) {
    sets.push(`talking_points = $${index++}`);
    values.push(updates.talking_points);
  }

  if (sets.length > 0) {
    sets.push("updated_at = now()::text");
    values.push(userId, roleId);
    const query = `UPDATE role_research SET ${sets.join(", ")} WHERE user_id = $${index} AND role_id = $${index + 1} RETURNING *`;
    const rows = (await db.unsafe(query, values)) as RoleResearch[];
    return rows[0]!;
  }

  const rows = (await db.unsafe(
    "SELECT * FROM role_research WHERE user_id = $1 AND role_id = $2",
    [userId, roleId]
  )) as RoleResearch[];
  return rows[0]!;
}

export async function getOrCreateResearch(
  db: DbClient,
  userId: string,
  roleId: string
): Promise<RoleResearch> {
  const existing = await getResearchByRoleId(db, userId, roleId);
  return existing ?? createResearch(db, userId, roleId);
}
