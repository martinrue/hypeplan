import { describe, expect, test } from "bun:test";
import { createAnimationState } from "../src/animation";
import { renderFrame } from "../src/render";

describe("renderFrame", () => {
  test("renders visible stage art with the presenter smiley head", () => {
    const state = createAnimationState(72);
    state.presenter.x = 20;
    const frame = renderFrame(state, {
      width: 72,
      height: 22,
      plan: "# Plan",
    });

    expect(frame).toContain("Plan");
    expect(frame).not.toContain("ASCII KEYNOTE");
    expect(frame).not.toContain("PLAN LOADED");
    expect(frame).not.toContain("speaker notes stay offstage");
    expect(frame).toContain("☺");
  });

  test("uses only the plan title inside the screen box", () => {
    const width = 72;
    const height = 22;
    const frame = renderFrame(createAnimationState(width), {
      width,
      height,
      plan: "# Fix Login Flow\n\n- Add tests\n- Update API",
    });
    const lines = frame.split("\n");
    const screenTop = 2;
    const screenLeft = Math.max(8, Math.floor(width * 0.18));

    expect(frame).toContain("Fix Login Flow");
    expect(frame).not.toContain("Add tests");
    expect(frame).not.toContain("Update API");
    expect(lines[screenTop + 3]?.slice(screenLeft + 1)).toContain("Fix Login Flow");
  });

  test("keeps two characters of padding around screen text", () => {
    const width = 72;
    const height = 22;
    const frame = renderFrame(createAnimationState(width), {
      width,
      height,
      plan: "# Original Plan",
      screenText: "alpha\nbeta",
    });
    const lines = frame.split("\n");
    const screenTop = 2;
    const screenBottom = Math.max(10, Math.floor(height * 0.55));
    const screenLeft = Math.max(8, Math.floor(width * 0.18));

    expect(lines[screenTop + 1]?.slice(screenLeft + 1, screenLeft + 6)).toBe("     ");
    expect(lines[screenTop + 2]?.slice(screenLeft + 1, screenLeft + 6)).toBe("     ");
    expect(lines[screenTop + 3]?.slice(screenLeft + 1, screenLeft + 6)).toBe("     ");
    expect(lines[screenTop + 6]?.slice(screenLeft + 1, screenLeft + 6)).toBe("  alp");
    expect(lines[screenBottom - 1]?.slice(screenLeft + 1, screenLeft + 6)).toBe("     ");
  });

  test("renders active segment screen text below the centered plan title", () => {
    const width = 72;
    const height = 22;
    const frame = renderFrame(createAnimationState(width), {
      width,
      height,
      plan: "# Original Plan",
      screenText: "src/cli.ts: read piped input\n.cache: reuse script.json",
    });
    const lines = frame.split("\n");
    const screenTop = 2;
    const screenLeft = Math.max(8, Math.floor(width * 0.18));

    expect(frame).toContain("Original Plan");
    expect(frame).toContain("src/cli.ts: read piped input");
    expect(frame).toContain(".cache: reuse script.json");
    expect(lines[screenTop + 3]?.slice(screenLeft + 1)).toContain("Original Plan");
    expect(lines[screenTop + 4]?.slice(screenLeft + 1, screenLeft + 6)).toBe("     ");
  });

  test("renders the slide counter in the bottom-right corner of the screen", () => {
    const width = 72;
    const height = 22;
    const frame = renderFrame(createAnimationState(width), {
      width,
      height,
      plan: "# Original Plan",
      screenText: "alpha\nbeta",
      slideCounter: "3/12",
    });
    const lines = frame.split("\n");
    const screenBottom = Math.max(10, Math.floor(height * 0.55));
    expect(lines[screenBottom - 2]).not.toContain("3/12");
    expect(lines[screenBottom - 1]).toContain("3/12");
  });

  test("hides the slide counter and raises everyone at the finale", () => {
    const width = 72;
    const height = 22;
    const state = createAnimationState(width);
    state.presenter.x = 20;
    const frame = renderFrame(state, {
      width,
      height,
      plan: "# Original Plan",
      screenText: "alpha\nbeta",
      slideCounter: "10/10",
      finale: true,
    });

    expect(frame).not.toContain("10/10");
    expect(frame).toContain("\\o/");
    expect(frame).toContain(" \\|/ ");
  });

  test("scrolls screen text by keeping the newest visible lines", () => {
    const frame = renderFrame(createAnimationState(96), {
      width: 96,
      height: 24,
      plan: "# Original Plan",
      screenText: Array.from(
        { length: 12 },
        (_, index) => `step ${index + 1}: preserve technical detail in the screen log`,
      ).join("\n"),
    });

    expect(frame).not.toContain("step 1:");
    expect(frame).not.toContain("step 2:");
    expect(frame).toContain("step 12:");
  });

  test("keeps a coherent minimum frame for small terminals", () => {
    const frame = renderFrame(createAnimationState(20), {
      width: 20,
      height: 10,
      plan: "",
    });

    const lines = frame.split("\n");
    expect(lines.length).toBe(18);
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(48);
  });

  test("renders audience hand raises when animation state requests them", () => {
    const state = createAnimationState(72);
    state.audienceWaves = [{ seat: 1, remainingFrames: 10 }];
    const frame = renderFrame(state, {
      width: 72,
      height: 22,
      plan: "",
    });

    expect(frame).toContain("\\o/");
  });

  test("renders presenter arm poses", () => {
    const rightArmState = createAnimationState(72);
    rightArmState.presenter.x = 20;
    rightArmState.presenter.armPose = "rightUp";
    const rightArmFrame = renderFrame(rightArmState, {
      width: 72,
      height: 22,
      plan: "",
    });

    const leftArmState = createAnimationState(72);
    leftArmState.presenter.x = 20;
    leftArmState.presenter.armPose = "leftUp";
    const leftArmFrame = renderFrame(leftArmState, {
      width: 72,
      height: 22,
      plan: "",
    });

    const outArmState = createAnimationState(72);
    outArmState.presenter.x = 20;
    outArmState.presenter.armPose = "out";
    const outArmFrame = renderFrame(outArmState, {
      width: 72,
      height: 22,
      plan: "",
    });

    const rightArmLines = rightArmFrame.split("\n").slice(8, 11).join("\n");
    const leftArmLines = leftArmFrame.split("\n").slice(8, 11).join("\n");
    const outArmLines = outArmFrame.split("\n").slice(8, 11).join("\n");

    expect(rightArmLines).toContain("  |/ ");
    expect(rightArmLines).toContain(" /|  ");
    expect(rightArmLines).not.toContain(" /|\\ ");
    expect(leftArmLines).toContain(" \\|  ");
    expect(leftArmLines).toContain("  |\\ ");
    expect(leftArmLines).not.toContain(" /|\\ ");
    expect(outArmLines).toContain("__|__");
    expect(outArmLines).toContain("  |  ");
    expect(outArmFrame).not.toContain("  ?  ");
  });

  test("keeps backdrop stars above the walking area and outside the screen", () => {
    const width = 96;
    const height = 28;
    const frame = renderFrame(createAnimationState(width), {
      width,
      height,
      plan: "# Title",
    });
    const lines = frame.split("\n");
    const screenTop = 2;
    const screenBottom = Math.max(10, Math.floor(height * 0.55));
    const screenLeft = Math.max(8, Math.floor(width * 0.18));
    const screenRight = Math.min(width - 9, Math.floor(width * 0.82));
    const starBottom = Math.min(Math.floor(height * 0.55), screenBottom + 3);

    for (let y = screenTop - 1; y <= screenBottom + 1; y += 1) {
      expect(lines[y]?.slice(screenLeft - 1, screenRight + 2)).not.toContain("*");
    }

    for (let y = starBottom + 1; y < height; y += 1) {
      expect(lines[y]).not.toContain("*");
    }

    const starCount = [...frame].filter((char) => char === "*").length;
    expect(starCount).toBeGreaterThanOrEqual(15);
    expect(starCount).toBeLessThanOrEqual(18);
  });
});
