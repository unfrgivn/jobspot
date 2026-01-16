import { describe, test, expect } from "bun:test";
import {
  isCalendarConfigured,
  isCalendarConnected,
  generateAuthUrl,
  type CalendarCredentials,
} from "../integrations/google-calendar";

describe("google calendar integration", () => {
  describe("isCalendarConfigured", () => {
    test("returns true when clientId and clientSecret are set", () => {
      const credentials = {
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      };

      expect(isCalendarConfigured(credentials)).toBe(true);
    });

    test("returns false when clientId is missing", () => {
      const credentials = {
        clientSecret: "test-client-secret",
      };

      expect(isCalendarConfigured(credentials)).toBe(false);
    });

    test("returns false when clientSecret is missing", () => {
      const credentials = {
        clientId: "test-client-id",
      };

      expect(isCalendarConfigured(credentials)).toBe(false);
    });

    test("returns false when both are missing", () => {
      expect(isCalendarConfigured({})).toBe(false);
    });
  });

  describe("isCalendarConnected", () => {
    test("returns true when all credentials are set", () => {
      const credentials: CalendarCredentials = {
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        refreshToken: "test-refresh-token",
      };

      expect(isCalendarConnected(credentials)).toBe(true);
    });

    test("returns false when refreshToken is missing", () => {
      const credentials = {
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      };

      expect(isCalendarConnected(credentials)).toBe(false);
    });

    test("returns false when clientId is missing", () => {
      const credentials = {
        clientSecret: "test-client-secret",
        refreshToken: "test-refresh-token",
      };

      expect(isCalendarConnected(credentials)).toBe(false);
    });
  });

  describe("generateAuthUrl", () => {
    test("generates valid OAuth URL with required scopes", () => {
      const credentials: CalendarCredentials = {
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      };

      const url = generateAuthUrl(credentials);

      expect(url).toContain("accounts.google.com");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("access_type=offline");
      expect(url).toContain("scope=");
      expect(url).toContain("calendar.events");
      expect(url).toContain("calendar.readonly");
    });

    test("includes consent prompt for refresh token", () => {
      const credentials: CalendarCredentials = {
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      };

      const url = generateAuthUrl(credentials);

      expect(url).toContain("prompt=consent");
    });
  });
});
