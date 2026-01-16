import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";

export interface Role {
  id: string;
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

export function getAllRoles(db: Database): RoleWithCompany[] {
  return db
    .query<RoleWithCompany, []>(
      `SELECT r.*, c.name as company_name
       FROM roles r
       JOIN companies c ON r.company_id = c.id
       ORDER BY r.created_at DESC`
    )
    .all();
}

export function getRoleById(db: Database, id: string): Role | null {
  return db.query<Role, [string]>("SELECT * FROM roles WHERE id = ?").get(id) ?? null;
}

export function getRoleWithDetails(db: Database, id: string): RoleWithDetails | null {
  return (
    db
      .query<RoleWithDetails, [string]>(
        `SELECT r.*, c.name as company_name, c.website as company_website,
                c.headquarters as company_headquarters, c.description as company_description,
                c.logo_url as company_logo_url,
                a.id as application_id, a.status as application_status, a.applied_at
         FROM roles r
         JOIN companies c ON r.company_id = c.id
         LEFT JOIN applications a ON a.role_id = r.id
         WHERE r.id = ?`
      )
      .get(id) ?? null
  );
}

export function createRole(db: Database, input: CreateRoleInput): Role {
  const id = randomUUID();
  db.run(
    `INSERT INTO roles (id, company_id, title, level, location, job_url, jd_text, source, compensation_range, compensation_min, compensation_max)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
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
    ]
  );
  return getRoleById(db, id)!;
}

export function updateRole(db: Database, id: string, input: Partial<CreateRoleInput>): Role {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

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
      sets.push(`${field} = ?`);
      values.push(input[field] ?? null);
    }
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    db.run(`UPDATE roles SET ${sets.join(", ")} WHERE id = ?`, values);
  }

  return getRoleById(db, id)!;
}

export function updateRoleJd(db: Database, id: string, jdText: string): Role {
  db.run("UPDATE roles SET jd_text = ?, updated_at = datetime('now') WHERE id = ?", [jdText, id]);
  return getRoleById(db, id)!;
}

export function findDuplicateRole(
  db: Database,
  jobUrl: string | null,
  companyId: string,
  title: string
): Role | null {
  if (jobUrl) {
    const byUrl = db
      .query<Role, [string]>("SELECT * FROM roles WHERE job_url = ?")
      .get(jobUrl);
    if (byUrl) return byUrl;
  }

  const byCompanyTitle = db
    .query<Role, [string, string]>(
      "SELECT * FROM roles WHERE company_id = ? AND title = ?"
    )
    .get(companyId, title);
  
  return byCompanyTitle ?? null;
}

export function deleteRole(db: Database, id: string): boolean {
  db.run("DELETE FROM role_research WHERE role_id = ?", [id]);
  db.run("DELETE FROM application_questions WHERE role_id = ?", [id]);
  db.run("DELETE FROM interviews WHERE application_id IN (SELECT id FROM applications WHERE role_id = ?)", [id]);
  db.run("DELETE FROM tasks WHERE application_id IN (SELECT id FROM applications WHERE role_id = ?)", [id]);
  db.run("DELETE FROM applications WHERE role_id = ?", [id]);
  db.run("DELETE FROM roles WHERE id = ?", [id]);
  return true;
}
