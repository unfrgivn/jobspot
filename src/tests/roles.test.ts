import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  createRole,
  getRoleById,
  updateRole,
  deleteRole,
  type CreateRoleInput,
} from "../db/roles";
import {
  createCompany,
} from "../db/companies";

describe("roles database operations", () => {
  let db: Database;
  let testCompanyId: string;

  beforeEach(() => {
    db = new Database(":memory:");
    
    db.run(`
      CREATE TABLE companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        website TEXT,
        headquarters TEXT,
        logo_url TEXT,
        description TEXT,
        notes TEXT,
        industry TEXT,
        funding_status TEXT,
        company_size TEXT,
        established_date TEXT,
        research_sources TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE roles (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id),
        title TEXT NOT NULL,
        level TEXT,
        location TEXT,
        job_url TEXT,
        jd_text TEXT,
        source TEXT,
        compensation_range TEXT,
        compensation_min INTEGER,
        compensation_max INTEGER,
        linkedin_message TEXT,
        cover_letter TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE role_research (
        id TEXT PRIMARY KEY,
        role_id TEXT NOT NULL REFERENCES roles(id),
        content TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    const company = createCompany(db, { name: "Test Company" });
    testCompanyId = company.id;
  });

  afterEach(() => {
    db.close();
  });

  describe("createRole", () => {
    test("creates role with required fields", () => {
      const role = createRole(db, {
        company_id: testCompanyId,
        title: "Software Engineer",
      });

      expect(role.id).toBeDefined();
      expect(role.company_id).toBe(testCompanyId);
      expect(role.title).toBe("Software Engineer");
    });

    test("creates role with all fields", () => {
      const input: CreateRoleInput = {
        company_id: testCompanyId,
        title: "Senior Engineer",
        level: "Senior",
        location: "San Francisco, CA",
        job_url: "https://example.com/jobs/123",
        jd_text: "Build scalable systems",
        source: "LinkedIn",
        compensation_range: "$150k-$200k",
        compensation_min: 150000,
        compensation_max: 200000,
      };

      const role = createRole(db, input);

      expect(role.title).toBe("Senior Engineer");
      expect(role.level).toBe("Senior");
      expect(role.location).toBe("San Francisco, CA");
      expect(role.compensation_range).toBe("$150k-$200k");
      expect(role.compensation_min).toBe(150000);
      expect(role.compensation_max).toBe(200000);
    });
  });

  describe("getRoleById", () => {
    test("returns role when found", () => {
      const created = createRole(db, {
        company_id: testCompanyId,
        title: "Product Manager",
      });

      const found = getRoleById(db, created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.title).toBe("Product Manager");
    });

    test("returns null when not found", () => {
      const found = getRoleById(db, "nonexistent-id");
      expect(found).toBeNull();
    });
  });

  describe("updateRole", () => {
    test("updates single field", () => {
      const created = createRole(db, {
        company_id: testCompanyId,
        title: "Engineer",
      });

      const updated = updateRole(db, created.id, {
        title: "Senior Engineer",
      });

      expect(updated.title).toBe("Senior Engineer");
    });

    test("updates linkedin_message field", () => {
      const created = createRole(db, {
        company_id: testCompanyId,
        title: "Engineer",
      });

      const updated = updateRole(db, created.id, {
        linkedin_message: "Hi, I'm interested in this role...",
      });

      expect(updated.linkedin_message).toBe("Hi, I'm interested in this role...");
    });

    test("updates cover_letter field", () => {
      const created = createRole(db, {
        company_id: testCompanyId,
        title: "Engineer",
      });

      const updated = updateRole(db, created.id, {
        cover_letter: "Dear Hiring Manager...",
      });

      expect(updated.cover_letter).toBe("Dear Hiring Manager...");
    });

    test("updates multiple fields", () => {
      const created = createRole(db, {
        company_id: testCompanyId,
        title: "Engineer",
      });

      const updated = updateRole(db, created.id, {
        jd_text: "New job description",
        location: "Remote",
        compensation_range: "$100k-$150k",
      });

      expect(updated.jd_text).toBe("New job description");
      expect(updated.location).toBe("Remote");
      expect(updated.compensation_range).toBe("$100k-$150k");
    });
  });

  describe("deleteRole", () => {
    test("removes role from database", () => {
      const created = createRole(db, {
        company_id: testCompanyId,
        title: "To Delete",
      });

      db.run(`CREATE TABLE IF NOT EXISTS tasks (id TEXT, application_id TEXT)`);
      db.run(`CREATE TABLE IF NOT EXISTS interviews (id TEXT, application_id TEXT)`);
      db.run(`CREATE TABLE IF NOT EXISTS applications (id TEXT, role_id TEXT)`);
      db.run(`CREATE TABLE IF NOT EXISTS questions (id TEXT, role_id TEXT)`);

      deleteRole(db, created.id);

      const found = getRoleById(db, created.id);
      expect(found).toBeNull();
    });

    test("does not throw when deleting nonexistent role", () => {
      db.run(`CREATE TABLE IF NOT EXISTS tasks (id TEXT, application_id TEXT)`);
      db.run(`CREATE TABLE IF NOT EXISTS interviews (id TEXT, application_id TEXT)`);
      db.run(`CREATE TABLE IF NOT EXISTS applications (id TEXT, role_id TEXT)`);
      db.run(`CREATE TABLE IF NOT EXISTS questions (id TEXT, role_id TEXT)`);

      expect(() => deleteRole(db, "nonexistent")).not.toThrow();
    });
  });
});
