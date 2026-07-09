import type {
  KeynoteScript,
  KeynoteSegment,
  PresentationClient,
  PresentationConfig,
} from "./presentation";

type FetchLike = typeof fetch;

const OPENAI_BASE_URL = "https://api.openai.com/v1";

export class OpenAiPresentationClient implements PresentationClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async generateScript(
    plan: string,
    config: PresentationConfig,
  ): Promise<KeynoteScript> {
    const response = await this.fetchImpl(`${OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(buildScriptRequest(plan, config)),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI script generation failed: ${await response.text()}`,
      );
    }

    return parseScriptResponse(await response.json());
  }

  async generateSpeech(
    segment: KeynoteSegment,
    config: PresentationConfig,
  ): Promise<ArrayBuffer> {
    const response = await this.fetchImpl(`${OPENAI_BASE_URL}/audio/speech`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(buildSpeechRequest(segment, config)),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI speech generation failed: ${await response.text()}`,
      );
    }

    return response.arrayBuffer();
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }
}

export function buildScriptRequest(
  plan: string,
  config: PresentationConfig,
): Record<string, unknown> {
  const planTitle = extractPlanTitle(plan);

  return {
    model: config.scriptModel,
    instructions: buildScriptInstructions(config.style),
    input: [
      "Turn this implementation plan into a concise spoken keynote script.",
      `Plan title: ${planTitle}`,
      "",
      plan,
    ].join("\n"),
    text: {
      format: {
        type: "json_schema",
        name: "keynote_script",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["title", "segments"],
          properties: {
            title: { type: "string" },
            segments: {
              type: "array",
              minItems: 8,
              maxItems: 20,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "screenText", "speech", "gestureHint"],
                properties: {
                  id: { type: "string" },
                  screenText: { type: "string", maxLength: 260 },
                  speech: { type: "string", maxLength: 3800 },
                  gestureHint: {
                    type: "string",
                    enum: ["point", "open", "walk", "none"],
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

export function buildSpeechRequest(
  segment: KeynoteSegment,
  config: PresentationConfig,
): Record<string, unknown> {
  return {
    model: config.ttsModel,
    voice: config.voice,
    input: segment.speech,
    instructions: buildVoiceInstructions(config.style),
    response_format: "mp3",
    speed: config.ttsSpeed,
  };
}

export function buildScriptInstructions(style: string): string {
  return [
    "You write short keynote narration for a terminal ASCII stage.",
    "Preserve technical meaning from the plan, but make it sound spoken.",
    "Ignore testing, test plan, manual verification, QA checklist, and manual testing details unless they are essential to understanding the implementation itself.",
    "The first segment must be a snappy host-led keynote introduction.",
    "Open with a brief presenter-style line that feels like a real host speaking to the audience, such as thanking them for being here and saying what is being announced today.",
    "That opening should directly address the audience, make them feel invited into the announcement, and briefly frame why this change is exciting, useful, or worth caring about.",
    "That opening should be short, natural, and confident, and it must include a one-line high-level summary of the change using the plan title as the anchor.",
    "The final segment must be a classic keynote closing line.",
    "End by addressing the audience directly, briefly saying how excited the team is about the change and highlighting a benefit in a slightly exaggerated but still polished way.",
    "That closing should be short, upbeat, and satisfying, without adding new technical detail.",
    "Each segment should have screen text that reads like an append-only technical log: one or two compact lines with concrete filenames, APIs, flags, or implementation details from the original plan.",
    "The screen text is more detailed than the narration and should preserve key technical specifics.",
    "Each segment should have one paragraph of polished spoken narration.",
    "Use 8 to 20 segments. Do not mention markdown structure.",
    style === "minimalist-product-keynote"
      ? "Style: calm minimalist product keynote, crisp reveal cadence, dramatic but restrained pauses, no impersonation of a real person."
      : `Style preset: ${style}. Keep it professional and concise.`,
  ].join(" ");
}

export function buildVoiceInstructions(style: string): string {
  if (style === "minimalist-product-keynote") {
    return "Speak like a calm product keynote presenter: precise, understated, confident, with measured pauses. Do not imitate any real person.";
  }

  return `Speak in a clear presentation style matching this preset: ${style}.`;
}

export function parseScriptResponse(body: unknown): KeynoteScript {
  const outputText = extractOutputText(body);
  if (!outputText) {
    throw new Error("OpenAI script response did not contain output text");
  }

  return JSON.parse(outputText) as KeynoteScript;
}

function extractOutputText(body: unknown): string | null {
  if (
    typeof body === "object" &&
    body !== null &&
    "output_text" in body &&
    typeof body.output_text === "string"
  ) {
    return body.output_text;
  }

  const output = (body as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }
    }
  }

  return null;
}

function extractPlanTitle(plan: string): string {
  for (const line of plan.split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (match) {
      return match[1];
    }
  }

  const firstContentLine = plan
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstContentLine ?? "Untitled plan";
}
