import { findRoot, dbPath } from "../workspace";
import { getDb } from "../db";

interface TaskRow {
  kind: string;
  due_at: string;
  role_title: string;
  company_name: string;
}

interface StatusCount {
  status: string;
  count: number;
}

interface InterviewRow {
  round_name: string;
  scheduled_at: string;
  role_title: string;
  company_name: string;
}

interface RecentApp {
  role_title: string;
  company_name: string;
  status: string;
  applied_at: string;
}

export interface ReviewData {
  tasks: TaskRow[];
  statusCounts: StatusCount[];
  interviews: InterviewRow[];
  recentApps: RecentApp[];
}

export function getReviewData(): ReviewData {
  const root = findRoot();
  const db = getDb(dbPath(root));

  const tasks = db
    .query<TaskRow, []>(
      `SELECT t.kind, t.due_at, r.title as role_title, c.name as company_name
       FROM tasks t
       JOIN applications a ON t.application_id = a.id
       JOIN roles r ON a.role_id = r.id
       JOIN companies c ON r.company_id = c.id
       WHERE t.status = 'pending'
       ORDER BY t.due_at ASC
       LIMIT 10`
    )
    .all();

  const statusCounts = db
    .query<StatusCount, []>(
      `SELECT status, COUNT(*) as count
       FROM applications
       GROUP BY status
       ORDER BY count DESC`
    )
    .all();

  const interviews = db
    .query<InterviewRow, []>(
      `SELECT i.round_name, i.scheduled_at, r.title as role_title, c.name as company_name
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN roles r ON a.role_id = r.id
       JOIN companies c ON r.company_id = c.id
       WHERE i.scheduled_at > datetime('now')
       ORDER BY i.scheduled_at ASC
       LIMIT 5`
    )
    .all();

  const recentApps = db
    .query<RecentApp, []>(
      `SELECT r.title as role_title, c.name as company_name, a.status, a.applied_at
       FROM applications a
       JOIN roles r ON a.role_id = r.id
       JOIN companies c ON r.company_id = c.id
       ORDER BY a.created_at DESC
       LIMIT 5`
    )
    .all();

  return { tasks, statusCounts, interviews, recentApps };
}

export async function review(weekly: boolean): Promise<void> {
  console.log("=== Job Search Review ===\n");

  const data = getReviewData();

  if (data.tasks.length > 0) {
    console.log("📋 Pending Tasks:");
    for (const task of data.tasks) {
      const dueDate = new Date(task.due_at).toLocaleDateString();
      console.log(`  • [${task.kind}] ${task.company_name} - ${task.role_title} (due: ${dueDate})`);
    }
    console.log("");
  }

  if (data.interviews.length > 0) {
    console.log("📅 Upcoming Interviews:");
    for (const interview of data.interviews) {
      const date = new Date(interview.scheduled_at).toLocaleString();
      console.log(`  • ${interview.company_name} - ${interview.round_name} (${date})`);
    }
    console.log("");
  }

  if (data.statusCounts.length > 0) {
    console.log("📊 Pipeline Status:");
    for (const row of data.statusCounts) {
      console.log(`  • ${row.status}: ${row.count}`);
    }
    console.log("");
  }

  if (data.recentApps.length > 0) {
    console.log("🕐 Recent Applications:");
    for (const app of data.recentApps) {
      const appliedDate = app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "not applied";
      console.log(`  • ${app.company_name} - ${app.role_title} [${app.status}] (${appliedDate})`);
    }
    console.log("");
  }

  if (data.tasks.length === 0 && data.interviews.length === 0 && data.statusCounts.length === 0) {
    console.log("No applications yet. Run: jobsearch add --url <job-url>");
  }
}
