import postgres from "postgres";
import {
  createInterview,
  getInterviewById,
  getInterviewsByApplication,
  updateInterview,
  deleteInterview,
  getAllInterviewsForContext,
  type CreateInterviewInput,
} from "../db/interviews";
import { runMigrations, type DbClient } from "../db";

const testDbUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!testDbUrl) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL must be set to run tests");
}

describe("interviews database operations", () => {
  let db: DbClient;
  const testApplicationId = "test-app-id-123";

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
    await db.unsafe("INSERT INTO applications (id, role_id, status) VALUES ($1, $2, $3)", [
      testApplicationId,
      "role-1",
      "applied",
    ]);
  });

  describe("createInterview", () => {
    test("creates interview with required fields only", async () => {
      const input: CreateInterviewInput = {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
      };

      const interview = await createInterview(db, input);

      expect(interview.id).toBeDefined();
      expect(interview.application_id).toBe(testApplicationId);
      expect(interview.scheduled_at).toBe("2025-01-15T10:00:00Z");
      expect(interview.duration_minutes).toBe(60);
      expect(interview.interview_type).toBeNull();
    });

    test("creates interview with all fields", async () => {
      const input: CreateInterviewInput = {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
        interview_type: "technical",
        interviewer_name: "John Doe",
        interviewer_title: "Engineering Manager",
        notes: "Focus on system design",
        outcome: "pending",
        duration_minutes: 45,
        location: "Zoom",
        video_link: "https://zoom.us/j/123",
        prep_notes: "Review distributed systems",
        questions_to_ask: "What's the team structure?",
        research_notes: "Company uses microservices",
      };

      const interview = await createInterview(db, input);

      expect(interview.interview_type).toBe("technical");
      expect(interview.interviewer_name).toBe("John Doe");
      expect(interview.interviewer_title).toBe("Engineering Manager");
      expect(interview.notes).toBe("Focus on system design");
      expect(interview.duration_minutes).toBe(45);
      expect(interview.prep_notes).toBe("Review distributed systems");
      expect(interview.questions_to_ask).toBe("What's the team structure?");
      expect(interview.research_notes).toBe("Company uses microservices");
    });
  });

  describe("getInterviewById", () => {
    test("returns interview when found", async () => {
      const created = await createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
      });

      const found = await getInterviewById(db, created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    test("returns null when not found", async () => {
      const found = await getInterviewById(db, "nonexistent-id");
      expect(found).toBeNull();
    });
  });

  describe("getInterviewsByApplication", () => {
    test("returns all interviews for application ordered by date desc", async () => {
      await createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-10T10:00:00Z",
      });
      await createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-20T10:00:00Z",
      });
      await createInterview(db, {
        application_id: "other-app",
        scheduled_at: "2025-01-15T10:00:00Z",
      });

      const interviews = await getInterviewsByApplication(db, testApplicationId);

      expect(interviews).toHaveLength(2);
      expect(interviews[0]!.scheduled_at).toBe("2025-01-20T10:00:00Z");
      expect(interviews[1]!.scheduled_at).toBe("2025-01-10T10:00:00Z");
    });

    test("returns empty array when no interviews", async () => {
      const interviews = await getInterviewsByApplication(db, "nonexistent-app");
      expect(interviews).toHaveLength(0);
    });
  });

  describe("updateInterview", () => {
    test("updates single field", async () => {
      const created = await createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
      });

      const updated = await updateInterview(db, created.id, {
        interview_type: "behavioral",
      });

      expect(updated.interview_type).toBe("behavioral");
      expect(updated.scheduled_at).toBe("2025-01-15T10:00:00Z");
    });

    test("updates multiple fields", async () => {
      const created = await createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
      });

      const updated = await updateInterview(db, created.id, {
        prep_notes: "Study algorithms",
        questions_to_ask: "Growth opportunities?",
        research_notes: "Series B startup",
      });

      expect(updated.prep_notes).toBe("Study algorithms");
      expect(updated.questions_to_ask).toBe("Growth opportunities?");
      expect(updated.research_notes).toBe("Series B startup");
    });

    test("updates outcome field", async () => {
      const created = await createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
        outcome: "pending",
      });

      const updated = await updateInterview(db, created.id, {
        outcome: "passed",
      });

      expect(updated.outcome).toBe("passed");
    });
  });

  describe("deleteInterview", () => {
    test("removes interview from database", async () => {
      const created = await createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
      });

      await deleteInterview(db, created.id);

      const found = await getInterviewById(db, created.id);
      expect(found).toBeNull();
    });

    test("does not throw when deleting nonexistent interview", async () => {
      await expect(deleteInterview(db, "nonexistent")).resolves.toBeDefined();
    });
  });

  describe("getAllInterviewsForContext", () => {
    test("returns formatted string with interviews", async () => {
      await createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-10T10:00:00Z",
        interview_type: "technical",
        interviewer_name: "Jane",
      });

      const context = await getAllInterviewsForContext(db, testApplicationId);
      expect(context).toContain("Interview on");
      expect(context).toContain("technical");
    });

    test("returns message when no interviews", async () => {
      const context = await getAllInterviewsForContext(db, "nonexistent");
      expect(context).toBe("No interviews scheduled yet.");
    });
  });
});
