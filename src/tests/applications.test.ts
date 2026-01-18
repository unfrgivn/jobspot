import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import {
  getAllApplications,
  getApplicationByRoleId,
  createApplication,
  updateApplication,
  type ApplicationStatus,
} from "../db/applications";
import {
  runMigrations,
  exportUserBackup,
  restoreUserBackup,
  type BackupData,
  type DbClient,
} from "../db";

const testDbUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!testDbUrl) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set to run tests");
}

describe("applications database operations", () => {
  let db: DbClient;
  const userId = "user-1";

  beforeAll(async () => {
    db = postgres(testDbUrl, { max: 1 });
    await runMigrations(db);
  });

  afterAll(async () => {
    await db.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await db.unsafe(
      "TRUNCATE TABLE application_questions, role_research, candidate_context, events, tasks, artifacts, interviews, contacts, applications, roles, companies, user_profile, sessions, users RESTART IDENTITY CASCADE"
    );

    await db.unsafe(
      "INSERT INTO users (id, google_sub, email, name) VALUES ($1, $2, $3, $4)",
      [userId, `sub-${userId}`, "user@example.com", "Test User"]
    );
    await db.unsafe("INSERT INTO companies (id, user_id, name) VALUES ($1, $2, $3)", [
      "comp-1",
      userId,
      "Test Company",
    ]);
    await db.unsafe("INSERT INTO roles (id, user_id, company_id, title) VALUES ($1, $2, $3, $4)", [
      "role-1",
      userId,
      "comp-1",
      "Software Engineer",
    ]);
    await db.unsafe("INSERT INTO roles (id, user_id, company_id, title) VALUES ($1, $2, $3, $4)", [
      "role-2",
      userId,
      "comp-1",
      "Product Manager",
    ]);
  });

  describe("createApplication", () => {
    test("creates application with default status", async () => {
      const app = await createApplication(db, userId, { role_id: "role-1" });

      expect(app.id).toBeDefined();
      expect(app.role_id).toBe("role-1");
      expect(app.status).toBe("wishlist");
    });

    test("creates application with custom status", async () => {
      const app = await createApplication(db, userId, { 
        role_id: "role-1",
        status: "applied",
      });

      expect(app.status).toBe("applied");
    });

    test("creates application with notes and via", async () => {
      const app = await createApplication(db, userId, {
        role_id: "role-1",
        notes: "Referred by John",
        via: "LinkedIn",
      });

      expect(app.notes).toBe("Referred by John");
      expect(app.via).toBe("LinkedIn");
    });
  });

  describe("getApplicationByRoleId", () => {
    test("returns application when found", async () => {
      await createApplication(db, userId, { role_id: "role-1" });

      const found = await getApplicationByRoleId(db, userId, "role-1");

      expect(found).not.toBeNull();
      expect(found?.role_id).toBe("role-1");
    });

    test("returns null when not found", async () => {
      const found = await getApplicationByRoleId(db, userId, "nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("updateApplication", () => {
    test("updates status correctly", async () => {
      const app = await createApplication(db, userId, { role_id: "role-1" });

      await updateApplication(db, userId, app.id, { status: "interviewing" });

      const updated = await getApplicationByRoleId(db, userId, "role-1");
      expect(updated?.status).toBe("interviewing");
    });

    test("handles all valid statuses", async () => {
      const statuses: ApplicationStatus[] = ["wishlist", "applied", "interviewing", "offer", "rejected", "withdrawn"];
      
      const app = await createApplication(db, userId, { role_id: "role-1" });
      
      for (const status of statuses) {
        await expect(updateApplication(db, userId, app.id, { status })).resolves.toBeDefined();
      }
    });

    test("updates notes field", async () => {
      const app = await createApplication(db, userId, { role_id: "role-1" });

      await updateApplication(db, userId, app.id, { notes: "Follow up next week" });

      const updated = await getApplicationByRoleId(db, userId, "role-1");
      expect(updated?.notes).toBe("Follow up next week");
    });
  });

  describe("getAllApplications", () => {
    test("returns all applications with role and company data", async () => {
      await createApplication(db, userId, { role_id: "role-1" });
      await createApplication(db, userId, { role_id: "role-2" });

      const apps = await getAllApplications(db, userId);

      expect(apps.length).toBeGreaterThanOrEqual(2);
    });

    test("returns empty array when no applications", async () => {
      const apps = await getAllApplications(db, userId);
      expect(apps).toHaveLength(0);
    });
  });
});

describe("backup and restore", () => {
  let db: DbClient;

  const userA = "user-a";
  const userB = "user-b";

  const insertUser = async (userId: string, label: string) => {
    await db.unsafe(
      "INSERT INTO users (id, google_sub, email, name) VALUES ($1, $2, $3, $4)",
      [userId, `sub-${userId}`, `${label}@example.com`, `User ${label}`]
    );
  };

  const seedUserData = async (userId: string, suffix: string) => {
    const now = new Date().toISOString();

    await db.unsafe(
      "INSERT INTO user_profile (id, user_id, full_name, email) VALUES ($1, $2, $3, $4)",
      [`profile-${suffix}`, userId, `User ${suffix}`, `${suffix}@example.com`]
    );
    await db.unsafe(
      "INSERT INTO candidate_context (id, user_profile_id, executive_summary) VALUES ($1, $2, $3)",
      [`context-${suffix}`, `profile-${suffix}`, `Summary ${suffix}`]
    );
    await db.unsafe(
      "INSERT INTO companies (id, user_id, name) VALUES ($1, $2, $3)",
      [`comp-${suffix}`, userId, `Company ${suffix}`]
    );
    await db.unsafe(
      "INSERT INTO roles (id, user_id, company_id, title) VALUES ($1, $2, $3, $4)",
      [`role-${suffix}`, userId, `comp-${suffix}`, `Role ${suffix}`]
    );
    await db.unsafe(
      "INSERT INTO applications (id, user_id, role_id, status) VALUES ($1, $2, $3, $4)",
      [`app-${suffix}`, userId, `role-${suffix}`, "applied"]
    );
    await db.unsafe(
      "INSERT INTO contacts (id, user_id, company_id, name) VALUES ($1, $2, $3, $4)",
      [`contact-${suffix}`, userId, `comp-${suffix}`, `Contact ${suffix}`]
    );
    await db.unsafe(
      "INSERT INTO interviews (id, user_id, application_id, round_name, scheduled_at, notes) VALUES ($1, $2, $3, $4, $5, $6)",
      [`interview-${suffix}`, userId, `app-${suffix}`, `Round ${suffix}`, now, `Notes ${suffix}`]
    );
    await db.unsafe(
      "INSERT INTO artifacts (id, user_id, application_id, kind, path) VALUES ($1, $2, $3, $4, $5)",
      [`artifact-${suffix}`, userId, `app-${suffix}`, "resume", `/tmp/${suffix}.pdf`]
    );
    await db.unsafe(
      "INSERT INTO tasks (id, user_id, application_id, kind, status) VALUES ($1, $2, $3, $4, $5)",
      [`task-${suffix}`, userId, `app-${suffix}`, "follow_up", "open"]
    );
    await db.unsafe(
      "INSERT INTO events (id, user_id, application_id, event_type, occurred_at) VALUES ($1, $2, $3, $4, $5)",
      [`event-${suffix}`, userId, `app-${suffix}`, "application_submitted", now]
    );
    await db.unsafe(
      "INSERT INTO role_research (id, user_id, role_id, company_profile) VALUES ($1, $2, $3, $4)",
      [`research-${suffix}`, userId, `role-${suffix}`, `Profile ${suffix}`]
    );
    await db.unsafe(
      "INSERT INTO application_questions (id, user_id, role_id, question) VALUES ($1, $2, $3, $4)",
      [`question-${suffix}`, userId, `role-${suffix}`, `Question ${suffix}`]
    );
  };

  const getCount = async (query: string, params: string[]): Promise<number> => {
    const rows = (await db.unsafe(query, params)) as Array<{ count: number | string }>;
    return Number(rows[0]?.count ?? 0);
  };

  const getCounts = async (userId: string) => {
    return {
      user_profile: await getCount("SELECT COUNT(*) AS count FROM user_profile WHERE user_id = $1", [userId]),
      candidate_context: await getCount(
        "SELECT COUNT(*) AS count FROM candidate_context WHERE user_profile_id IN (SELECT id FROM user_profile WHERE user_id = $1)",
        [userId]
      ),
      companies: await getCount("SELECT COUNT(*) AS count FROM companies WHERE user_id = $1", [userId]),
      roles: await getCount("SELECT COUNT(*) AS count FROM roles WHERE user_id = $1", [userId]),
      applications: await getCount("SELECT COUNT(*) AS count FROM applications WHERE user_id = $1", [userId]),
      contacts: await getCount("SELECT COUNT(*) AS count FROM contacts WHERE user_id = $1", [userId]),
      interviews: await getCount("SELECT COUNT(*) AS count FROM interviews WHERE user_id = $1", [userId]),
      artifacts: await getCount("SELECT COUNT(*) AS count FROM artifacts WHERE user_id = $1", [userId]),
      tasks: await getCount("SELECT COUNT(*) AS count FROM tasks WHERE user_id = $1", [userId]),
      events: await getCount("SELECT COUNT(*) AS count FROM events WHERE user_id = $1", [userId]),
      role_research: await getCount("SELECT COUNT(*) AS count FROM role_research WHERE user_id = $1", [userId]),
      application_questions: await getCount(
        "SELECT COUNT(*) AS count FROM application_questions WHERE user_id = $1",
        [userId]
      ),
    };
  };

  beforeAll(async () => {
    db = postgres(testDbUrl, { max: 1 });
    await runMigrations(db);
  });

  afterAll(async () => {
    await db.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await db.unsafe(
      "TRUNCATE TABLE application_questions, role_research, candidate_context, events, tasks, artifacts, interviews, contacts, applications, roles, companies, user_profile, sessions, users RESTART IDENTITY CASCADE"
    );
  });

  test("exports and restores user data without touching other users", async () => {
    await insertUser(userA, "a");
    await insertUser(userB, "b");
    await seedUserData(userA, "a");
    await seedUserData(userB, "b");

    const backup = await exportUserBackup(db, userA);
    const userBCountsBefore = await getCounts(userB);

    await db.unsafe(
      "INSERT INTO companies (id, user_id, name) VALUES ($1, $2, $3)",
      ["comp-a-extra", userA, "Company Extra"]
    );

    await restoreUserBackup(db, userA, backup);

    const userACountsAfter = await getCounts(userA);
    expect(userACountsAfter).toEqual({
      user_profile: backup.user_profile.length,
      candidate_context: backup.candidate_context.length,
      companies: backup.companies.length,
      roles: backup.roles.length,
      applications: backup.applications.length,
      contacts: backup.contacts.length,
      interviews: backup.interviews.length,
      artifacts: backup.artifacts.length,
      tasks: backup.tasks.length,
      events: backup.events.length,
      role_research: backup.role_research.length,
      application_questions: backup.application_questions.length,
    });

    const userBCountsAfter = await getCounts(userB);
    expect(userBCountsAfter).toEqual(userBCountsBefore);
  });

  test("restores empty backup by clearing only target user data", async () => {
    await insertUser(userA, "a");
    await insertUser(userB, "b");
    await seedUserData(userA, "a");
    await seedUserData(userB, "b");

    const emptyBackup: BackupData = {
      user_profile: [],
      candidate_context: [],
      companies: [],
      roles: [],
      applications: [],
      contacts: [],
      interviews: [],
      artifacts: [],
      tasks: [],
      events: [],
      role_research: [],
      application_questions: [],
    };

    const userBCountsBefore = await getCounts(userB);

    await restoreUserBackup(db, userA, emptyBackup);

    const userACountsAfter = await getCounts(userA);
    expect(userACountsAfter).toEqual({
      user_profile: 0,
      candidate_context: 0,
      companies: 0,
      roles: 0,
      applications: 0,
      contacts: 0,
      interviews: 0,
      artifacts: 0,
      tasks: 0,
      events: 0,
      role_research: 0,
      application_questions: 0,
    });

    const userBCountsAfter = await getCounts(userB);
    expect(userBCountsAfter).toEqual(userBCountsBefore);
  });
});
