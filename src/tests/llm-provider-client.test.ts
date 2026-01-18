import { parseJson } from "../llm/provider-client";import { describe, expect, test } from "bun:test";
import { describe, expect, test } from "bun:test";
import { parseJson } from "../llm/provider-client";

describe("parseJson", () => {
  test("parses plain JSON", () => {
    const parsed = parseJson('{"ok":true,"count":2}') as { ok: boolean; count: number };
    expect(parsed).toEqual({ ok: true, count: 2 });
  });

  test("parses fenced JSON", () => {
    const parsed = parseJson("```json\n{\"name\":\"Ada\"}\n```") as { name: string };
    expect(parsed).toEqual({ name: "Ada" });
  });

  test("parses JSON surrounded by text", () => {
    const parsed = parseJson("Sure, here you go:\n{\"items\":[1,2,3]}\nThanks!") as {
      items: number[];
    };
    expect(parsed).toEqual({ items: [1, 2, 3] });
  });

  test("parses JSON with trailing commas", () => {
    const parsed = parseJson('{"items":[1,2,],"ok":true,}') as {
      items: number[];
      ok: boolean;
    };
    expect(parsed).toEqual({ items: [1, 2], ok: true });
  });

  test("throws on non-JSON input", () => {
    expect(() => parseJson("not json")).toThrow("Failed to parse JSON from response");
  });
});
