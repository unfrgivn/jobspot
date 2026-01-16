import { randomUUID } from "crypto";
import type { DbClient } from "./index";

export interface User {
  id: string;
  google_sub: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleUserProfile {
  sub: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
}

export async function getUserById(db: DbClient, userId: string): Promise<User | null> {
  const rows = (await db.unsafe("SELECT * FROM users WHERE id = $1", [userId])) as User[];
  return rows[0] ?? null;
}

export async function getUserByGoogleSub(db: DbClient, googleSub: string): Promise<User | null> {
  const rows = (await db.unsafe("SELECT * FROM users WHERE google_sub = $1", [googleSub])) as User[];
  return rows[0] ?? null;
}

export async function createUser(db: DbClient, profile: GoogleUserProfile): Promise<User> {
  const id = randomUUID();
  const rows = (await db.unsafe(
    `INSERT INTO users (id, google_sub, email, name, avatar_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      id,
      profile.sub,
      profile.email ?? null,
      profile.name ?? null,
      profile.picture ?? null,
    ]
  )) as User[];

  return rows[0]!;
}

export async function updateUserFromProfile(
  db: DbClient,
  userId: string,
  profile: GoogleUserProfile
): Promise<User> {
  const rows = (await db.unsafe(
    `UPDATE users
     SET email = $1, name = $2, avatar_url = $3, updated_at = now()::text
     WHERE id = $4
     RETURNING *`,
    [profile.email ?? null, profile.name ?? null, profile.picture ?? null, userId]
  )) as User[];

  return rows[0]!;
}

export async function getOrCreateUserFromGoogleProfile(
  db: DbClient,
  profile: GoogleUserProfile
): Promise<User> {
  const existing = await getUserByGoogleSub(db, profile.sub);
  if (!existing) {
    return createUser(db, profile);
  }

  const needsUpdate =
    existing.email !== (profile.email ?? null) ||
    existing.name !== (profile.name ?? null) ||
    existing.avatar_url !== (profile.picture ?? null);

  if (!needsUpdate) {
    return existing;
  }

  return updateUserFromProfile(db, existing.id, profile);
}

