import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  createInterview,
  getInterviewById,
  getInterviewsByApplication,
  updateInterview,
  deleteInterview,
  getAllInterviewsForContext,
  type Interview,
  type CreateInterviewInput,
} from "../db/interviews";

describe("interviews database operations", () => {
  let db: Database;
  const testApplicationId = "test-app-id-123";

  beforeEach(() => {
    db = new Database(":memory:");
    
    db.run(`
      CREATE TABLE interviews (
        id TEXT PRIMARY KEY,
        application_id TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        interview_type TEXT,
        interviewer_name TEXT,
        interviewer_title TEXT,
        notes TEXT,
        outcome TEXT,
        duration_minutes INTEGER DEFAULT 60,
        location TEXT,
        video_link TEXT,
        google_calendar_event_id TEXT,
        prep_notes TEXT,
        questions_to_ask TEXT,
        research_notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  });

  afterEach(() => {
    db.close();
  });

  describe("createInterview", () => {
    test("creates interview with required fields only", () => {
      const input: CreateInterviewInput = {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
      };

      const interview = createInterview(db, input);

      expect(interview.id).toBeDefined();
      expect(interview.application_id).toBe(testApplicationId);
      expect(interview.scheduled_at).toBe("2025-01-15T10:00:00Z");
      expect(interview.duration_minutes).toBe(60);
      expect(interview.interview_type).toBeNull();
    });

    test("creates interview with all fields", () => {
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

      const interview = createInterview(db, input);

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
    test("returns interview when found", () => {
      const created = createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
      });

      const found = getInterviewById(db, created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    test("returns null when not found", () => {
      const found = getInterviewById(db, "nonexistent-id");
      expect(found).toBeNull();
    });
  });

  describe("getInterviewsByApplication", () => {
    test("returns all interviews for application ordered by date desc", () => {
      createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-10T10:00:00Z",
      });
      createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-20T10:00:00Z",
      });
      createInterview(db, {
        application_id: "other-app",
        scheduled_at: "2025-01-15T10:00:00Z",
      });

      const interviews = getInterviewsByApplication(db, testApplicationId);

      expect(interviews).toHaveLength(2);
      expect(interviews[0]!.scheduled_at).toBe("2025-01-20T10:00:00Z");
      expect(interviews[1]!.scheduled_at).toBe("2025-01-10T10:00:00Z");
    });

    test("returns empty array when no interviews", () => {
      const interviews = getInterviewsByApplication(db, "nonexistent-app");
      expect(interviews).toHaveLength(0);
    });
  });

  describe("updateInterview", () => {
    test("updates single field", () => {
      const created = createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
      });

      const updated = updateInterview(db, created.id, {
        interview_type: "behavioral",
      });

      expect(updated.interview_type).toBe("behavioral");
      expect(updated.scheduled_at).toBe("2025-01-15T10:00:00Z");
    });

    test("updates multiple fields", () => {
      const created = createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
      });

      const updated = updateInterview(db, created.id, {
        prep_notes: "Study algorithms",
        questions_to_ask: "Growth opportunities?",
        research_notes: "Series B startup",
      });

      expect(updated.prep_notes).toBe("Study algorithms");
      expect(updated.questions_to_ask).toBe("Growth opportunities?");
      expect(updated.research_notes).toBe("Series B startup");
    });

    test("updates outcome field", () => {
      const created = createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
        outcome: "pending",
      });

      const updated = updateInterview(db, created.id, {
        outcome: "passed",
      });

      expect(updated.outcome).toBe("passed");
    });
  });

  describe("deleteInterview", () => {
    test("removes interview from database", () => {
      const created = createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
      });

      deleteInterview(db, created.id);

      const found = getInterviewById(db, created.id);
      expect(found).toBeNull();
    });

    test("does not throw when deleting nonexistent interview", () => {
      expect(() => deleteInterview(db, "nonexistent-id")).not.toThrow();
    });
  });

  describe("getAllInterviewsForContext", () => {
    test("returns formatted context string for multiple interviews", () => {
      createInterview(db, {
        application_id: testApplicationId,
        scheduled_at: "2025-01-15T10:00:00Z",
        interview_type: "technical",
        interviewer_name: "Alice",
        interviewer_title: "Staff Engineer",
        outcome: "passed",
        notes: "Great discussion",
      });

      const context = getAllInterviewsForContext(db, testApplicationId);

      expect(context).toContain("Interview on");
      expect(context).toContain("Type: technical");
      expect(context).toContain("Interviewer: Alice");
      expect(context).toContain("Outcome: passed");
      expect(context).toContain("Great discussion");
    });

    test("returns no interviews message when empty", () => {
      const context = getAllInterviewsForContext(db, "empty-app");
      expect(context).toBe("No interviews scheduled yet.");
    });
  });
});
