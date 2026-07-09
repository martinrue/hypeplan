export interface CliOptions {
  voice: string;
  style: string;
  scriptModel: string;
  ttsModel: string;
  ttsSpeed: number;
  voiceProvided: boolean;
  useCache: boolean;
}

const DEFAULT_SCRIPT_MODEL = "gpt-5.4-mini";
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_TTS_SPEED = 1;

export const SUPPORTED_TTS_VOICES = ["coral", "marin", "cedar"] as const;

export function parseArgs(
  argv: string[],
  random: () => number = Math.random,
): CliOptions {
  const options: CliOptions = {
    voice: pickRandomVoice(random),
    style: "product-keynote",
    scriptModel: DEFAULT_SCRIPT_MODEL,
    ttsModel: DEFAULT_TTS_MODEL,
    ttsSpeed: DEFAULT_TTS_SPEED,
    voiceProvided: false,
    useCache: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--no-cache") {
      options.useCache = false;
    } else if (arg === "--voice") {
      options.voice = readValue(argv, index, arg);
      options.voiceProvided = true;
      index += 1;
    } else if (arg === "--style") {
      options.style = readValue(argv, index, arg);
      index += 1;
    } else if (arg === "--script-model") {
      options.scriptModel = readValue(argv, index, arg);
      index += 1;
    } else if (arg === "--tts-model") {
      options.ttsModel = readValue(argv, index, arg);
      index += 1;
    } else if (arg === "--tts-speed") {
      options.ttsSpeed = readSpeed(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function pickRandomVoice(random: () => number): string {
  const index = Math.min(
    SUPPORTED_TTS_VOICES.length - 1,
    Math.max(0, Math.floor(random() * SUPPORTED_TTS_VOICES.length)),
  );

  return SUPPORTED_TTS_VOICES[index] ?? "marin";
}

function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}

function readSpeed(argv: string[], index: number, flag: string): number {
  const value = Number(readValue(argv, index, flag));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${flag} requires a positive number`);
  }

  return value;
}
