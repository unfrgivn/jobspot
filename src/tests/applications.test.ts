import postgres from "postgres";
import {
  getAllApplications,
  getApplicationByRoleId,
  createApplication,
  updateApplication,
  type ApplicationStatus,
} from "../db/applications";
import { runMigrations, type DbClient } from "../db";

const testDbUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!testDbUrl) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set to run tests");
}

describe("applications database operations", () => {
  let db: DbClient;

  beforeAll(async () => {
    db = postgres(testDbUrl, { max: 1 });
    await runMigrations(db);
  });

  afterAll(async () => {
    await db.end({ timeout: 5 });
  });

  beforeEach(async () => {
    await db.unsafe(
      "TRUNCATE TABLE application_questions, role_research, candidate_context, events, tasks, artifacts, interviews, contacts, applications, roles, companies, user_profile RESTART IDENTITY CASCADE"
    );

    await db.unsafe("INSERT INTO companies (id, name) VALUES ($1, $2)", ["comp-1", "Test Company"]);
    await db.unsafe("INSERT INTO roles (id, company_id, title) VALUES ($1, $2, $3)", [
      "role-1",
      "comp-1",
      "Software Engineer",
    ]);
    await db.unsafe("INSERT INTO roles (id, company_id, title) VALUES ($1, $2, $3)", [
      "role-2",
      "comp-1",
      "Product Manager",
    ]);
  });

  describe("createApplication", () => {
    test("creates application with default status", async () => {
      const app = await createApplication(db, { role_id: "role-1" });

      expect(app.id).toBeDefined();
      expect(app.role_id).toBe("role-1");
      expect(app.status).toBe("wishlist");
    });

    test("creates application with custom status", async () => {
      const app = await createApplication(db, { 
        role_id: "role-1",
        status: "applied",
      });

      expect(app.status).toBe("applied");
    });

    test("creates application with notes and via", async () => {
      const app = await createApplication(db, {
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
      await createApplication(db, { role_id: "role-1" });

      const found = await getApplicationByRoleId(db, "role-1");

      expect(found).not.toBeNull();
      expect(found?.role_id).toBe("role-1");
    });

    test("returns null when not found", async () => {
      const found = await getApplicationByRoleId(db, "nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("updateApplication", () => {
    test("updates status correctly", async () => {
      const app = await createApplication(db, { role_id: "role-1" });

      await updateApplication(db, app.id, { status: "interviewing" });

      const updated = await getApplicationByRoleId(db, "role-1");
      expect(updated?.status).toBe("interviewing");
    });

    test("handles all valid statuses", async () => {
      const statuses: ApplicationStatus[] = ["wishlist", "applied", "interviewing", "offer", "rejected", "withdrawn"];
      
      const app = await createApplication(db, { role_id: "role-1" });
      
      for (const status of statuses) {
        await expect(updateApplication(db, app.id, { status })).resolves.toBeDefined();
      }
    });

    test("updates notes field", async () => {
      const app = await createApplication(db, { role_id: "role-1" });

      await updateApplication(db, app.id, { notes: "Follow up next week" });

      const updated = await getApplicationByRoleId(db, "role-1");
      expect(updated?.notes).toBe("Follow up next week");
    });
  });

  describe("getAllApplications", () => {
    test("returns all applications with role and company data", async () => {
      await createApplication(db, { role_id: "role-1" });
      await createApplication(db, { role_id: "role-2" });

      const apps = await getAllApplications(db);

      expect(apps.length).toBeGreaterThanOrEqual(2);
    });

    test("returns empty array when no applications", async () => {
      const apps = await getAllApplications(db);
      expect(apps).toHaveLength(0);
    });
  });
});
