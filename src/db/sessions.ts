import { randomUUID } from "crypto";
import type { DbClient } from "./index";

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export async function createSession(
  db: DbClient,
  userId: string,
  expiresAt: string
): Promise<Session> {
  const id = randomUUID();
  const rows = (await db.unsafe(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [id, userId, expiresAt]
  )) as Session[];

  return rows[0]!;
}

export async function getSessionById(db: DbClient, sessionId: string): Promise<Session | null> {
  const rows = (await db.unsafe("SELECT * FROM sessions WHERE id = $1", [sessionId])) as Session[];
  return rows[0] ?? null;
}

export async function deleteSession(db: DbClient, sessionId: string): Promise<void> {
  await db.unsafe("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

export async function deleteExpiredSessions(db: DbClient): Promise<void> {
  await db.unsafe("DELETE FROM sessions WHERE expires_at < now()::text");
}
