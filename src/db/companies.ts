import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";

export interface Company {
  id: string;
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

export function getAllCompanies(db: Database): Company[] {
  return db.query<Company, []>("SELECT * FROM companies ORDER BY name").all();
}

export function getCompanyById(db: Database, id: string): Company | null {
  return db.query<Company, [string]>("SELECT * FROM companies WHERE id = ?").get(id) ?? null;
}

export function getCompanyByName(db: Database, name: string): Company | null {
  return db.query<Company, [string]>("SELECT * FROM companies WHERE name = ?").get(name) ?? null;
}

export function createCompany(db: Database, input: CreateCompanyInput): Company {
  const id = randomUUID();
  db.run(
    "INSERT INTO companies (id, name, website, headquarters, logo_url, description, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, input.name, input.website ?? null, input.headquarters ?? null, input.logo_url ?? null, input.description ?? null, input.notes ?? null]
  );
  return getCompanyById(db, id)!;
}

export function updateCompany(
  db: Database,
  id: string,
  input: Partial<CreateCompanyInput>
): Company {
  const sets: string[] = [];
  const values: (string | null)[] = [];

  if (input.name !== undefined) {
    sets.push("name = ?");
    values.push(input.name);
  }
  if (input.website !== undefined) {
    sets.push("website = ?");
    values.push(input.website);
  }
  if (input.headquarters !== undefined) {
    sets.push("headquarters = ?");
    values.push(input.headquarters);
  }
  if (input.logo_url !== undefined) {
    sets.push("logo_url = ?");
    values.push(input.logo_url);
  }
  if (input.description !== undefined) {
    sets.push("description = ?");
    values.push(input.description);
  }
  if (input.notes !== undefined) {
    sets.push("notes = ?");
    values.push(input.notes);
  }
  if (input.industry !== undefined) {
    sets.push("industry = ?");
    values.push(input.industry);
  }
  if (input.funding_status !== undefined) {
    sets.push("funding_status = ?");
    values.push(input.funding_status);
  }
  if (input.company_size !== undefined) {
    sets.push("company_size = ?");
    values.push(input.company_size);
  }
  if (input.established_date !== undefined) {
    sets.push("established_date = ?");
    values.push(input.established_date);
  }
  if (input.research_sources !== undefined) {
    sets.push("research_sources = ?");
    values.push(input.research_sources);
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    db.run(`UPDATE companies SET ${sets.join(", ")} WHERE id = ?`, values);
  }

  return getCompanyById(db, id)!;
}
