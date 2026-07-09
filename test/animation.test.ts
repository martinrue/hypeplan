import { describe, expect, test } from "bun:test";
import {
  advanceAnimation,
  createAnimationState,
  getAudienceCapacity,
  getStageBounds,
} from "../src/animation";

describe("animation", () => {
  test("keeps the presenter inside stage bounds after entering", () => {
    const width = 80;
    const bounds = getStageBounds(width);
    let state = createAnimationState(width);

    for (let i = 0; i < 500; i += 1) {
      state = advanceAnimation(state, width);
      if (state.presenter.entered) {
        expect(state.presenter.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(state.presenter.x).toBeLessThanOrEqual(bounds.maxX);
      }
    }
  });

  test("uses only known presenter poses", () => {
    const width = 80;
    const poses = new Set(["walkA", "walkB", "stand"]);
    const armPoses = new Set(["down", "leftUp", "rightUp", "out", "bothUp"]);
    let state = createAnimationState(width);

    for (let i = 0; i < 100; i += 1) {
      state = advanceAnimation(state, width);
      expect(poses.has(state.presenter.pose)).toBe(true);
      expect(armPoses.has(state.presenter.armPose)).toBe(true);
    }
  });

  test("keeps arms down while walking onto the stage", () => {
    const width = 96;
    let state = createAnimationState(width);

    while (!state.presenter.entered) {
      state = advanceAnimation(state, width);
      expect(["walkA", "walkB", "stand"]).toContain(state.presenter.pose);
      expect(state.presenter.armPose).toBe("down");
    }
  });

  test("walk segments are capped at six steps after entering", () => {
    const width = 96;
    let state = createAnimationState(width);
    let maxWalkFrames = 0;

    for (let i = 0; i < 500; i += 1) {
      state = advanceAnimation(state, width);
      if (state.presenter.entered) {
        maxWalkFrames = Math.max(maxWalkFrames, state.presenter.walkFrames);
      }
    }

    expect(maxWalkFrames).toBeLessThanOrEqual(6);
  });

  test("pause lengths vary and can last around four seconds", () => {
    const width = 96;
    let state = createAnimationState(width);
    const starts: number[] = [];
    let previousPause = 0;

    for (let i = 0; i < 1000; i += 1) {
      state = advanceAnimation(state, width);
      if (state.presenter.pauseFrames > 0 && previousPause === 0) {
        starts.push(state.presenter.pauseFrames);
      }
      previousPause = state.presenter.pauseFrames;
    }

    expect(Math.max(...starts)).toBeGreaterThanOrEqual(30);
    expect(Math.max(...starts)).toBeLessThanOrEqual(40);
    expect(Math.min(...starts)).toBeLessThanOrEqual(24);
    expect(Math.min(...starts)).toBeGreaterThanOrEqual(18);
  });

  test("raised arm holds are less frequent but still long when present", () => {
    const width = 96;
    let state = createAnimationState(width);
    const holds: number[] = [];
    let currentHold = 0;
    let pauseStarts = 0;

    for (let i = 0; i < 1200; i += 1) {
      const previousPause = state.presenter.pauseFrames;
      state = advanceAnimation(state, width);
      if (!state.presenter.entered) {
        continue;
      }
      if (state.presenter.pauseFrames > 0 && previousPause === 0) {
        pauseStarts += 1;
      }

      if (state.presenter.armPose !== "down") {
        currentHold += 1;
      } else if (currentHold > 0) {
        holds.push(currentHold);
        currentHold = 0;
      }
    }

    expect(Math.min(...holds)).toBeGreaterThanOrEqual(15);
    expect(Math.max(...holds)).toBeGreaterThan(15);
    expect(holds.length).toBeLessThanOrEqual(Math.ceil(pauseStarts * 0.65));
  });

  test("arm raises alternate sides and never exceed two consecutively", () => {
    const width = 96;
    let state = createAnimationState(width);
    let sawLeft = false;
    let sawRight = false;

    for (let i = 0; i < 2000; i += 1) {
      state = advanceAnimation(state, width);
      expect(state.presenter.consecutiveArmRaises).toBeLessThanOrEqual(2);
      sawLeft ||= state.presenter.armPose === "leftUp";
      sawRight ||= state.presenter.armPose === "rightUp";
    }

    expect(sawLeft).toBe(true);
    expect(sawRight).toBe(true);
  });

  test("post-entry movement changes direction and raises arms during pauses", () => {
    const width = 96;
    let state = createAnimationState(width);
    const directions = new Set<number>();
    let sawRaisedArm = false;

    for (let i = 0; i < 600; i += 1) {
      state = advanceAnimation(state, width);
      if (!state.presenter.entered) {
        continue;
      }

      directions.add(state.presenter.direction);
      sawRaisedArm ||= state.presenter.armPose !== "down";
    }

    expect(directions.has(-1)).toBe(true);
    expect(directions.has(1)).toBe(true);
    expect(sawRaisedArm).toBe(true);
  });

  test("arms-out pose appears during pauses", () => {
    const width = 96;
    let state = createAnimationState(width);
    let sawOutPose = false;

    for (let i = 0; i < 1200; i += 1) {
      state = advanceAnimation(state, width);
      sawOutPose ||= state.presenter.armPose === "out";
    }

    expect(sawOutPose).toBe(true);
  });

  test("audience waves are sparse and temporary", () => {
    const width = 96;
    const capacity = getAudienceCapacity(width);
    let state = createAnimationState(width);
    let sawWave = false;

    for (let i = 0; i < 500; i += 1) {
      state = advanceAnimation(state, width);
      if (state.frame <= 40) {
        continue;
      }
      sawWave ||= state.audienceWaves.length > 0;

      expect(state.audienceWaves.length).toBeLessThanOrEqual(2);
      for (const wave of state.audienceWaves) {
        expect(wave.seat).toBeGreaterThanOrEqual(0);
        expect(wave.seat).toBeLessThan(capacity);
        expect(wave.remainingFrames).toBeGreaterThan(0);
        expect(wave.remainingFrames).toBeLessThanOrEqual(10);
      }
    }

    expect(sawWave).toBe(true);
  });

  test("randomizes entrance applause without exceeding half the audience", () => {
    const width = 96;
    const capacity = getAudienceCapacity(width);
    let state = createAnimationState(width);
    const seenSeats = new Set<number>();
    let maxRaised = 0;

    for (let i = 0; i < 40; i += 1) {
      state = advanceAnimation(state, width);
      maxRaised = Math.max(maxRaised, state.audienceWaves.length);
      for (const wave of state.audienceWaves) {
        seenSeats.add(wave.seat);
      }
      expect(state.audienceWaves.length).toBeLessThanOrEqual(
        Math.floor(capacity / 2),
      );
    }

    expect(maxRaised).toBeGreaterThan(2);
    expect(seenSeats.size).toBeGreaterThan(Math.floor(capacity / 2));
  });

  test("walks faster than the previous four-frame cadence", () => {
    const width = 96;
    let state = createAnimationState(width);

    for (let i = 0; i < 10; i += 1) {
      state = advanceAnimation(state, width);
    }

    expect(state.presenter.x).toBeGreaterThanOrEqual(-2);
  });
});
