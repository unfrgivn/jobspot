import { randomUUID } from "crypto";
import type { DbClient } from "./index";

export type TaskKind = "followup" | "prep" | "thank_you";
export type TaskStatus = "pending" | "completed" | "cancelled";

export interface Task {
  id: string;
  user_id: string;
  application_id: string | null;
  kind: TaskKind;
  due_at: string | null;
  status: TaskStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWithContext extends Task {
  role_title: string | null;
  company_name: string | null;
}

export interface CreateTaskInput {
  application_id?: string;
  kind: TaskKind;
  due_at?: string;
  notes?: string;
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  due_at?: string;
  notes?: string;
}

export async function getAllTasks(db: DbClient, userId: string): Promise<TaskWithContext[]> {
  const rows = (await db.unsafe(
    `SELECT t.*, r.title as role_title, c.name as company_name
     FROM tasks t
     LEFT JOIN applications a ON t.application_id = a.id
     LEFT JOIN roles r ON a.role_id = r.id
     LEFT JOIN companies c ON r.company_id = c.id
     WHERE t.user_id = $1
     ORDER BY t.due_at ASC NULLS LAST`,
    [userId]
  )) as TaskWithContext[];

  return rows;
}

export async function getPendingTasks(
  db: DbClient,
  userId: string
): Promise<TaskWithContext[]> {
  const rows = (await db.unsafe(
    `SELECT t.*, r.title as role_title, c.name as company_name
     FROM tasks t
     LEFT JOIN applications a ON t.application_id = a.id
     LEFT JOIN roles r ON a.role_id = r.id
     LEFT JOIN companies c ON r.company_id = c.id
     WHERE t.user_id = $1 AND t.status = 'pending'
     ORDER BY t.due_at ASC NULLS LAST`,
    [userId]
  )) as TaskWithContext[];

  return rows;
}

export async function getTaskById(
  db: DbClient,
  userId: string,
  id: string
): Promise<Task | null> {
  const rows = (await db.unsafe(
    "SELECT * FROM tasks WHERE user_id = $1 AND id = $2",
    [userId, id]
  )) as Task[];
  return rows[0] ?? null;
}

export async function getTasksByApplicationId(
  db: DbClient,
  userId: string,
  applicationId: string
): Promise<Task[]> {
  const rows = (await db.unsafe(
    "SELECT * FROM tasks WHERE user_id = $1 AND application_id = $2 ORDER BY due_at ASC",
    [userId, applicationId]
  )) as Task[];

  return rows;
}

export async function createTask(
  db: DbClient,
  userId: string,
  input: CreateTaskInput
): Promise<Task> {
  const id = randomUUID();
  const rows = (await db.unsafe(
    `INSERT INTO tasks (id, user_id, application_id, kind, due_at, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, userId, input.application_id ?? null, input.kind, input.due_at ?? null, input.notes ?? null]
  )) as Task[];

  return rows[0]!;
}

export async function updateTask(
  db: DbClient,
  userId: string,
  id: string,
  input: UpdateTaskInput
): Promise<Task> {
  const sets: string[] = [];
  const values: (string | null)[] = [];
  let index = 1;

  if (input.status !== undefined) {
    sets.push(`status = $${index++}`);
    values.push(input.status);
  }
  if (input.due_at !== undefined) {
    sets.push(`due_at = $${index++}`);
    values.push(input.due_at);
  }
  if (input.notes !== undefined) {
    sets.push(`notes = $${index++}`);
    values.push(input.notes);
  }

  if (sets.length > 0) {
    sets.push("updated_at = now()::text");
    values.push(userId, id);
    const query = `UPDATE tasks SET ${sets.join(", ")} WHERE user_id = $${index} AND id = $${index + 1} RETURNING *`;
    const rows = (await db.unsafe(query, values)) as Task[];
    return rows[0]!;
  }

  const rows = (await db.unsafe(
    "SELECT * FROM tasks WHERE user_id = $1 AND id = $2",
    [userId, id]
  )) as Task[];
  return rows[0]!;
}
