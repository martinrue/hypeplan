import { describe, expect, test } from "bun:test";
import {
  buildScriptRequest,
  buildSpeechRequest,
  parseScriptResponse,
} from "../src/openai";
import type { PresentationConfig } from "../src/presentation";

const config: PresentationConfig = {
  voice: "sage",
  voiceProvided: true,
  style: "minimalist-product-keynote",
  scriptModel: "gpt-script",
  ttsModel: "gpt-4o-mini-tts",
  ttsSpeed: 1.15,
};

describe("openai request builders", () => {
  test("builds a structured script generation request", () => {
    const request = buildScriptRequest("# Plan\n\n- Change thing", config);

    expect(request.model).toBe("gpt-script");
    expect(JSON.stringify(request)).toContain("json_schema");
    expect(JSON.stringify(request)).toContain("gestureHint");
    expect(JSON.stringify(request)).toContain('"maxLength":260');
    expect(String(request.instructions)).toContain("append-only technical log");
    expect(String(request.instructions)).toContain("Ignore testing");
    expect(String(request.instructions)).toContain(
      "snappy host-led keynote introduction",
    );
    expect(String(request.instructions)).toContain(
      "thanking them for being here",
    );
    expect(String(request.instructions)).toContain(
      "directly address the audience",
    );
    expect(String(request.instructions)).toContain(
      "why this change is exciting, useful, or worth caring about",
    );
    expect(String(request.instructions)).toContain(
      "final segment must be a classic keynote closing line",
    );
    expect(String(request.instructions)).toContain(
      "how excited the team is about the change",
    );
    expect(String(request.instructions)).toContain(
      "slightly exaggerated but still polished",
    );
    expect(String(request.instructions)).toContain(
      "using the plan title as the anchor",
    );
    expect(JSON.stringify(request)).toContain("minimalist product keynote");
    expect(String(request.input)).toContain("Plan title: Plan");
  });

  test("builds a speech request with voice instructions", () => {
    const request = buildSpeechRequest(
      {
        id: "intro",
        screenText: "The plan",
        speech: "Here is the plan.",
        gestureHint: "none",
      },
      config,
    );

    expect(request.model).toBe("gpt-4o-mini-tts");
    expect(request.voice).toBe("sage");
    expect(request.input).toBe("Here is the plan.");
    expect(request.response_format).toBe("mp3");
    expect(request.speed).toBe(1.15);
    expect(String(request.instructions)).toContain("calm product keynote");
  });

  test("parses response output text", () => {
    const parsed = parseScriptResponse({
      output_text: JSON.stringify({
        title: "Title",
        segments: [
          {
            id: "intro",
            screenText: "Intro",
            speech: "Hello.",
            gestureHint: "none",
          },
        ],
      }),
    });

    expect(parsed.title).toBe("Title");
    expect(parsed.segments[0]?.screenText).toBe("Intro");
  });
});
