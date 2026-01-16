import type { Database } from "bun:sqlite";
import { v4 as uuidv4 } from "uuid";

export interface Interview {
  id: string;
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

export function getInterviewsByApplication(db: Database, applicationId: string): Interview[] {
  const rows = db.query(`
    SELECT * FROM interviews 
    WHERE application_id = ? 
    ORDER BY scheduled_at DESC
  `).all(applicationId);
  
  return rows as Interview[];
}

export function getInterviewById(db: Database, id: string): Interview | null {
  const row = db.query(`
    SELECT * FROM interviews WHERE id = ?
  `).get(id);
  
  return row as Interview | null;
}

export function createInterview(db: Database, input: CreateInterviewInput): Interview {
  const id = uuidv4();
  
  db.run(
    `INSERT INTO interviews (
      id, application_id, scheduled_at, interview_type, 
      interviewer_name, interviewer_title, notes, outcome,
      duration_minutes, location, video_link, google_calendar_event_id,
      prep_notes, questions_to_ask, research_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
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
  );
  
  return getInterviewById(db, id)!;
}

export function updateInterview(
  db: Database,
  id: string,
  updates: Partial<CreateInterviewInput>
): Interview {
  const sets: string[] = [];
  const values: any[] = [];
  
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
      sets.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }
  
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    db.run(`UPDATE interviews SET ${sets.join(", ")} WHERE id = ?`, values);
  }
  
  return getInterviewById(db, id)!;
}

export function deleteInterview(db: Database, id: string): void {
  db.run(`DELETE FROM interviews WHERE id = ?`, [id]);
}

export function getAllInterviewsForContext(db: Database, applicationId: string): string {
  const interviews = getInterviewsByApplication(db, applicationId);
  
  if (interviews.length === 0) {
    return "No interviews scheduled yet.";
  }
  
  return interviews.map(interview => {
    const date = new Date(interview.scheduled_at).toLocaleDateString();
    return `
Interview on ${date}
Type: ${interview.interview_type || 'Not specified'}
Interviewer: ${interview.interviewer_name || 'Unknown'} (${interview.interviewer_title || 'Unknown title'})
Outcome: ${interview.outcome || 'Pending'}

Notes:
${interview.notes || 'No notes recorded'}
    `.trim();
  }).join('\n\n---\n\n');
}
