import type { DbClient } from "./index";

export interface UserProfile {
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
}

export async function initUserProfileTable(db: DbClient): Promise<void> {
  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
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
    )
  `);

  await db.unsafe("ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS user_id TEXT");
  await db.unsafe("ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS resume_text TEXT");
  await db.unsafe("ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS resume_file_path TEXT");
  await db.unsafe("ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS google_calendar_refresh_token TEXT");
  await db.unsafe("ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS google_calendar_id TEXT");
  await db.unsafe("CREATE INDEX IF NOT EXISTS idx_user_profile_user_id ON user_profile(user_id)");
}

export async function getUserProfile(db: DbClient, userId: string): Promise<UserProfile | null> {
  const rows = (await db.unsafe(
    "SELECT * FROM user_profile WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1",
    [userId]
  )) as UserProfile[];
  return rows[0] ?? null;
}

export async function createUserProfile(
  db: DbClient,
  userId: string,
  profile: Partial<UserProfile>
): Promise<UserProfile> {
  const id = profile.id || crypto.randomUUID();

  const rows = (await db.unsafe(
    `INSERT INTO user_profile (
      id, user_id, full_name, email, phone, linkedin_url, portfolio_url, about_me, why_looking,
      building_teams, ai_shift, experience_json, cover_letter_tone, cover_letter_structure
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      id,
      userId,
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
  )) as UserProfile[];

  return rows[0]!;
}

export async function updateUserProfile(
  db: DbClient,
  id: string,
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  const sets: string[] = [];
  const values: (string | null)[] = [];
  let index = 1;

  if (updates.full_name !== undefined) {
    sets.push(`full_name = $${index++}`);
    values.push(updates.full_name);
  }
  if (updates.email !== undefined) {
    sets.push(`email = $${index++}`);
    values.push(updates.email);
  }
  if (updates.phone !== undefined) {
    sets.push(`phone = $${index++}`);
    values.push(updates.phone);
  }
  if (updates.linkedin_url !== undefined) {
    sets.push(`linkedin_url = $${index++}`);
    values.push(updates.linkedin_url);
  }
  if (updates.portfolio_url !== undefined) {
    sets.push(`portfolio_url = $${index++}`);
    values.push(updates.portfolio_url);
  }
  if (updates.about_me !== undefined) {
    sets.push(`about_me = $${index++}`);
    values.push(updates.about_me);
  }
  if (updates.why_looking !== undefined) {
    sets.push(`why_looking = $${index++}`);
    values.push(updates.why_looking);
  }
  if (updates.building_teams !== undefined) {
    sets.push(`building_teams = $${index++}`);
    values.push(updates.building_teams);
  }
  if (updates.ai_shift !== undefined) {
    sets.push(`ai_shift = $${index++}`);
    values.push(updates.ai_shift);
  }
  if (updates.experience_json !== undefined) {
    sets.push(`experience_json = $${index++}`);
    values.push(updates.experience_json);
  }
  if (updates.cover_letter_tone !== undefined) {
    sets.push(`cover_letter_tone = $${index++}`);
    values.push(updates.cover_letter_tone);
  }
  if (updates.cover_letter_structure !== undefined) {
    sets.push(`cover_letter_structure = $${index++}`);
    values.push(updates.cover_letter_structure);
  }
  if (updates.resume_text !== undefined) {
    sets.push(`resume_text = $${index++}`);
    values.push(updates.resume_text);
  }
  if (updates.resume_file_path !== undefined) {
    sets.push(`resume_file_path = $${index++}`);
    values.push(updates.resume_file_path);
  }
  if (updates.google_calendar_refresh_token !== undefined) {
    sets.push(`google_calendar_refresh_token = $${index++}`);
    values.push(updates.google_calendar_refresh_token);
  }
  if (updates.google_calendar_id !== undefined) {
    sets.push(`google_calendar_id = $${index++}`);
    values.push(updates.google_calendar_id);
  }

  if (sets.length > 0) {
    sets.push("updated_at = now()::text");
    values.push(id);
    const query = `UPDATE user_profile SET ${sets.join(", ")} WHERE id = $${index} RETURNING *`;
    const rows = (await db.unsafe(query, values)) as UserProfile[];
    return rows[0]!;
  }

  const rows = (await db.unsafe("SELECT * FROM user_profile WHERE id = $1", [id])) as UserProfile[];
  return rows[0]!;
}
