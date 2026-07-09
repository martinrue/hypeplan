import { describe, expect, test } from "bun:test";
import { formatPreparationStatus } from "../src/progress";

describe("formatPreparationStatus", () => {
  test("formats unknown totals as a single line", () => {
    expect(
      formatPreparationStatus({
        completed: 0,
        total: null,
        message: "Summarizing plan",
      }),
    ).toBe("Hypeplan will start soon...");
  });

  test("formats known totals as sound check progress", () => {
    expect(
      formatPreparationStatus({
        completed: 3,
        total: 9,
        message: "Generating audio 2 of 8",
      }),
    ).toBe("Hypeplan will start soon...\nSoundcheck: 3/9");
  });
});
