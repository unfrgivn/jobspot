import postgres from "postgres";
import { initUserProfileTable } from "./user_profile";

export type DbClient = postgres.Sql;

let db: DbClient | null = null;

export function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.SUPABASE_DATABASE_URL ??
    process.env.SUPABASE_DB_URL;

  if (!url) {
    throw new Error("DATABASE_URL not configured. Set DATABASE_URL to a Postgres connection string.");
  }

  return url;
}

export function getDb(databaseUrl?: string): DbClient {
  if (!db) {
    const url = databaseUrl ?? getDatabaseUrl();
    db = postgres(url, {
      max: 1,
      idle_timeout: 30,
      connect_timeout: 30,
      onnotice: () => {},
    });
  }

  return db;
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.end({ timeout: 5 });
    db = null;
  }
}

async function addColumnsIfMissing(
  database: DbClient,
  table: string,
  columns: Array<{ name: string; definition: string }>
): Promise<void> {
  for (const column of columns) {
    await database.unsafe(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column.name} ${column.definition}`
    );
  }
}

export async function runMigrations(database: DbClient): Promise<void> {
  await database.unsafe(INIT_SQL);
  await initUserProfileTable(database);

  await addColumnsIfMissing(database, "companies", [
    { name: "user_id", definition: "TEXT" },
    { name: "logo_url", definition: "TEXT" },
    { name: "headquarters", definition: "TEXT" },
    { name: "description", definition: "TEXT" },
    { name: "industry", definition: "TEXT" },
    { name: "funding_status", definition: "TEXT" },
    { name: "company_size", definition: "TEXT" },
    { name: "established_date", definition: "TEXT" },
    { name: "research_sources", definition: "TEXT" },
  ]);

  await addColumnsIfMissing(database, "roles", [
    { name: "user_id", definition: "TEXT" },
    { name: "compensation_min", definition: "INTEGER" },
    { name: "compensation_max", definition: "INTEGER" },
    { name: "linkedin_message", definition: "TEXT" },
  ]);

  await addColumnsIfMissing(database, "interviews", [
    { name: "user_id", definition: "TEXT" },
    { name: "interview_type", definition: "TEXT" },
    { name: "duration_minutes", definition: "INTEGER" },
    { name: "location", definition: "TEXT" },
    { name: "video_link", definition: "TEXT" },
  ]);

  await addColumnsIfMissing(database, "applications", [
    { name: "user_id", definition: "TEXT" },
  ]);

  await addColumnsIfMissing(database, "contacts", [
    { name: "user_id", definition: "TEXT" },
  ]);

  await addColumnsIfMissing(database, "artifacts", [
    { name: "user_id", definition: "TEXT" },
  ]);

  await addColumnsIfMissing(database, "tasks", [
    { name: "user_id", definition: "TEXT" },
  ]);

  await addColumnsIfMissing(database, "events", [
    { name: "user_id", definition: "TEXT" },
  ]);

  await addColumnsIfMissing(database, "role_research", [
    { name: "user_id", definition: "TEXT" },
  ]);

  await addColumnsIfMissing(database, "application_questions", [
    { name: "user_id", definition: "TEXT" },
  ]);

  await database.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
    CREATE INDEX IF NOT EXISTS idx_roles_user_id ON roles(user_id);
    CREATE INDEX IF NOT EXISTS idx_roles_company_id ON roles(company_id);
    CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
    CREATE INDEX IF NOT EXISTS idx_applications_role_id ON applications(role_id);
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON interviews(user_id);
    CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON interviews(application_id);
    CREATE INDEX IF NOT EXISTS idx_artifacts_user_id ON artifacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_artifacts_application_id ON artifacts(application_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_application_id ON tasks(application_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_application_id ON events(application_id);
    CREATE INDEX IF NOT EXISTS idx_user_profile_user_id ON user_profile(user_id);
    CREATE INDEX IF NOT EXISTS idx_candidate_context_user_profile_id ON candidate_context(user_profile_id);
    CREATE INDEX IF NOT EXISTS idx_role_research_user_id ON role_research(user_id);
    CREATE INDEX IF NOT EXISTS idx_role_research_role_id ON role_research(role_id);
    CREATE INDEX IF NOT EXISTS idx_application_questions_role_id ON application_questions(role_id);
  `);
}

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    email TEXT,
    name TEXT,
    avatar_url TEXT,
    created_at TEXT NOT NULL DEFAULT (now()::text),
    updated_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
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
    created_at TEXT NOT NULL DEFAULT (now()::text),
    updated_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
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
    created_at TEXT NOT NULL DEFAULT (now()::text),
    updated_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    role_id TEXT NOT NULL REFERENCES roles(id),
    status TEXT NOT NULL DEFAULT 'wishlist',
    applied_at TEXT,
    via TEXT,
    next_followup_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (now()::text),
    updated_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    company_id TEXT NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    linkedin TEXT,
    notes TEXT,
    last_contacted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (now()::text),
    updated_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS interviews (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    application_id TEXT NOT NULL REFERENCES applications(id),
    round_name TEXT NOT NULL,
    scheduled_at TEXT,
    interview_type TEXT,
    interviewer_name TEXT,
    interviewer_title TEXT,
    outcome TEXT,
    duration_minutes INTEGER,
    location TEXT,
    video_link TEXT,
    google_calendar_event_id TEXT,
    prep_notes TEXT,
    questions_to_ask TEXT,
    research_notes TEXT,
    format TEXT,
    interviewers_json TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (now()::text),
    updated_at TEXT NOT NULL DEFAULT (now()::text)
);

ALTER TABLE interviews ADD COLUMN IF NOT EXISTS interviewer_name TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS interviewer_title TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS prep_notes TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS questions_to_ask TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS research_notes TEXT;

CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    application_id TEXT NOT NULL REFERENCES applications(id),
    kind TEXT NOT NULL,
    path TEXT NOT NULL,
    sha256 TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    application_id TEXT REFERENCES applications(id),
    kind TEXT NOT NULL,
    due_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (now()::text),
    updated_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    application_id TEXT REFERENCES applications(id),
    event_type TEXT NOT NULL,
    occurred_at TEXT NOT NULL DEFAULT (now()::text),
    payload_json TEXT
);

CREATE TABLE IF NOT EXISTS user_profile (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    full_name TEXT,
    email TEXT,
    phone TEXT,
    linkedin_url TEXT,
    portfolio_url TEXT,
    about_me TEXT,
    why_looking TEXT,
    building_teams TEXT,
    ai_shift TEXT,
    experience_json TEXT,
    cover_letter_tone TEXT,
    cover_letter_structure TEXT,
    resume_text TEXT,
    resume_file_path TEXT,
    google_calendar_refresh_token TEXT,
    google_calendar_id TEXT,
    created_at TEXT NOT NULL DEFAULT (now()::text),
    updated_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS candidate_context (
    id TEXT PRIMARY KEY,
    user_profile_id TEXT NOT NULL REFERENCES user_profile(id),
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
    updated_at TEXT NOT NULL DEFAULT (now()::text)
);

CREATE TABLE IF NOT EXISTS role_research (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    role_id TEXT NOT NULL REFERENCES roles(id),
    company_profile TEXT,
    fit_analysis TEXT,
    interview_questions TEXT,
    talking_points TEXT,
    generated_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS application_questions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    role_id TEXT NOT NULL REFERENCES roles(id),
    question TEXT NOT NULL,
    generated_answer TEXT,
    submitted_answer TEXT,
    created_at TEXT NOT NULL DEFAULT (now()::text),
    updated_at TEXT NOT NULL DEFAULT (now()::text)
);
`;
