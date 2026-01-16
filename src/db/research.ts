import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

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

export function getResearchByRoleId(db: Database, roleId: string): RoleResearch | null {
  return (
    db
      .query<RoleResearch, [string]>("SELECT * FROM role_research WHERE role_id = ?")
      .get(roleId) ?? null
  );
}

export function createResearch(db: Database, roleId: string): RoleResearch {
  const id = randomUUID();
  db.run(
    "INSERT INTO role_research (id, role_id) VALUES (?, ?)",
    [id, roleId]
  );
  return getResearchByRoleId(db, roleId)!;
}

export function updateResearch(
  db: Database,
  roleId: string,
  updates: {
    company_profile?: string;
    fit_analysis?: string;
    interview_questions?: string;
    talking_points?: string;
  }
): RoleResearch {
  const sets: string[] = [];
  const values: (string | null)[] = [];

  if (updates.company_profile !== undefined) {
    sets.push("company_profile = ?");
    values.push(updates.company_profile);
  }
  if (updates.fit_analysis !== undefined) {
    sets.push("fit_analysis = ?");
    values.push(updates.fit_analysis);
  }
  if (updates.interview_questions !== undefined) {
    sets.push("interview_questions = ?");
    values.push(updates.interview_questions);
  }
  if (updates.talking_points !== undefined) {
    sets.push("talking_points = ?");
    values.push(updates.talking_points);
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(roleId);
    db.run(
      `UPDATE role_research SET ${sets.join(", ")} WHERE role_id = ?`,
      values
    );
  }

  return getResearchByRoleId(db, roleId)!;
}

export function getOrCreateResearch(db: Database, roleId: string): RoleResearch {
  const existing = getResearchByRoleId(db, roleId);
  return existing ?? createResearch(db, roleId);
}
