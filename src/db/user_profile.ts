import { Database } from "bun:sqlite";

export interface UserProfile {
  id: string;
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
}

export function initUserProfileTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY,
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  
  const columns = db.query<{ name: string }, []>("PRAGMA table_info(user_profile)").all();
  const columnNames = columns.map(c => c.name);
  
  if (!columnNames.includes("resume_text")) {
    db.run("ALTER TABLE user_profile ADD COLUMN resume_text TEXT");
  }
  if (!columnNames.includes("resume_file_path")) {
    db.run("ALTER TABLE user_profile ADD COLUMN resume_file_path TEXT");
  }
  if (!columnNames.includes("google_calendar_refresh_token")) {
    db.run("ALTER TABLE user_profile ADD COLUMN google_calendar_refresh_token TEXT");
  }
  if (!columnNames.includes("google_calendar_id")) {
    db.run("ALTER TABLE user_profile ADD COLUMN google_calendar_id TEXT");
  }
}

export function getUserProfile(db: Database): UserProfile | null {
  return db.query<UserProfile, []>("SELECT * FROM user_profile LIMIT 1").get() ?? null;
}

export function createUserProfile(db: Database, profile: Partial<UserProfile>): UserProfile {
  const id = profile.id || crypto.randomUUID();
  
  db.run(
    `INSERT INTO user_profile (
      id, full_name, email, phone, linkedin_url, portfolio_url, about_me, why_looking,
      building_teams, ai_shift, experience_json, cover_letter_tone, cover_letter_structure
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      profile.full_name || null,
      profile.email || null,
      profile.phone || null,
      profile.linkedin_url || null,
      profile.portfolio_url || null,
      profile.about_me || null,
      profile.why_looking || null,
      profile.building_teams || null,
      profile.ai_shift || null,
      profile.experience_json || null,
      profile.cover_letter_tone || null,
      profile.cover_letter_structure || null,
    ]
  );

  return getUserProfile(db)!;
}

export function updateUserProfile(
  db: Database,
  id: string,
  updates: Partial<UserProfile>
): UserProfile {
  const sets: string[] = [];
  const values: (string | null)[] = [];

  if (updates.full_name !== undefined) {
    sets.push("full_name = ?");
    values.push(updates.full_name);
  }
  if (updates.email !== undefined) {
    sets.push("email = ?");
    values.push(updates.email);
  }
  if (updates.phone !== undefined) {
    sets.push("phone = ?");
    values.push(updates.phone);
  }
  if (updates.linkedin_url !== undefined) {
    sets.push("linkedin_url = ?");
    values.push(updates.linkedin_url);
  }
  if (updates.portfolio_url !== undefined) {
    sets.push("portfolio_url = ?");
    values.push(updates.portfolio_url);
  }
  if (updates.about_me !== undefined) {
    sets.push("about_me = ?");
    values.push(updates.about_me);
  }
  if (updates.why_looking !== undefined) {
    sets.push("why_looking = ?");
    values.push(updates.why_looking);
  }
  if (updates.building_teams !== undefined) {
    sets.push("building_teams = ?");
    values.push(updates.building_teams);
  }
  if (updates.ai_shift !== undefined) {
    sets.push("ai_shift = ?");
    values.push(updates.ai_shift);
  }
  if (updates.experience_json !== undefined) {
    sets.push("experience_json = ?");
    values.push(updates.experience_json);
  }
  if (updates.cover_letter_tone !== undefined) {
    sets.push("cover_letter_tone = ?");
    values.push(updates.cover_letter_tone);
  }
  if (updates.cover_letter_structure !== undefined) {
    sets.push("cover_letter_structure = ?");
    values.push(updates.cover_letter_structure);
  }
  if (updates.resume_text !== undefined) {
    sets.push("resume_text = ?");
    values.push(updates.resume_text);
  }
  if (updates.resume_file_path !== undefined) {
    sets.push("resume_file_path = ?");
    values.push(updates.resume_file_path);
  }
  if (updates.google_calendar_refresh_token !== undefined) {
    sets.push("google_calendar_refresh_token = ?");
    values.push(updates.google_calendar_refresh_token);
  }
  if (updates.google_calendar_id !== undefined) {
    sets.push("google_calendar_id = ?");
    values.push(updates.google_calendar_id);
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    db.run(`UPDATE user_profile SET ${sets.join(", ")} WHERE id = ?`, values);
  }

  return getUserProfile(db)!;
}
