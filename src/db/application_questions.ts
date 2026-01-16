import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";

export interface ApplicationQuestion {
  id: string;
  role_id: string;
  question: string;
  generated_answer: string | null;
  submitted_answer: string | null;
  created_at: string;
  updated_at: string;
}

export function getQuestionsByRoleId(db: Database, roleId: string): ApplicationQuestion[] {
  return db
    .query<ApplicationQuestion, [string]>(
      "SELECT * FROM application_questions WHERE role_id = ? ORDER BY created_at DESC"
    )
    .all(roleId);
}

export function createQuestion(
  db: Database,
  roleId: string,
  question: string,
  generatedAnswer: string | null
): ApplicationQuestion {
  const id = randomUUID();
  db.run(
    `INSERT INTO application_questions (id, role_id, question, generated_answer)
     VALUES (?, ?, ?, ?)`,
    [id, roleId, question, generatedAnswer]
  );
  return db
    .query<ApplicationQuestion, [string]>("SELECT * FROM application_questions WHERE id = ?")
    .get(id)!;
}

export function updateQuestion(
  db: Database,
  id: string,
  updates: { generated_answer?: string; submitted_answer?: string }
): ApplicationQuestion | null {
  const setClauses: string[] = ["updated_at = datetime('now')"];
  const params: (string | null)[] = [];

  if (updates.generated_answer !== undefined) {
    setClauses.push("generated_answer = ?");
    params.push(updates.generated_answer);
  }
  if (updates.submitted_answer !== undefined) {
    setClauses.push("submitted_answer = ?");
    params.push(updates.submitted_answer);
  }

  params.push(id);
  db.run(
    `UPDATE application_questions SET ${setClauses.join(", ")} WHERE id = ?`,
    params
  );

  return db
    .query<ApplicationQuestion, [string]>("SELECT * FROM application_questions WHERE id = ?")
    .get(id);
}

export function deleteQuestion(db: Database, id: string): void {
  db.run("DELETE FROM application_questions WHERE id = ?", [id]);
}
