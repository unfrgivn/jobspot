import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";

export type TaskKind = "followup" | "prep" | "thank_you";
export type TaskStatus = "pending" | "completed" | "cancelled";

export interface Task {
  id: string;
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

export function getAllTasks(db: Database): TaskWithContext[] {
  return db
    .query<TaskWithContext, []>(
      `SELECT t.*, r.title as role_title, c.name as company_name
       FROM tasks t
       LEFT JOIN applications a ON t.application_id = a.id
       LEFT JOIN roles r ON a.role_id = r.id
       LEFT JOIN companies c ON r.company_id = c.id
       ORDER BY t.due_at ASC NULLS LAST`
    )
    .all();
}

export function getPendingTasks(db: Database): TaskWithContext[] {
  return db
    .query<TaskWithContext, []>(
      `SELECT t.*, r.title as role_title, c.name as company_name
       FROM tasks t
       LEFT JOIN applications a ON t.application_id = a.id
       LEFT JOIN roles r ON a.role_id = r.id
       LEFT JOIN companies c ON r.company_id = c.id
       WHERE t.status = 'pending'
       ORDER BY t.due_at ASC NULLS LAST`
    )
    .all();
}

export function getTaskById(db: Database, id: string): Task | null {
  return db.query<Task, [string]>("SELECT * FROM tasks WHERE id = ?").get(id) ?? null;
}

export function getTasksByApplicationId(db: Database, applicationId: string): Task[] {
  return db
    .query<Task, [string]>("SELECT * FROM tasks WHERE application_id = ? ORDER BY due_at ASC")
    .all(applicationId);
}

export function createTask(db: Database, input: CreateTaskInput): Task {
  const id = randomUUID();
  db.run(
    `INSERT INTO tasks (id, application_id, kind, due_at, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.application_id ?? null, input.kind, input.due_at ?? null, input.notes ?? null]
  );
  return getTaskById(db, id)!;
}

export function updateTask(db: Database, id: string, input: UpdateTaskInput): Task {
  const sets: string[] = [];
  const values: (string | null)[] = [];

  if (input.status !== undefined) {
    sets.push("status = ?");
    values.push(input.status);
  }
  if (input.due_at !== undefined) {
    sets.push("due_at = ?");
    values.push(input.due_at);
  }
  if (input.notes !== undefined) {
    sets.push("notes = ?");
    values.push(input.notes);
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    db.run(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, values);
  }

  return getTaskById(db, id)!;
}
