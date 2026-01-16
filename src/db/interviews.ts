import { v4 as uuidv4 } from "uuid";
import type { DbClient } from "./index";

export interface Interview {
  id: string;
  user_id: string;
  application_id: string;
  scheduled_at: string;
  interview_type: string | null;
  interviewer_name: string | null;
  interviewer_title: string | null;
  notes: string | null;
  outcome: string | null;
  duration_minutes: number | null;
  location: string | null;
  video_link: string | null;
  google_calendar_event_id: string | null;
  prep_notes: string | null;
  questions_to_ask: string | null;
  research_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInterviewInput {
  application_id: string;
  scheduled_at: string;
  interview_type?: string;
  interviewer_name?: string;
  interviewer_title?: string;
  notes?: string;
  outcome?: string;
  duration_minutes?: number;
  location?: string;
  video_link?: string;
  google_calendar_event_id?: string;
  prep_notes?: string;
  questions_to_ask?: string;
  research_notes?: string;
}

export async function getInterviewsByApplication(
  db: DbClient,
  userId: string,
  applicationId: string
): Promise<Interview[]> {
  const rows = (await db.unsafe(
    `SELECT * FROM interviews
     WHERE user_id = $1 AND application_id = $2
     ORDER BY scheduled_at DESC`,
    [userId, applicationId]
  )) as Interview[];

  return rows;
}

export async function getInterviewById(
  db: DbClient,
  userId: string,
  id: string
): Promise<Interview | null> {
  const rows = (await db.unsafe(
    "SELECT * FROM interviews WHERE user_id = $1 AND id = $2",
    [userId, id]
  )) as Interview[];

  return rows[0] ?? null;
}

export async function createInterview(
  db: DbClient,
  userId: string,
  input: CreateInterviewInput
): Promise<Interview> {
  const id = uuidv4();

  const rows = (await db.unsafe(
    `INSERT INTO interviews (
      id, user_id, application_id, scheduled_at, interview_type,
      interviewer_name, interviewer_title, notes, outcome,
      duration_minutes, location, video_link, google_calendar_event_id,
      prep_notes, questions_to_ask, research_notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      id,
      userId,
      input.application_id,
      input.scheduled_at,
      input.interview_type || null,
      input.interviewer_name || null,
      input.interviewer_title || null,
      input.notes || null,
      input.outcome || null,
      input.duration_minutes || 60,
      input.location || null,
      input.video_link || null,
      input.google_calendar_event_id || null,
      input.prep_notes || null,
      input.questions_to_ask || null,
      input.research_notes || null,
    ]
  )) as Interview[];

  return rows[0]!;
}

export async function updateInterview(
  db: DbClient,
  userId: string,
  id: string,
  updates: Partial<CreateInterviewInput>
): Promise<Interview> {
  const sets: string[] = [];
  const values: Array<string | number | null> = [];
  let index = 1;

  const fields = [
    "scheduled_at",
    "interview_type",
    "interviewer_name",
    "interviewer_title",
    "notes",
    "outcome",
    "duration_minutes",
    "location",
    "video_link",
    "google_calendar_event_id",
    "prep_notes",
    "questions_to_ask",
    "research_notes",
  ] as const;

  for (const field of fields) {
    if (updates[field] !== undefined) {
      sets.push(`${field} = $${index++}`);
      values.push(updates[field] ?? null);
    }
  }

  if (sets.length > 0) {
    sets.push("updated_at = now()::text");
    values.push(userId, id);
    const query = `UPDATE interviews SET ${sets.join(", ")} WHERE user_id = $${index} AND id = $${index + 1} RETURNING *`;
    const rows = (await db.unsafe(query, values)) as Interview[];
    return rows[0]!;
  }

  const rows = (await db.unsafe(
    "SELECT * FROM interviews WHERE user_id = $1 AND id = $2",
    [userId, id]
  )) as Interview[];
  return rows[0]!;
}

export async function deleteInterview(
  db: DbClient,
  userId: string,
  id: string
): Promise<void> {
  await db.unsafe("DELETE FROM interviews WHERE user_id = $1 AND id = $2", [userId, id]);
}

export async function getAllInterviewsForContext(
  db: DbClient,
  userId: string,
  applicationId: string
): Promise<string> {
  const interviews = await getInterviewsByApplication(db, userId, applicationId);

  if (interviews.length === 0) {
    return "No interviews scheduled yet.";
  }

  return interviews
    .map((interview) => {
      const date = new Date(interview.scheduled_at).toLocaleDateString();
      return `
Interview on ${date}
Type: ${interview.interview_type || "Not specified"}
Interviewer: ${interview.interviewer_name || "Unknown"} (${interview.interviewer_title || "Unknown title"})
Outcome: ${interview.outcome || "Pending"}

Notes:
${interview.notes || "No notes recorded"}
    `.trim();
    })
    .join("\n\n---\n\n");
}
