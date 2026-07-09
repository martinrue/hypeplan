import { describe, expect, test } from "bun:test";
import { parseArgs, SUPPORTED_TTS_VOICES } from "../src/args";

describe("parseArgs", () => {
  test("parses audio options", () => {
    expect(
      parseArgs([
        "--voice",
        "sage",
        "--style",
        "minimalist-product-keynote",
        "--script-model",
        "gpt-test",
        "--tts-model",
        "tts-test",
        "--tts-speed",
        "1.4",
        "--no-cache",
      ]),
    ).toEqual({
      voice: "sage",
      style: "minimalist-product-keynote",
      scriptModel: "gpt-test",
      ttsModel: "tts-test",
      ttsSpeed: 1.4,
      voiceProvided: true,
      useCache: false,
    });
  });

  test("defaults speech speed to normal speed", () => {
    expect(parseArgs([]).ttsSpeed).toBe(1);
  });

  test("defaults script model to GPT-5.4 mini", () => {
    expect(parseArgs([]).scriptModel).toBe("gpt-5.4-mini");
  });

  test("picks a random high quality default voice", () => {
    const supportedVoices: readonly string[] = SUPPORTED_TTS_VOICES;
    expect(SUPPORTED_TTS_VOICES).toEqual(["coral", "marin", "cedar"]);
    expect(parseArgs([], () => 0).voice).toBe("coral");
    expect(parseArgs([], () => 0.999).voice).toBe("cedar");
    expect(supportedVoices).toContain(parseArgs([], () => 0.5).voice);
  });

  test("uses explicit voice instead of random default", () => {
    const options = parseArgs(["--voice", "sage"], () => 0);
    expect(options.voice).toBe("sage");
    expect(options.voiceProvided).toBe(true);
  });

  test("rejects invalid speech speed", () => {
    expect(() => parseArgs(["--tts-speed", "fast"])).toThrow(
      "--tts-speed requires a positive number",
    );
  });
});
