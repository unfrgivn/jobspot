import { randomUUID } from "crypto";
import type { DbClient } from "./index";

export interface Role {
  id: string;
  user_id: string;
  company_id: string;
  title: string;
  level: string | null;
  location: string | null;
  job_url: string | null;
  jd_text: string | null;
  source: string | null;
  compensation_range: string | null;
  compensation_min: number | null;
  compensation_max: number | null;
  linkedin_message: string | null;
  cover_letter: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleWithCompany extends Role {
  company_name: string;
}

export interface RoleWithDetails extends RoleWithCompany {
  application_id: string | null;
  application_status: string | null;
  applied_at: string | null;
  company_website: string | null;
  company_headquarters: string | null;
  company_description: string | null;
  company_logo_url: string | null;
}

export interface CreateRoleInput {
  company_id: string;
  title: string;
  level?: string;
  location?: string;
  job_url?: string;
  jd_text?: string;
  source?: string;
  compensation_range?: string;
  compensation_min?: number;
  compensation_max?: number;
  linkedin_message?: string;
  cover_letter?: string;
}

export async function getAllRoles(db: DbClient, userId: string): Promise<RoleWithCompany[]> {
  const rows = (await db.unsafe(
    `SELECT r.*, c.name as company_name
     FROM roles r
     JOIN companies c ON r.company_id = c.id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC`,
    [userId]
  )) as RoleWithCompany[];

  return rows;
}

export async function getRoleById(
  db: DbClient,
  userId: string,
  id: string
): Promise<Role | null> {
  const rows = (await db.unsafe(
    "SELECT * FROM roles WHERE user_id = $1 AND id = $2",
    [userId, id]
  )) as Role[];
  return rows[0] ?? null;
}

export async function getRoleWithDetails(
  db: DbClient,
  userId: string,
  id: string
): Promise<RoleWithDetails | null> {
  const rows = (await db.unsafe(
    `SELECT r.*, c.name as company_name, c.website as company_website,
            c.headquarters as company_headquarters, c.description as company_description,
            c.logo_url as company_logo_url,
            a.id as application_id, a.status as application_status, a.applied_at
     FROM roles r
     JOIN companies c ON r.company_id = c.id
     LEFT JOIN applications a ON a.role_id = r.id AND a.user_id = $1
     WHERE r.user_id = $1 AND r.id = $2`,
    [userId, id]
  )) as RoleWithDetails[];

  return rows[0] ?? null;
}

export async function createRole(
  db: DbClient,
  userId: string,
  input: CreateRoleInput
): Promise<Role> {
  const id = randomUUID();
  const rows = (await db.unsafe(
    `INSERT INTO roles (id, user_id, company_id, title, level, location, job_url, jd_text, source, compensation_range, compensation_min, compensation_max, linkedin_message, cover_letter)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      id,
      userId,
      input.company_id,
      input.title,
      input.level ?? null,
      input.location ?? null,
      input.job_url ?? null,
      input.jd_text ?? null,
      input.source ?? null,
      input.compensation_range ?? null,
      input.compensation_min ?? null,
      input.compensation_max ?? null,
      input.linkedin_message ?? null,
      input.cover_letter ?? null,
    ]
  )) as Role[];

  return rows[0]!;
}

export async function updateRole(
  db: DbClient,
  userId: string,
  id: string,
  input: Partial<CreateRoleInput>
): Promise<Role> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  let index = 1;

  const fields: (keyof CreateRoleInput)[] = [
    "title",
    "level",
    "location",
    "job_url",
    "jd_text",
    "source",
    "compensation_range",
    "compensation_min",
    "compensation_max",
    "linkedin_message",
    "cover_letter",
  ];

  for (const field of fields) {
    if (input[field] !== undefined) {
      sets.push(`${field} = $${index++}`);
      values.push(input[field] ?? null);
    }
  }

  if (sets.length > 0) {
    sets.push("updated_at = now()::text");
    values.push(userId, id);
    const query = `UPDATE roles SET ${sets.join(", ")} WHERE user_id = $${index} AND id = $${index + 1} RETURNING *`;
    const rows = (await db.unsafe(query, values)) as Role[];
    return rows[0]!;
  }

  const rows = (await db.unsafe(
    "SELECT * FROM roles WHERE user_id = $1 AND id = $2",
    [userId, id]
  )) as Role[];
  return rows[0]!;
}

export async function updateRoleJd(
  db: DbClient,
  userId: string,
  id: string,
  jdText: string
): Promise<Role> {
  const rows = (await db.unsafe(
    "UPDATE roles SET jd_text = $1, updated_at = now()::text WHERE user_id = $2 AND id = $3 RETURNING *",
    [jdText, userId, id]
  )) as Role[];

  return rows[0]!;
}

export async function findDuplicateRole(
  db: DbClient,
  userId: string,
  jobUrl: string | null,
  companyId: string,
  title: string
): Promise<Role | null> {
  if (jobUrl) {
    const rows = (await db.unsafe(
      "SELECT * FROM roles WHERE user_id = $1 AND job_url = $2",
      [userId, jobUrl]
    )) as Role[];
    if (rows[0]) return rows[0];
  }

  const rows = (await db.unsafe(
    "SELECT * FROM roles WHERE user_id = $1 AND company_id = $2 AND title = $3",
    [userId, companyId, title]
  )) as Role[];

  return rows[0] ?? null;
}

export async function deleteRole(
  db: DbClient,
  userId: string,
  id: string
): Promise<boolean> {
  await db.unsafe("DELETE FROM role_research WHERE user_id = $1 AND role_id = $2", [userId, id]);
  await db.unsafe("DELETE FROM application_questions WHERE user_id = $1 AND role_id = $2", [userId, id]);
  await db.unsafe(
    "DELETE FROM interviews WHERE user_id = $1 AND application_id IN (SELECT id FROM applications WHERE user_id = $1 AND role_id = $2)",
    [userId, id]
  );
  await db.unsafe(
    "DELETE FROM tasks WHERE user_id = $1 AND application_id IN (SELECT id FROM applications WHERE user_id = $1 AND role_id = $2)",
    [userId, id]
  );
  await db.unsafe("DELETE FROM applications WHERE user_id = $1 AND role_id = $2", [userId, id]);
  await db.unsafe("DELETE FROM roles WHERE user_id = $1 AND id = $2", [userId, id]);
  return true;
}
