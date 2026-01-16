import { randomUUID } from "crypto";
import type { DbClient } from "./index";

export type ApplicationStatus =
  | "wishlist"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

export interface Application {
  id: string;
  user_id: string;
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
  company_logo_url?: string | null;
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

export async function getAllApplications(
  db: DbClient,
  userId: string
): Promise<ApplicationWithRole[]> {
  const rows = (await db.unsafe(
    `SELECT a.*, r.title as role_title, r.job_url, r.location, r.compensation_range, c.name as company_name, c.logo_url as company_logo_url
     FROM applications a
     JOIN roles r ON a.role_id = r.id
     JOIN companies c ON r.company_id = c.id
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC`,
    [userId]
  )) as ApplicationWithRole[];

  return rows;
}

export async function getApplicationById(
  db: DbClient,
  userId: string,
  id: string
): Promise<ApplicationWithRole | null> {
  const rows = (await db.unsafe(
    `SELECT a.*, r.title as role_title, r.job_url, r.location, r.compensation_range, c.name as company_name, c.logo_url as company_logo_url
     FROM applications a
     JOIN roles r ON a.role_id = r.id
     JOIN companies c ON r.company_id = c.id
     WHERE a.user_id = $1 AND a.id = $2`,
    [userId, id]
  )) as ApplicationWithRole[];

  return rows[0] ?? null;
}

export async function getApplicationsByStatus(
  db: DbClient,
  userId: string,
  status: string
): Promise<ApplicationWithRole[]> {
  const rows = (await db.unsafe(
    `SELECT a.*, r.title as role_title, r.job_url, r.location, r.compensation_range, c.name as company_name, c.logo_url as company_logo_url
     FROM applications a
     JOIN roles r ON a.role_id = r.id
     JOIN companies c ON r.company_id = c.id
     WHERE a.user_id = $1 AND a.status = $2
     ORDER BY a.created_at DESC`,
    [userId, status]
  )) as ApplicationWithRole[];

  return rows;
}

export async function getApplicationByRoleId(
  db: DbClient,
  userId: string,
  roleId: string
): Promise<Application | null> {
  const rows = (await db.unsafe(
    "SELECT * FROM applications WHERE user_id = $1 AND role_id = $2",
    [userId, roleId]
  )) as Application[];
  return rows[0] ?? null;
}

export async function createApplication(
  db: DbClient,
  userId: string,
  input: CreateApplicationInput
): Promise<Application> {
  const id = randomUUID();
  const rows = (await db.unsafe(
    `INSERT INTO applications (id, user_id, role_id, status, via, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, userId, input.role_id, input.status ?? "wishlist", input.via ?? null, input.notes ?? null]
  )) as Application[];

  return rows[0]!;
}

export async function updateApplication(
  db: DbClient,
  userId: string,
  id: string,
  input: UpdateApplicationInput
): Promise<ApplicationWithRole> {
  const sets: string[] = [];
  const values: (string | null)[] = [];
  let index = 1;

  if (input.status === "applied" && input.applied_at === undefined) {
    const currentRows = (await db.unsafe(
      "SELECT * FROM applications WHERE user_id = $1 AND id = $2",
      [userId, id]
    )) as Application[];
    const currentApp = currentRows[0];
    if (currentApp && !currentApp.applied_at) {
      input.applied_at = new Date().toISOString().replace("T", " ").slice(0, 19);
    }
  }

  if (input.status !== undefined) {
    sets.push(`status = $${index++}`);
    values.push(input.status);
  }
  if (input.applied_at !== undefined) {
    sets.push(`applied_at = $${index++}`);
    values.push(input.applied_at);
  }
  if (input.via !== undefined) {
    sets.push(`via = $${index++}`);
    values.push(input.via);
  }
  if (input.next_followup_at !== undefined) {
    sets.push(`next_followup_at = $${index++}`);
    values.push(input.next_followup_at);
  }
  if (input.notes !== undefined) {
    sets.push(`notes = $${index++}`);
    values.push(input.notes);
  }
  if (input.created_at !== undefined) {
    sets.push(`created_at = $${index++}`);
    values.push(input.created_at);
  }

  if (sets.length > 0) {
    sets.push("updated_at = now()::text");
    values.push(userId, id);
    const query = `UPDATE applications SET ${sets.join(", ")} WHERE user_id = $${index} AND id = $${index + 1} RETURNING *`;
    await db.unsafe(query, values);
  }

  const updated = await getApplicationById(db, userId, id);
  return updated!;
}

export async function getPipelineStats(
  db: DbClient,
  userId: string
): Promise<PipelineStats> {
  const rows = (await db.unsafe(
    "SELECT status, COUNT(*) as count FROM applications WHERE user_id = $1 GROUP BY status",
    [userId]
  )) as Array<{ status: string; count: number }>;

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
