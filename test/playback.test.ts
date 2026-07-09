import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { findAudioPlayer, PlaybackController } from "../src/playback";

describe("findAudioPlayer", () => {
  test("prefers afplay on macOS", () => {
    const player = findAudioPlayer("darwin", (command) => command === "afplay");
    expect(player.command).toBe("afplay");
    expect(player.argsFor("a.mp3")).toEqual(["a.mp3"]);
  });

  test("falls back to ffplay", () => {
    const player = findAudioPlayer("linux", (command) => command === "ffplay");
    expect(player.command).toBe("ffplay");
    expect(player.argsFor("a.mp3")).toContain("a.mp3");
  });

  test("throws when no player is available", () => {
    expect(() => findAudioPlayer("linux", () => false)).toThrow("No audio player");
  });
});

describe("PlaybackController", () => {
  test("kills active audio process when stopped", async () => {
    const child = new EventEmitter() as EventEmitter & {
      killedWith?: NodeJS.Signals;
      kill(signal?: NodeJS.Signals): boolean;
    };
    child.kill = (signal?: NodeJS.Signals) => {
      child.killedWith = signal;
      queueMicrotask(() => child.emit("close", null));
      return true;
    };
    const controller = new PlaybackController(
      { command: "player", argsFor: (path) => [path] },
      () => child,
    );

    const playback = controller.play("a.mp3");
    controller.stop();
    await expect(playback).resolves.toBe(false);

    expect(child.killedWith).toBe("SIGTERM");
  });

  test("returns true when playback finishes naturally", async () => {
    const child = new EventEmitter() as EventEmitter & {
      kill(signal?: NodeJS.Signals): boolean;
    };
    child.kill = () => true;
    const controller = new PlaybackController(
      { command: "player", argsFor: (path) => [path] },
      () => child,
    );

    const playback = controller.play("a.mp3");
    queueMicrotask(() => child.emit("close", 0));

    await expect(playback).resolves.toBe(true);
  });
});
