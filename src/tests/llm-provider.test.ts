import { describe, expect, test } from "bun:test";
import {
  normalizeLlmProvider,
  requireLlmApiKey,
  resolveLlmApiKey,
  type Secrets,
} from "../config";

describe("llm provider config", () => {
  test("normalizes provider names", () => {
    expect(normalizeLlmProvider("Gemini")).toBe("gemini");
    expect(normalizeLlmProvider("OPENAI")).toBe("openai");
  });

  test("throws on unsupported providers", () => {
    expect(() => normalizeLlmProvider("unknown")).toThrow(
      "Unsupported LLM provider"
    );
  });

  test("resolves gemini key via GEMINI_API_KEY", () => {
    const secrets: Secrets = { gemini_api_key: "gemini-key" };
    const result = resolveLlmApiKey("gemini", secrets);

    expect(result.apiKey).toBe("gemini-key");
    expect(result.envVar).toBe("GEMINI_API_KEY");
  });

  test("resolves gemini key via legacy GOOGLE_API_KEY", () => {
    const secrets: Secrets = { google_api_key: "legacy-key" };
    const result = resolveLlmApiKey("gemini", secrets);

    expect(result.apiKey).toBe("legacy-key");
    expect(result.envVar).toBe("GOOGLE_API_KEY");
  });

  test("resolves OpenAI key", () => {
    const secrets: Secrets = { openai_api_key: "openai-key" };
    const result = resolveLlmApiKey("openai", secrets);

    expect(result.apiKey).toBe("openai-key");
    expect(result.envVar).toBe("OPENAI_API_KEY");
  });

  test("returns expected env var when key missing", () => {
    const result = resolveLlmApiKey("anthropic", {});

    expect(result.apiKey).toBeUndefined();
    expect(result.envVar).toBe("ANTHROPIC_API_KEY");
  });

  test("requireLlmApiKey throws with provider env vars", () => {
    expect(() => requireLlmApiKey("gemini", {})).toThrow(
      "GEMINI_API_KEY or GOOGLE_API_KEY not configured"
    );
  });
});
