import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";

export type ApplicationStatus =
  | "wishlist"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

export interface Application {
  id: string;
  role_id: string;
  status: ApplicationStatus;
  applied_at: string | null;
  via: string | null;
  next_followup_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationWithRole extends Application {
  role_title: string;
  company_name: string;
  job_url: string | null;
  location: string | null;
  compensation_range: string | null;
}

export interface CreateApplicationInput {
  role_id: string;
  status?: ApplicationStatus;
  via?: string;
  notes?: string;
}

export interface UpdateApplicationInput {
  status?: ApplicationStatus;
  applied_at?: string;
  via?: string;
  next_followup_at?: string;
  notes?: string;
  created_at?: string;
}

export interface PipelineStats {
  wishlist: number;
  applied: number;
  interviewing: number;
  offer: number;
  rejected: number;
  withdrawn: number;
  total: number;
}

export function getAllApplications(db: Database): ApplicationWithRole[] {
  return db
    .query<ApplicationWithRole, []>(
      `SELECT a.*, r.title as role_title, r.job_url, r.location, r.compensation_range, c.name as company_name, c.logo_url as company_logo_url
       FROM applications a
       JOIN roles r ON a.role_id = r.id
       JOIN companies c ON r.company_id = c.id
       ORDER BY a.created_at DESC`
    )
    .all();
}

export function getApplicationById(db: Database, id: string): ApplicationWithRole | null {
  return (
    db
      .query<ApplicationWithRole, [string]>(
        `SELECT a.*, r.title as role_title, r.job_url, r.location, r.compensation_range, c.name as company_name, c.logo_url as company_logo_url
         FROM applications a
         JOIN roles r ON a.role_id = r.id
         JOIN companies c ON r.company_id = c.id
         WHERE a.id = ?`
      )
      .get(id) ?? null
  );
}

export function getApplicationsByStatus(db: Database, status: string): ApplicationWithRole[] {
  return db
    .query<ApplicationWithRole, [string]>(
      `SELECT a.*, r.title as role_title, r.job_url, r.location, r.compensation_range, c.name as company_name, c.logo_url as company_logo_url
       FROM applications a
       JOIN roles r ON a.role_id = r.id
       JOIN companies c ON r.company_id = c.id
       WHERE a.status = ?
       ORDER BY a.created_at DESC`
    )
    .all(status);
}

export function getApplicationByRoleId(db: Database, roleId: string): Application | null {
  return (
    db
      .query<Application, [string]>("SELECT * FROM applications WHERE role_id = ?")
      .get(roleId) ?? null
  );
}

export function createApplication(db: Database, input: CreateApplicationInput): Application {
  const id = randomUUID();
  db.run(
    `INSERT INTO applications (id, role_id, status, via, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.role_id, input.status ?? "wishlist", input.via ?? null, input.notes ?? null]
  );
  return db.query<Application, [string]>("SELECT * FROM applications WHERE id = ?").get(id)!;
}

export function updateApplication(
  db: Database,
  id: string,
  input: UpdateApplicationInput
): ApplicationWithRole {
  const sets: string[] = [];
  const values: (string | null)[] = [];

  // Auto-set applied_at when status changes to "applied" (if not explicitly provided)
  if (input.status === "applied" && input.applied_at === undefined) {
    const currentApp = db.query<Application, [string]>("SELECT * FROM applications WHERE id = ?").get(id);
    if (currentApp && !currentApp.applied_at) {
      input.applied_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
    }
  }

  if (input.status !== undefined) {
    sets.push("status = ?");
    values.push(input.status);
  }
  if (input.applied_at !== undefined) {
    sets.push("applied_at = ?");
    values.push(input.applied_at);
  }
  if (input.via !== undefined) {
    sets.push("via = ?");
    values.push(input.via);
  }
  if (input.next_followup_at !== undefined) {
    sets.push("next_followup_at = ?");
    values.push(input.next_followup_at);
  }
  if (input.notes !== undefined) {
    sets.push("notes = ?");
    values.push(input.notes);
  }
  if (input.created_at !== undefined) {
    sets.push("created_at = ?");
    values.push(input.created_at);
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    db.run(`UPDATE applications SET ${sets.join(", ")} WHERE id = ?`, values);
  }

  return getApplicationById(db, id)!;
}

export function getPipelineStats(db: Database): PipelineStats {
  const rows = db
    .query<{ status: string; count: number }, []>(
      "SELECT status, COUNT(*) as count FROM applications GROUP BY status"
    )
    .all();

  const stats: PipelineStats = {
    wishlist: 0,
    applied: 0,
    interviewing: 0,
    offer: 0,
    rejected: 0,
    withdrawn: 0,
    total: 0,
  };

  for (const row of rows) {
    if (row.status in stats) {
      stats[row.status as keyof Omit<PipelineStats, "total">] = row.count;
    }
    stats.total += row.count;
  }

  return stats;
}
