import postgres from "postgres";
import { initUserProfileTable } from "./user_profile";

export type DbClient = postgres.Sql;

export type BackupCompany = {
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
};

export type BackupRole = {
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
};

export type BackupApplication = {
  id: string;
  user_id: string;
  role_id: string;
  status: string;
  applied_at: string | null;
  via: string | null;
  next_followup_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BackupContact = {
  id: string;
  user_id: string;
  company_id: string;
  name: string;
  title: string | null;
  email: string | null;
  linkedin: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BackupInterview = {
  id: string;
  user_id: string;
  application_id: string;
  round_name: string;
  scheduled_at: string | null;
  interview_type: string | null;
  interviewer_name: string | null;
  interviewer_title: string | null;
  outcome: string | null;
  duration_minutes: number | null;
  location: string | null;
  video_link: string | null;
  google_calendar_event_id: string | null;
  prep_notes: string | null;
  questions_to_ask: string | null;
  research_notes: string | null;
  format: string | null;
  interviewers_json: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BackupArtifact = {
  id: string;
  user_id: string;
  application_id: string;
  kind: string;
  path: string;
  sha256: string | null;
  notes: string | null;
  created_at: string;
};

export type BackupTask = {
  id: string;
  user_id: string;
  application_id: string | null;
  kind: string;
  due_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BackupEvent = {
  id: string;
  user_id: string;
  application_id: string | null;
  event_type: string;
  occurred_at: string;
  payload_json: string | null;
};

export type BackupUserProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  about_me: string | null;
  why_looking: string | null;
  building_teams: string | null;
  ai_shift: string | null;
  experience_json: string | null;
  cover_letter_tone: string | null;
  cover_letter_structure: string | null;
  resume_text: string | null;
  resume_file_path: string | null;
  google_calendar_refresh_token: string | null;
  google_calendar_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BackupCandidateContext = {
  id: string;
  user_profile_id: string;
  executive_summary: string | null;
  key_strengths: string | null;
  leadership_narrative: string | null;
  technical_expertise: string | null;
  impact_highlights: string | null;
  career_trajectory: string | null;
  linkedin_scraped_at: string | null;
  portfolio_scraped_at: string | null;
  resume_parsed_at: string | null;
  full_context: string | null;
  created_at: string;
  updated_at: string;
};

export type BackupRoleResearch = {
  id: string;
  user_id: string;
  role_id: string;
  company_profile: string | null;
  fit_analysis: string | null;
  interview_questions: string | null;
  talking_points: string | null;
  generated_at: string | null;
  updated_at: string | null;
};

export type BackupApplicationQuestion = {
  id: string;
  user_id: string;
  role_id: string;
  question: string;
  generated_answer: string | null;
  submitted_answer: string | null;
  created_at: string;
  updated_at: string;
};

export type BackupData = {
  user_profile: BackupUserProfile[];
  candidate_context: BackupCandidateContext[];
  companies: BackupCompany[];
  roles: BackupRole[];
  applications: BackupApplication[];
  contacts: BackupContact[];
  interviews: BackupInterview[];
  artifacts: BackupArtifact[];
  tasks: BackupTask[];
  events: BackupEvent[];
  role_research: BackupRoleResearch[];
  application_questions: BackupApplicationQuestion[];
};

export type BackupPayload = {
  version: 1;
  exported_at: string;
  user_id: string;
  data: BackupData;
};

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

const COMPANY_COLUMNS = [
  "id",
  "user_id",
  "name",
  "website",
  "headquarters",
  "logo_url",
  "description",
  "notes",
  "industry",
  "funding_status",
  "company_size",
  "established_date",
  "research_sources",
  "created_at",
  "updated_at",
] as const;

const ROLE_COLUMNS = [
  "id",
  "user_id",
  "company_id",
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
  "created_at",
  "updated_at",
] as const;

const APPLICATION_COLUMNS = [
  "id",
  "user_id",
  "role_id",
  "status",
  "applied_at",
  "via",
  "next_followup_at",
  "notes",
  "created_at",
  "updated_at",
] as const;

const CONTACT_COLUMNS = [
  "id",
  "user_id",
  "company_id",
  "name",
  "title",
  "email",
  "linkedin",
  "notes",
  "last_contacted_at",
  "created_at",
  "updated_at",
] as const;

const INTERVIEW_COLUMNS = [
  "id",
  "user_id",
  "application_id",
  "round_name",
  "scheduled_at",
  "interview_type",
  "interviewer_name",
  "interviewer_title",
  "outcome",
  "duration_minutes",
  "location",
  "video_link",
  "google_calendar_event_id",
  "prep_notes",
  "questions_to_ask",
  "research_notes",
  "format",
  "interviewers_json",
  "notes",
  "created_at",
  "updated_at",
] as const;

const ARTIFACT_COLUMNS = [
  "id",
  "user_id",
  "application_id",
  "kind",
  "path",
  "sha256",
  "notes",
  "created_at",
] as const;

const TASK_COLUMNS = [
  "id",
  "user_id",
  "application_id",
  "kind",
  "due_at",
  "status",
  "notes",
  "created_at",
  "updated_at",
] as const;

const EVENT_COLUMNS = [
  "id",
  "user_id",
  "application_id",
  "event_type",
  "occurred_at",
  "payload_json",
] as const;

const USER_PROFILE_COLUMNS = [
  "id",
  "user_id",
  "full_name",
  "email",
  "phone",
  "linkedin_url",
  "portfolio_url",
  "about_me",
  "why_looking",
  "building_teams",
  "ai_shift",
  "experience_json",
  "cover_letter_tone",
  "cover_letter_structure",
  "resume_text",
  "resume_file_path",
  "google_calendar_refresh_token",
  "google_calendar_id",
  "created_at",
  "updated_at",
] as const;

const CANDIDATE_CONTEXT_COLUMNS = [
  "id",
  "user_profile_id",
  "executive_summary",
  "key_strengths",
  "leadership_narrative",
  "technical_expertise",
  "impact_highlights",
  "career_trajectory",
  "linkedin_scraped_at",
  "portfolio_scraped_at",
  "resume_parsed_at",
  "full_context",
  "created_at",
  "updated_at",
] as const;

const ROLE_RESEARCH_COLUMNS = [
  "id",
  "user_id",
  "role_id",
  "company_profile",
  "fit_analysis",
  "interview_questions",
  "talking_points",
  "generated_at",
  "updated_at",
] as const;

const APPLICATION_QUESTION_COLUMNS = [
  "id",
  "user_id",
  "role_id",
  "question",
  "generated_answer",
  "submitted_answer",
  "created_at",
  "updated_at",
] as const;

type InsertValue = string | number | null;

type SqlExecutor = {
  unsafe: DbClient["unsafe"];
};

function buildInsertStatement(table: string, columns: readonly string[], rowCount: number): string {
  const columnList = columns.join(", ");
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => {
    const offset = rowIndex * columns.length;
    const placeholders = columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(", ");
    return `(${placeholders})`;
  });

  return `INSERT INTO ${table} (${columnList}) VALUES ${rows.join(", ")}`;
}

function buildInsertValues(rows: Array<Record<string, InsertValue>>, columns: readonly string[]): InsertValue[] {
  const values: InsertValue[] = [];
  for (const row of rows) {
    for (const column of columns) {
      values.push(row[column] ?? null);
    }
  }
  return values;
}

async function insertRows(
  database: SqlExecutor,
  table: string,
  columns: readonly string[],
  rows: Array<Record<string, InsertValue>>
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const statement = buildInsertStatement(table, columns, rows.length);
  const values = buildInsertValues(rows, columns);
  await database.unsafe(statement, values);
}

export async function exportUserBackup(
  database: DbClient,
  userId: string
): Promise<BackupData> {
  const userProfiles = (await database.unsafe(
    "SELECT * FROM user_profile WHERE user_id = $1 ORDER BY updated_at DESC",
    [userId]
  )) as BackupUserProfile[];
  const profileIds = userProfiles.map((profile) => profile.id);
  const candidateContext = profileIds.length
    ? ((await database.unsafe(
        "SELECT * FROM candidate_context WHERE user_profile_id = ANY($1::text[])",
        [profileIds]
      )) as BackupCandidateContext[])
    : [];

  const companies = (await database.unsafe("SELECT * FROM companies WHERE user_id = $1", [userId])) as BackupCompany[];
  const roles = (await database.unsafe("SELECT * FROM roles WHERE user_id = $1", [userId])) as BackupRole[];
  const applications = (await database.unsafe(
    "SELECT * FROM applications WHERE user_id = $1",
    [userId]
  )) as BackupApplication[];
  const contacts = (await database.unsafe("SELECT * FROM contacts WHERE user_id = $1", [userId])) as BackupContact[];
  const interviews = (await database.unsafe(
    "SELECT * FROM interviews WHERE user_id = $1",
    [userId]
  )) as BackupInterview[];
  const artifacts = (await database.unsafe(
    "SELECT * FROM artifacts WHERE user_id = $1",
    [userId]
  )) as BackupArtifact[];
  const tasks = (await database.unsafe("SELECT * FROM tasks WHERE user_id = $1", [userId])) as BackupTask[];
  const events = (await database.unsafe("SELECT * FROM events WHERE user_id = $1", [userId])) as BackupEvent[];
  const roleResearch = (await database.unsafe(
    "SELECT * FROM role_research WHERE user_id = $1",
    [userId]
  )) as BackupRoleResearch[];
  const applicationQuestions = (await database.unsafe(
    "SELECT * FROM application_questions WHERE user_id = $1",
    [userId]
  )) as BackupApplicationQuestion[];

  return {
    user_profile: userProfiles,
    candidate_context: candidateContext,
    companies,
    roles,
    applications,
    contacts,
    interviews,
    artifacts,
    tasks,
    events,
    role_research: roleResearch,
    application_questions: applicationQuestions,
  };
}

export async function restoreUserBackup(
  database: DbClient,
  userId: string,
  data: BackupData
): Promise<void> {
  await database.begin(async (tx) => {
    await tx.unsafe("DELETE FROM application_questions WHERE user_id = $1", [userId]);
    await tx.unsafe("DELETE FROM role_research WHERE user_id = $1", [userId]);
    await tx.unsafe("DELETE FROM events WHERE user_id = $1", [userId]);
    await tx.unsafe("DELETE FROM tasks WHERE user_id = $1", [userId]);
    await tx.unsafe("DELETE FROM artifacts WHERE user_id = $1", [userId]);
    await tx.unsafe("DELETE FROM interviews WHERE user_id = $1", [userId]);
    await tx.unsafe("DELETE FROM contacts WHERE user_id = $1", [userId]);
    await tx.unsafe("DELETE FROM applications WHERE user_id = $1", [userId]);
    await tx.unsafe("DELETE FROM roles WHERE user_id = $1", [userId]);
    await tx.unsafe("DELETE FROM companies WHERE user_id = $1", [userId]);
    await tx.unsafe(
      "DELETE FROM candidate_context WHERE user_profile_id IN (SELECT id FROM user_profile WHERE user_id = $1)",
      [userId]
    );
    await tx.unsafe("DELETE FROM user_profile WHERE user_id = $1", [userId]);

    const userProfiles = data.user_profile.map((profile) => ({ ...profile, user_id: userId }));
    await insertRows(tx, "user_profile", USER_PROFILE_COLUMNS, userProfiles);

    await insertRows(tx, "candidate_context", CANDIDATE_CONTEXT_COLUMNS, data.candidate_context);

    const companies = data.companies.map((company) => ({ ...company, user_id: userId }));
    await insertRows(tx, "companies", COMPANY_COLUMNS, companies);

    const roles = data.roles.map((role) => ({ ...role, user_id: userId }));
    await insertRows(tx, "roles", ROLE_COLUMNS, roles);

    const roleResearch = data.role_research.map((research) => ({ ...research, user_id: userId }));
    await insertRows(tx, "role_research", ROLE_RESEARCH_COLUMNS, roleResearch);

    const applicationQuestions = data.application_questions.map((question) => ({ ...question, user_id: userId }));
    await insertRows(tx, "application_questions", APPLICATION_QUESTION_COLUMNS, applicationQuestions);

    const applications = data.applications.map((application) => ({ ...application, user_id: userId }));
    await insertRows(tx, "applications", APPLICATION_COLUMNS, applications);

    const contacts = data.contacts.map((contact) => ({ ...contact, user_id: userId }));
    await insertRows(tx, "contacts", CONTACT_COLUMNS, contacts);

    const interviews = data.interviews.map((interview) => ({ ...interview, user_id: userId }));
    await insertRows(tx, "interviews", INTERVIEW_COLUMNS, interviews);

    const artifacts = data.artifacts.map((artifact) => ({ ...artifact, user_id: userId }));
    await insertRows(tx, "artifacts", ARTIFACT_COLUMNS, artifacts);

    const tasks = data.tasks.map((task) => ({ ...task, user_id: userId }));
    await insertRows(tx, "tasks", TASK_COLUMNS, tasks);

    const events = data.events.map((event) => ({ ...event, user_id: userId }));
    await insertRows(tx, "events", EVENT_COLUMNS, events);
  });
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
