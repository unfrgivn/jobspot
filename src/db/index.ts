import { Database } from "bun:sqlite";
import { initUserProfileTable } from "./user_profile";

let db: Database | null = null;

export function getDb(dbPath: string): Database {
  if (!db) {
    db = new Database(dbPath, { create: true });
    db.exec("PRAGMA journal_mode = WAL;");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function getColumnNames(database: Database, table: string): Set<string> {
  const rows = database.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all();
  return new Set(rows.map((row) => row.name));
}

function addColumnsIfMissing(
  database: Database,
  table: string,
  columns: Array<{ name: string; definition: string }>
): void {
  const existing = getColumnNames(database, table);
  for (const column of columns) {
    if (!existing.has(column.name)) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
}

export function runMigrations(database: Database): void {
  database.exec(INIT_SQL);
  initUserProfileTable(database);

  addColumnsIfMissing(database, "companies", [
    { name: "logo_url", definition: "TEXT" },
    { name: "headquarters", definition: "TEXT" },
    { name: "description", definition: "TEXT" },
    { name: "industry", definition: "TEXT" },
    { name: "funding_status", definition: "TEXT" },
    { name: "company_size", definition: "TEXT" },
    { name: "established_date", definition: "TEXT" },
    { name: "research_sources", definition: "TEXT" },
  ]);

  addColumnsIfMissing(database, "roles", [
    { name: "compensation_min", definition: "INTEGER" },
    { name: "compensation_max", definition: "INTEGER" },
    { name: "linkedin_message", definition: "TEXT" },
  ]);

  addColumnsIfMissing(database, "interviews", [
    { name: "interview_type", definition: "TEXT" },
    { name: "duration_minutes", definition: "INTEGER" },
    { name: "location", definition: "TEXT" },
    { name: "video_link", definition: "TEXT" },
  ]);
}

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    website TEXT,
    headquarters TEXT,
    logo_url TEXT,
    description TEXT,
    notes TEXT,
    industry TEXT,
    funding_status TEXT,
    company_size TEXT,
    established_date TEXT,
    research_sources TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id),
    title TEXT NOT NULL,
    level TEXT,
    location TEXT,
    job_url TEXT,
    jd_text TEXT,
    source TEXT,
    compensation_range TEXT,
    compensation_min INTEGER,
    compensation_max INTEGER,
    linkedin_message TEXT,
    cover_letter TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL REFERENCES roles(id),
    status TEXT NOT NULL DEFAULT 'wishlist',
    applied_at TEXT,
    via TEXT,
    next_followup_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    linkedin TEXT,
    notes TEXT,
    last_contacted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interviews (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES applications(id),
    round_name TEXT NOT NULL,
    scheduled_at TEXT,
    interview_type TEXT,
    duration_minutes INTEGER,
    location TEXT,
    video_link TEXT,
    format TEXT,
    interviewers_json TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES applications(id),
    kind TEXT NOT NULL,
    path TEXT NOT NULL,
    sha256 TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    application_id TEXT REFERENCES applications(id),
    kind TEXT NOT NULL,
    due_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    application_id TEXT REFERENCES applications(id),
    event_type TEXT NOT NULL,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    payload_json TEXT
);

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
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_research (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL REFERENCES roles(id),
    company_profile TEXT,
    fit_analysis TEXT,
    interview_questions TEXT,
    talking_points TEXT,
    generated_at TEXT,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_roles_company_id ON roles(company_id);
CREATE INDEX IF NOT EXISTS idx_applications_role_id ON applications(role_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_application_id ON artifacts(application_id);
CREATE INDEX IF NOT EXISTS idx_tasks_application_id ON tasks(application_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_events_application_id ON events(application_id);
CREATE INDEX IF NOT EXISTS idx_candidate_context_user_profile_id ON candidate_context(user_profile_id);
CREATE INDEX IF NOT EXISTS idx_role_research_role_id ON role_research(role_id);

CREATE TABLE IF NOT EXISTS application_questions (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL REFERENCES roles(id),
    question TEXT NOT NULL,
    generated_answer TEXT,
    submitted_answer TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_application_questions_role_id ON application_questions(role_id);
`;
