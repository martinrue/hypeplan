#!/usr/bin/env bun
import { createAnimationState, advanceAnimation } from "./animation";
import { parseArgs } from "./args";
import { getOpenAiApiKey } from "./env";
import { readPlanInput } from "./input";
import { OpenAiPresentationClient } from "./openai";
import { findAudioPlayer, PlaybackController } from "./playback";
import { validatePlanText } from "./plan";
import { formatPreparationStatus } from "./progress";
import {
  ensurePresentationAssets,
  type PresentationAssets,
} from "./presentation";
import { renderFrame } from "./render";
import { PresentationPlaybackState } from "./sync";

const FRAME_MS = 100;

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const plan = await readPlanInput({ stdin: process.stdin });
  validatePlanText(plan);
  const apiKey = getOpenAiApiKey();
  const audioPlayer = findAudioPlayer();
  process.stdout.write("\x1b[?25l");
  renderPreparationStatus({
    completed: 0,
    total: null,
    message: "Starting",
  });
  const assets: PresentationAssets = await ensurePresentationAssets({
    plan,
    config: {
      voice: options.voice,
      voiceProvided: options.voiceProvided,
      style: options.style,
      scriptModel: options.scriptModel,
      ttsModel: options.ttsModel,
      ttsSpeed: options.ttsSpeed,
    },
    useCache: options.useCache,
    client: new OpenAiPresentationClient(apiKey),
    onProgress: renderPreparationStatus,
  });
  clearPreparationStatus();
  const playbackState = new PresentationPlaybackState(assets.script.segments);

  const state = {
    current: createAnimationState(process.stdout.columns ?? 80),
  };

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
  }

  process.stdout.write("\x1b[2J");

  let interval: Timer | undefined;
  const playbackController = new PlaybackController(audioPlayer);
  let previousFrameLineCount = 0;

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;

    if (interval) {
      clearInterval(interval);
    }
    playbackController.stop();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
    process.stdout.write("\x1b[?25h");
    process.stdout.write("\x1b[0m");
    process.stdout.write("\n");
  };

  const exit = () => {
    cleanup();
    process.exit(0);
  };

  process.on("SIGINT", exit);
  process.on("SIGTERM", exit);
  process.on("exit", cleanup);

  if (process.stdin.isTTY) {
    process.stdin.on("data", (key: string) => {
      if (key === "\u001b[C") {
        playbackState.skip(1);
        playbackController.stop();
        return;
      }

      if (key === "\u001b[D") {
        playbackState.skip(-1);
        playbackController.stop();
        return;
      }

      if (key === "q" || key === "\u001b" || key === "\u0003") {
        exit();
      }
    });
  }

  void playPresentation(assets, playbackState, playbackController).catch(
    (error: unknown) => {
      cleanup();
      console.error(error);
      process.exit(1);
    },
  );

  interval = setInterval(() => {
    const width = process.stdout.columns ?? 80;
    const height = process.stdout.rows ?? 24;
    const finale = playbackState.isComplete();
    const frame = renderFrame(state.current, {
      width,
      height,
      plan,
      finale,
      slideCounter: (() => {
        const progress = playbackState.progress();
        return `${progress.current}/${progress.total}`;
      })(),
      screenText: playbackState
        .visibleSegments()
        .map((segment) => segment.screenText)
        .join("\n\n"),
    });
    const frameLineCount = frame.split("\n").length;
    process.stdout.write("\x1b[?25l\x1b[H");
    process.stdout.write(prepareFrameForTerminal(frame));
    if (previousFrameLineCount > frameLineCount) {
      process.stdout.write(`\x1b[${frameLineCount + 1};1H\x1b[J`);
    }
    previousFrameLineCount = frameLineCount;
    if (!finale) {
      state.current = advanceAnimation(state.current, width);
    }
  }, FRAME_MS);
}

function prepareFrameForTerminal(frame: string): string {
  return frame
    .split("\n")
    .map((line) => `${line}\x1b[K`)
    .join("\n");
}

function renderPreparationStatus(progress: {
  completed: number;
  total: number | null;
  message: string;
}): void {
  const [lineOne, lineTwo] = formatPreparationStatus(progress).split("\n");
  process.stderr.write(`\x1b[2K\r${lineOne}`);
  if (lineTwo) {
    process.stderr.write(`\n\x1b[2K\r${lineTwo}\x1b[1A`);
  }
}

function clearPreparationStatus(): void {
  process.stderr.write("\x1b[2K\r\n\x1b[2K\r\x1b[1A");
}

async function playPresentation(
  assets: PresentationAssets,
  playbackState: PresentationPlaybackState,
  playbackController: PlaybackController,
): Promise<void> {
  while (true) {
    if (playbackState.isComplete()) {
      const revision = playbackState.revisionNumber();
      await playbackState.waitForChange(revision);
      continue;
    }

    const audioFile = assets.audioFiles[playbackState.currentIndex()];
    if (!audioFile) {
      return;
    }

    const completedNaturally = await playbackController.play(audioFile);
    if (completedNaturally) {
      playbackState.markPlaybackComplete();
    }
  }
}

main().catch((error: unknown) => {
  process.stdout.write("\x1b[?25h");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
