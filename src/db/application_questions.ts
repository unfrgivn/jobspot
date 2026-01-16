import { randomUUID } from "crypto";
import type { DbClient } from "./index";

export interface ApplicationQuestion {
  id: string;
  user_id: string;
  role_id: string;
  question: string;
  generated_answer: string | null;
  submitted_answer: string | null;
  created_at: string;
  updated_at: string;
}

export async function getQuestionsByRoleId(
  db: DbClient,
  userId: string,
  roleId: string
): Promise<ApplicationQuestion[]> {
  const rows = (await db.unsafe(
    "SELECT * FROM application_questions WHERE user_id = $1 AND role_id = $2 ORDER BY created_at DESC",
    [userId, roleId]
  )) as ApplicationQuestion[];

  return rows;
}

export async function createQuestion(
  db: DbClient,
  userId: string,
  roleId: string,
  question: string,
  generatedAnswer: string | null
): Promise<ApplicationQuestion> {
  const id = randomUUID();
  const rows = (await db.unsafe(
    `INSERT INTO application_questions (id, user_id, role_id, question, generated_answer)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, userId, roleId, question, generatedAnswer]
  )) as ApplicationQuestion[];

  return rows[0]!;
}

export async function updateQuestion(
  db: DbClient,
  userId: string,
  id: string,
  updates: { generated_answer?: string; submitted_answer?: string }
): Promise<ApplicationQuestion | null> {
  const setClauses: string[] = ["updated_at = now()::text"];
  const params: (string | null)[] = [];
  let index = 1;

  if (updates.generated_answer !== undefined) {
    setClauses.push(`generated_answer = $${index++}`);
    params.push(updates.generated_answer);
  }
  if (updates.submitted_answer !== undefined) {
    setClauses.push(`submitted_answer = $${index++}`);
    params.push(updates.submitted_answer);
  }

  params.push(userId, id);
  const query = `UPDATE application_questions SET ${setClauses.join(", ")} WHERE user_id = $${index} AND id = $${index + 1} RETURNING *`;
  const rows = (await db.unsafe(query, params)) as ApplicationQuestion[];
  return rows[0] ?? null;
}

export async function deleteQuestion(
  db: DbClient,
  userId: string,
  id: string
): Promise<void> {
  await db.unsafe("DELETE FROM application_questions WHERE user_id = $1 AND id = $2", [userId, id]);
}
