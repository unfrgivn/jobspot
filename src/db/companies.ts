import { randomUUID } from "crypto";
import type { DbClient } from "./index";

export interface Company {
  id: string;
  user_id: string;
  name: string;
  website: string | null;
  headquarters: string | null;
  logo_url: string | null;
  description: string | null;
  notes: string | null;
  industry: string | null;
  funding_status: string | null;
  company_size: string | null;
  established_date: string | null;
  research_sources: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCompanyInput {
  name: string;
  website?: string;
  headquarters?: string;
  logo_url?: string;
  description?: string;
  notes?: string;
  industry?: string;
  funding_status?: string;
  company_size?: string;
  established_date?: string;
  research_sources?: string;
}

export async function getAllCompanies(db: DbClient, userId: string): Promise<Company[]> {
  const rows = (await db.unsafe(
    "SELECT * FROM companies WHERE user_id = $1 ORDER BY name",
    [userId]
  )) as Company[];
  return rows;
}

export async function getCompanyById(
  db: DbClient,
  userId: string,
  id: string
): Promise<Company | null> {
  const rows = (await db.unsafe(
    "SELECT * FROM companies WHERE user_id = $1 AND id = $2",
    [userId, id]
  )) as Company[];
  return rows[0] ?? null;
}

export async function getCompanyByName(
  db: DbClient,
  userId: string,
  name: string
): Promise<Company | null> {
  const rows = (await db.unsafe(
    "SELECT * FROM companies WHERE user_id = $1 AND name = $2",
    [userId, name]
  )) as Company[];
  return rows[0] ?? null;
}

export async function createCompany(
  db: DbClient,
  userId: string,
  input: CreateCompanyInput
): Promise<Company> {
  const id = randomUUID();
  const rows = (await db.unsafe(
    "INSERT INTO companies (id, user_id, name, website, headquarters, logo_url, description, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
    [
      id,
      userId,
      input.name,
      input.website ?? null,
      input.headquarters ?? null,
      input.logo_url ?? null,
      input.description ?? null,
      input.notes ?? null,
    ]
  )) as Company[];

  return rows[0]!;
}

export async function updateCompany(
  db: DbClient,
  userId: string,
  id: string,
  input: Partial<CreateCompanyInput>
): Promise<Company> {
  const sets: string[] = [];
  const values: (string | null)[] = [];
  let index = 1;

  if (input.name !== undefined) {
    sets.push(`name = $${index++}`);
    values.push(input.name);
  }
  if (input.website !== undefined) {
    sets.push(`website = $${index++}`);
    values.push(input.website);
  }
  if (input.headquarters !== undefined) {
    sets.push(`headquarters = $${index++}`);
    values.push(input.headquarters);
  }
  if (input.logo_url !== undefined) {
    sets.push(`logo_url = $${index++}`);
    values.push(input.logo_url);
  }
  if (input.description !== undefined) {
    sets.push(`description = $${index++}`);
    values.push(input.description);
  }
  if (input.notes !== undefined) {
    sets.push(`notes = $${index++}`);
    values.push(input.notes);
  }
  if (input.industry !== undefined) {
    sets.push(`industry = $${index++}`);
    values.push(input.industry);
  }
  if (input.funding_status !== undefined) {
    sets.push(`funding_status = $${index++}`);
    values.push(input.funding_status);
  }
  if (input.company_size !== undefined) {
    sets.push(`company_size = $${index++}`);
    values.push(input.company_size);
  }
  if (input.established_date !== undefined) {
    sets.push(`established_date = $${index++}`);
    values.push(input.established_date);
  }
  if (input.research_sources !== undefined) {
    sets.push(`research_sources = $${index++}`);
    values.push(input.research_sources);
  }

  if (sets.length > 0) {
    sets.push("updated_at = now()::text");
    values.push(userId, id);
    const query = `UPDATE companies SET ${sets.join(", ")} WHERE user_id = $${index} AND id = $${index + 1} RETURNING *`;
    const rows = (await db.unsafe(query, values)) as Company[];
    return rows[0]!;
  }

  const rows = (await db.unsafe(
    "SELECT * FROM companies WHERE user_id = $1 AND id = $2",
    [userId, id]
  )) as Company[];
  return rows[0]!;
}
