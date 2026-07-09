import { describe, expect, test } from "bun:test";
import { getOpenAiApiKey } from "../src/env";

describe("getOpenAiApiKey", () => {
  test("returns a trimmed OPENAI_API_KEY", () => {
    expect(getOpenAiApiKey({ OPENAI_API_KEY: "  sk-test  " })).toBe("sk-test");
  });

  test("explains that the key should be set in .env", () => {
    expect(() => getOpenAiApiKey({})).toThrow(".env");
  });
});
