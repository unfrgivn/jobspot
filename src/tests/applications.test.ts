import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  getAllApplications,
  getApplicationByRoleId,
  createApplication,
  updateApplication,
  type ApplicationStatus,
} from "../db/applications";

describe("applications database operations", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    
    db.run(`
      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        website TEXT,
        logo_url TEXT,
        description TEXT,
        industry TEXT,
        size TEXT,
        location TEXT,
        culture_notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE roles (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id),
        title TEXT NOT NULL,
        description TEXT,
        requirements TEXT,
        location TEXT,
        compensation_range TEXT,
        job_url TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE applications (
        id TEXT PRIMARY KEY,
        role_id TEXT NOT NULL REFERENCES roles(id),
        status TEXT NOT NULL DEFAULT 'wishlist',
        applied_at TEXT,
        via TEXT,
        next_followup_at TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`INSERT INTO companies (id, name) VALUES ('comp-1', 'Test Company')`);
    db.run(`INSERT INTO roles (id, company_id, title) VALUES ('role-1', 'comp-1', 'Software Engineer')`);
    db.run(`INSERT INTO roles (id, company_id, title) VALUES ('role-2', 'comp-1', 'Product Manager')`);
  });

  afterEach(() => {
    db.close();
  });

  describe("createApplication", () => {
    test("creates application with default status", () => {
      const app = createApplication(db, { role_id: "role-1" });

      expect(app.id).toBeDefined();
      expect(app.role_id).toBe("role-1");
      expect(app.status).toBe("wishlist");
    });

    test("creates application with custom status", () => {
      const app = createApplication(db, { 
        role_id: "role-1",
        status: "applied",
      });

      expect(app.status).toBe("applied");
    });

    test("creates application with notes and via", () => {
      const app = createApplication(db, {
        role_id: "role-1",
        notes: "Referred by John",
        via: "LinkedIn",
      });

      expect(app.notes).toBe("Referred by John");
      expect(app.via).toBe("LinkedIn");
    });
  });

  describe("getApplicationByRoleId", () => {
    test("returns application when found", () => {
      createApplication(db, { role_id: "role-1" });

      const found = getApplicationByRoleId(db, "role-1");

      expect(found).not.toBeNull();
      expect(found?.role_id).toBe("role-1");
    });

    test("returns null when not found", () => {
      const found = getApplicationByRoleId(db, "nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("updateApplication", () => {
    test("updates status correctly", () => {
      const app = createApplication(db, { role_id: "role-1" });

      updateApplication(db, app.id, { status: "interviewing" });

      const updated = getApplicationByRoleId(db, "role-1");
      expect(updated?.status).toBe("interviewing");
    });

    test("handles all valid statuses", () => {
      const statuses: ApplicationStatus[] = ["wishlist", "applied", "interviewing", "offer", "rejected", "withdrawn"];
      
      const app = createApplication(db, { role_id: "role-1" });
      
      for (const status of statuses) {
        expect(() => updateApplication(db, app.id, { status })).not.toThrow();
      }
    });

    test("updates notes field", () => {
      const app = createApplication(db, { role_id: "role-1" });

      updateApplication(db, app.id, { notes: "Follow up next week" });

      const updated = getApplicationByRoleId(db, "role-1");
      expect(updated?.notes).toBe("Follow up next week");
    });
  });

  describe("getAllApplications", () => {
    test("returns all applications with role and company data", () => {
      createApplication(db, { role_id: "role-1" });
      createApplication(db, { role_id: "role-2" });

      const apps = getAllApplications(db);

      expect(apps.length).toBeGreaterThanOrEqual(2);
    });

    test("returns empty array when no applications", () => {
      const apps = getAllApplications(db);
      expect(apps).toHaveLength(0);
    });
  });
});
