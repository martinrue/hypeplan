import { describe, expect, test } from "bun:test";
import { looksLikePlan, validatePlanText } from "../src/plan";

describe("plan validation", () => {
  test("accepts markdown implementation plans", () => {
    expect(
      looksLikePlan(`# Implementation Plan

## Summary
- Add input validation
- Update tests

## Test Plan
- Run bun test`),
    ).toBe(true);
  });

  test("accepts checklist-style plans", () => {
    expect(
      looksLikePlan(`Plan

- [ ] Update renderer
- [ ] Add tests
- [ ] Verify assumptions`),
    ).toBe(true);
  });

  test("rejects clearly unrelated clipboard text", () => {
    expect(looksLikePlan("remember to buy milk and call sam")).toBe(false);
  });

  test("throws a helpful error", () => {
    expect(() => validatePlanText("plain unrelated text")).toThrow(
      "Please pipe in or have copied to the clipboard a valid plan",
    );
  });
});
