import { describe, expect, test } from "bun:test";
import { PresentationPlaybackState } from "../src/sync";

describe("PresentationPlaybackState", () => {
  test("shows screen text only for completed segments", () => {
    const state = new PresentationPlaybackState([
      { id: "one", screenText: "One", speech: "One.", gestureHint: "none" },
      { id: "two", screenText: "Two", speech: "Two.", gestureHint: "none" },
    ]);

    expect(state.activeSegment()?.id).toBe("one");
    expect(state.isComplete()).toBe(false);
    expect(state.activeSegment()?.id).toBe("one");
    expect(state.visibleSegments().map((segment) => segment.id)).toEqual([]);
    expect(state.progress()).toEqual({ current: 1, total: 2 });
    state.markPlaybackComplete();
    expect(state.activeSegment()?.id).toBe("two");
    expect(state.visibleSegments().map((segment) => segment.id)).toEqual(["one"]);
    expect(state.progress()).toEqual({ current: 2, total: 2 });
    state.markPlaybackComplete();
    expect(state.activeSegment()).toBeNull();
    expect(state.visibleSegments().map((segment) => segment.id)).toEqual([
      "one",
      "two",
    ]);
    expect(state.progress()).toEqual({ current: 2, total: 2 });
    expect(state.isComplete()).toBe(true);
  });

  test("supports skipping forward and backward through segments", () => {
    const state = new PresentationPlaybackState([
      { id: "one", screenText: "One", speech: "One.", gestureHint: "none" },
      { id: "two", screenText: "Two", speech: "Two.", gestureHint: "none" },
      { id: "three", screenText: "Three", speech: "Three.", gestureHint: "none" },
    ]);

    state.skip(1);
    expect(state.currentIndex()).toBe(1);
    expect(state.progress()).toEqual({ current: 2, total: 3 });
    expect(state.visibleSegments().map((segment) => segment.id)).toEqual(["one"]);

    state.skip(1);
    expect(state.currentIndex()).toBe(2);
    expect(state.progress()).toEqual({ current: 3, total: 3 });
    expect(state.visibleSegments().map((segment) => segment.id)).toEqual([
      "one",
      "two",
    ]);

    state.skip(-1);
    expect(state.currentIndex()).toBe(1);
    expect(state.progress()).toEqual({ current: 2, total: 3 });

    state.skip(-5);
    expect(state.currentIndex()).toBe(0);
    expect(state.progress()).toEqual({ current: 1, total: 3 });

    state.skip(99);
    expect(state.currentIndex()).toBe(3);
    expect(state.progress()).toEqual({ current: 3, total: 3 });
    expect(state.isComplete()).toBe(true);
  });

  test("can wake from the completed state when navigating backward", async () => {
    const state = new PresentationPlaybackState([
      { id: "one", screenText: "One", speech: "One.", gestureHint: "none" },
      { id: "two", screenText: "Two", speech: "Two.", gestureHint: "none" },
    ]);

    state.skip(99);
    expect(state.isComplete()).toBe(true);

    const waiting = state.waitForChange(state.revisionNumber());
    state.skip(-1);

    await waiting;
    expect(state.isComplete()).toBe(false);
    expect(state.currentIndex()).toBe(1);
    expect(state.activeSegment()?.id).toBe("two");
  });
});
