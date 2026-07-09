import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type GestureHint = "point" | "open" | "walk" | "none";

export interface KeynoteSegment {
  id: string;
  screenText: string;
  speech: string;
  gestureHint: GestureHint;
}

export interface KeynoteScript {
  title: string;
  segments: KeynoteSegment[];
}

export interface PresentationConfig {
  voice: string;
  voiceProvided: boolean;
  style: string;
  scriptModel: string;
  ttsModel: string;
  ttsSpeed: number;
}

export interface PresentationAssets {
  script: KeynoteScript;
  audioFiles: string[];
  cacheDir: string;
}

export interface PresentationClient {
  generateScript(
    plan: string,
    config: PresentationConfig,
  ): Promise<KeynoteScript>;
  generateSpeech(
    segment: KeynoteSegment,
    config: PresentationConfig,
  ): Promise<ArrayBuffer>;
}

export interface PreparationProgress {
  completed: number;
  total: number | null;
  message: string;
}

const CACHE_ROOT = ".cache";
const MAX_SPEECH_CHARS = 4096;
const AUDIO_GENERATION_CONCURRENCY = 4;

export function createCacheKey(
  plan: string,
  config: PresentationConfig,
): string {
  return createScriptCacheKey(plan, config);
}

export function createScriptCacheKey(
  plan: string,
  config: PresentationConfig,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        plan,
        style: config.style,
        scriptModel: config.scriptModel,
      }),
    )
    .digest("hex")
    .slice(0, 24);
}

export function createAudioCacheKey(
  script: KeynoteScript,
  config: PresentationConfig,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        voice: config.voiceProvided ? config.voice : "default-random",
        ttsModel: config.ttsModel,
        ttsSpeed: config.ttsSpeed,
        segments: script.segments.map((segment) => ({
          id: segment.id,
          speech: segment.speech,
        })),
      }),
    )
    .digest("hex")
    .slice(0, 24);
}

export async function ensurePresentationAssets(options: {
  plan: string;
  config: PresentationConfig;
  useCache: boolean;
  client: PresentationClient;
  onProgress?: (progress: PreparationProgress) => void;
}): Promise<PresentationAssets> {
  const scriptCacheDir = join(
    CACHE_ROOT,
    createScriptCacheKey(options.plan, options.config),
  );
  const scriptPath = join(scriptCacheDir, "script.json");

  options.onProgress?.({
    completed: 0,
    total: null,
    message: "Checking cache",
  });
  let script: KeynoteScript | null = null;

  if (options.useCache) {
    script = await readCachedScript(scriptPath);
    if (script) {
      const audioCacheDir = getAudioCacheDir(
        scriptCacheDir,
        script,
        options.config,
      );
      const audioFiles = await readCachedAudioFiles(audioCacheDir, script);
      if (audioFiles) {
        options.onProgress?.({
          completed: script.segments.length + 1,
          total: script.segments.length + 1,
          message: "Loaded cached hypeplan presentation",
        });
        return { script, audioFiles, cacheDir: scriptCacheDir };
      }
    }
  }

  await mkdir(scriptCacheDir, { recursive: true });
  if (!script || !options.useCache) {
    options.onProgress?.({
      completed: 0,
      total: null,
      message: "Summarizing plan",
    });
    script = await options.client.generateScript(options.plan, options.config);
    validateScript(script);
    await writeFile(scriptPath, JSON.stringify(script, null, 2));
  }

  const totalTasks = script.segments.length + 1;
  options.onProgress?.({
    completed: 1,
    total: totalTasks,
    message: options.useCache
      ? "Loaded hypeplan script"
      : "Generated hypeplan script",
  });
  const audioCacheDir = getAudioCacheDir(
    scriptCacheDir,
    script,
    options.config,
  );
  await mkdir(audioCacheDir, { recursive: true });

  const audioFiles = await generateAudioFiles({
    script,
    config: options.config,
    cacheDir: audioCacheDir,
    client: options.client,
    totalTasks,
    onProgress: options.onProgress,
  });

  return { script, audioFiles, cacheDir: scriptCacheDir };
}

export function validateScript(script: KeynoteScript): void {
  if (!script.title.trim()) {
    throw new Error("Generated script is missing a title");
  }

  if (script.segments.length < 8 || script.segments.length > 20) {
    throw new Error("Generated script must contain between 8 and 20 segments");
  }

  const ids = new Set<string>();
  for (const segment of script.segments) {
    if (ids.has(segment.id)) {
      throw new Error(
        `Generated script has duplicate segment id: ${segment.id}`,
      );
    }
    ids.add(segment.id);
    if (!segment.screenText.trim() || !segment.speech.trim()) {
      throw new Error(`Generated segment ${segment.id} is incomplete`);
    }
    assertSpeechLength(segment);
  }
}

export function assertSpeechLength(segment: KeynoteSegment): void {
  if (segment.speech.length > MAX_SPEECH_CHARS) {
    throw new Error(
      `Segment ${segment.id} speech exceeds ${MAX_SPEECH_CHARS} characters`,
    );
  }
}

async function readCachedScript(
  scriptPath: string,
): Promise<KeynoteScript | null> {
  try {
    const script = JSON.parse(
      await readFile(scriptPath, "utf8"),
    ) as KeynoteScript;
    validateScript(script);
    return script;
  } catch {
    return null;
  }
}

async function readCachedAudioFiles(
  audioCacheDir: string,
  script: KeynoteScript,
): Promise<string[] | null> {
  try {
    const audioFiles = script.segments.map((segment, index) =>
      getSegmentAudioPath(audioCacheDir, segment.id, index),
    );
    await Promise.all(audioFiles.map((path) => readFile(path)));
    return audioFiles;
  } catch {
    return null;
  }
}

function getAudioCacheDir(
  scriptCacheDir: string,
  script: KeynoteScript,
  config: PresentationConfig,
): string {
  return join(scriptCacheDir, "audio", createAudioCacheKey(script, config));
}

async function generateAudioFiles(options: {
  script: KeynoteScript;
  config: PresentationConfig;
  cacheDir: string;
  client: PresentationClient;
  totalTasks: number;
  onProgress?: (progress: PreparationProgress) => void;
}): Promise<string[]> {
  const audioFiles = new Array<string>(options.script.segments.length);
  let nextIndex = 0;
  let completedAudio = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < options.script.segments.length) {
      const index = nextIndex;
      nextIndex += 1;
      const segment = options.script.segments[index];
      if (!segment) {
        continue;
      }

      assertSpeechLength(segment);
      options.onProgress?.({
        completed: completedAudio + 1,
        total: options.totalTasks,
        message: `Generating audio ${index + 1} of ${options.script.segments.length}`,
      });

      const audio = await options.client.generateSpeech(
        segment,
        options.config,
      );
      const audioPath = getSegmentAudioPath(
        options.cacheDir,
        segment.id,
        index,
      );
      await writeFile(audioPath, new Uint8Array(audio));
      audioFiles[index] = audioPath;

      completedAudio += 1;
      options.onProgress?.({
        completed: completedAudio + 1,
        total: options.totalTasks,
        message: `Generated audio ${index + 1} of ${options.script.segments.length}`,
      });
    }
  };

  const workerCount = Math.min(
    AUDIO_GENERATION_CONCURRENCY,
    options.script.segments.length,
  );
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return audioFiles;
}

function getSegmentAudioPath(
  cacheDir: string,
  segmentId: string,
  index: number,
): string {
  const safeId = segmentId.replace(/[^a-zA-Z0-9_-]/g, "-");
  return join(cacheDir, `${String(index + 1).padStart(2, "0")}-${safeId}.mp3`);
}
