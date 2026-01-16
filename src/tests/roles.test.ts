import postgres from "postgres";
import {
  createRole,
  getRoleById,
  updateRole,
  deleteRole,
  type CreateRoleInput,
} from "../db/roles";
import { createCompany } from "../db/companies";
import { runMigrations, type DbClient } from "../db";

const testDbUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!testDbUrl) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set to run tests");
}

describe("roles database operations", () => {
  let db: DbClient;
  let testCompanyId: string;

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

    const company = await createCompany(db, { name: "Test Company" });
    testCompanyId = company.id;
  });

  describe("createRole", () => {
    test("creates role with required fields", async () => {
      const role = await createRole(db, {
        company_id: testCompanyId,
        title: "Software Engineer",
      });

      expect(role.id).toBeDefined();
      expect(role.company_id).toBe(testCompanyId);
      expect(role.title).toBe("Software Engineer");
    });

    test("creates role with all fields", async () => {
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

      const role = await createRole(db, input);

      expect(role.title).toBe("Senior Engineer");
      expect(role.level).toBe("Senior");
      expect(role.location).toBe("San Francisco, CA");
      expect(role.compensation_range).toBe("$150k-$200k");
      expect(role.compensation_min).toBe(150000);
      expect(role.compensation_max).toBe(200000);
    });
  });

  describe("getRoleById", () => {
    test("returns role when found", async () => {
      const created = await createRole(db, {
        company_id: testCompanyId,
        title: "Product Manager",
      });

      const found = await getRoleById(db, created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.title).toBe("Product Manager");
    });

    test("returns null when not found", async () => {
      const found = await getRoleById(db, "nonexistent-id");
      expect(found).toBeNull();
    });
  });

  describe("updateRole", () => {
    test("updates single field", async () => {
      const created = await createRole(db, {
        company_id: testCompanyId,
        title: "Engineer",
      });

      const updated = await updateRole(db, created.id, {
        title: "Senior Engineer",
      });

      expect(updated.title).toBe("Senior Engineer");
    });

    test("updates linkedin_message field", async () => {
      const created = await createRole(db, {
        company_id: testCompanyId,
        title: "Engineer",
      });

      const updated = await updateRole(db, created.id, {
        linkedin_message: "Hi, I'm interested in this role...",
      });

      expect(updated.linkedin_message).toBe("Hi, I'm interested in this role...");
    });

    test("updates cover_letter field", async () => {
      const created = await createRole(db, {
        company_id: testCompanyId,
        title: "Engineer",
      });

      const updated = await updateRole(db, created.id, {
        cover_letter: "Dear Hiring Manager...",
      });

      expect(updated.cover_letter).toBe("Dear Hiring Manager...");
    });

    test("updates multiple fields", async () => {
      const created = await createRole(db, {
        company_id: testCompanyId,
        title: "Engineer",
      });

      const updated = await updateRole(db, created.id, {
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
    test("removes role from database", async () => {
      const created = await createRole(db, {
        company_id: testCompanyId,
        title: "To Delete",
      });

      await deleteRole(db, created.id);

      const found = await getRoleById(db, created.id);
      expect(found).toBeNull();
    });

    test("does not throw when deleting nonexistent role", async () => {
      await expect(deleteRole(db, "nonexistent")).resolves.toBeDefined();
    });
  });
});
