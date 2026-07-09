import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import {
  assertSpeechLength,
  createAudioCacheKey,
  createCacheKey,
  ensurePresentationAssets,
  type KeynoteScript,
  type PresentationClient,
  type PresentationConfig,
} from "../src/presentation";

const config: PresentationConfig = {
  voice: "alloy",
  voiceProvided: true,
  style: "product-keynote",
  scriptModel: "gpt-script",
  ttsModel: "gpt-4o-mini-tts",
  ttsSpeed: 1.15,
};

const script: KeynoteScript = {
  title: "Plan",
  segments: Array.from({ length: 8 }, (_, index) => ({
    id: `segment-${index + 1}`,
    screenText: `Segment ${index + 1}`,
    speech: `Welcome to segment ${index + 1}.`,
    gestureHint: "none",
  })),
};

describe("presentation assets", () => {
  afterEach(async () => {
    await rm(".cache", { force: true, recursive: true });
  });

  test("script cache key changes with script inputs only", () => {
    const base = createCacheKey("# Plan", config);
    expect(createCacheKey("# Updated Plan", config)).not.toBe(base);
    expect(
      createCacheKey("# Plan", {
        ...config,
        style: "minimalist-product-keynote",
      }),
    ).not.toBe(base);
    expect(
      createCacheKey("# Plan", { ...config, scriptModel: "other-script" }),
    ).not.toBe(base);
    expect(createCacheKey("# Plan", { ...config, voice: "sage" })).toBe(base);
    expect(createCacheKey("# Plan", { ...config, ttsSpeed: 1.5 })).toBe(base);
  });

  test("audio cache key changes with explicit voice but not random default voice", () => {
    const explicitBase = createAudioCacheKey(script, config);
    expect(createAudioCacheKey(script, { ...config, voice: "sage" })).not.toBe(
      explicitBase,
    );
    expect(createAudioCacheKey(script, { ...config, ttsSpeed: 1.5 })).not.toBe(
      explicitBase,
    );

    const randomBase = createAudioCacheKey(script, {
      ...config,
      voice: "alloy",
      voiceProvided: false,
    });
    expect(
      createAudioCacheKey(script, {
        ...config,
        voice: "sage",
        voiceProvided: false,
      }),
    ).toBe(randomBase);
  });

  test("rejects speech over the TTS limit", () => {
    expect(() =>
      assertSpeechLength({
        id: "long",
        screenText: "Long",
        speech: "x".repeat(4097),
        gestureHint: "none",
      }),
    ).toThrow("exceeds");
  });

  test("cache hit skips network client calls", async () => {
    let scriptCalls = 0;
    let speechCalls = 0;
    const client: PresentationClient = {
      async generateScript() {
        scriptCalls += 1;
        return script;
      },
      async generateSpeech() {
        speechCalls += 1;
        return new Uint8Array([1, 2, 3]).buffer;
      },
    };

    await ensurePresentationAssets({
      plan: "# Plan",
      config,
      useCache: true,
      client,
    });
    await ensurePresentationAssets({
      plan: "# Plan",
      config,
      useCache: true,
      client,
    });

    expect(scriptCalls).toBe(1);
    expect(speechCalls).toBe(8);
  });

  test("cached default-voice keynote skips script and audio when random voice changes", async () => {
    let scriptCalls = 0;
    let speechCalls = 0;
    const client: PresentationClient = {
      async generateScript() {
        scriptCalls += 1;
        return script;
      },
      async generateSpeech() {
        speechCalls += 1;
        return new Uint8Array([1, 2, 3]).buffer;
      },
    };

    await ensurePresentationAssets({
      plan: "# Plan",
      config: { ...config, voice: "alloy", voiceProvided: false },
      useCache: true,
      client,
    });
    await ensurePresentationAssets({
      plan: "# Plan",
      config: { ...config, voice: "sage", voiceProvided: false },
      useCache: true,
      client,
    });

    expect(scriptCalls).toBe(1);
    expect(speechCalls).toBe(8);
  });

  test("reports preparation progress while generating assets", async () => {
    const progress: string[] = [];
    const client: PresentationClient = {
      async generateScript() {
        return script;
      },
      async generateSpeech() {
        return new Uint8Array([1, 2, 3]).buffer;
      },
    };

    await ensurePresentationAssets({
      plan: "# Plan",
      config,
      useCache: false,
      client,
      onProgress(event) {
        progress.push(
          `${event.completed}/${event.total ?? "?"}:${event.message}`,
        );
      },
    });

    expect(progress).toContain("0/?:Checking cache");
    expect(progress).toContain("0/?:Summarizing plan");
    expect(progress).toContain("1/9:Generated hypeplan script");
    expect(progress.at(-1)?.startsWith("9/9:Generated audio")).toBe(true);
  });

  test("generates audio with bounded concurrency and preserves segment order", async () => {
    let activeSpeechCalls = 0;
    let maxActiveSpeechCalls = 0;
    const client: PresentationClient = {
      async generateScript() {
        return script;
      },
      async generateSpeech() {
        activeSpeechCalls += 1;
        maxActiveSpeechCalls = Math.max(
          maxActiveSpeechCalls,
          activeSpeechCalls,
        );
        await Bun.sleep(5);
        activeSpeechCalls -= 1;
        return new Uint8Array([1, 2, 3]).buffer;
      },
    };

    const assets = await ensurePresentationAssets({
      plan: "# Plan",
      config,
      useCache: false,
      client,
    });

    expect(maxActiveSpeechCalls).toBe(4);
    expect(assets.audioFiles).toHaveLength(8);
    expect(assets.audioFiles[0]).toEndWith("01-segment-1.mp3");
    expect(assets.audioFiles[7]).toEndWith("08-segment-8.mp3");
  });
});
