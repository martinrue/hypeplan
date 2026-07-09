import { spawn, spawnSync } from "node:child_process";

export interface AudioPlayer {
  command: string;
  argsFor(path: string): string[];
}

type SpawnAudioProcess = (
  command: string,
  args: string[],
) => {
  kill(signal?: NodeJS.Signals): boolean;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "close", listener: (code: number | null) => void): unknown;
};

export function findAudioPlayer(
  platform = process.platform,
  commandExists = defaultCommandExists,
): AudioPlayer {
  if (platform === "darwin" && commandExists("afplay")) {
    return {
      command: "afplay",
      argsFor: (path) => [path],
    };
  }

  if (commandExists("ffplay")) {
    return {
      command: "ffplay",
      argsFor: (path) => ["-nodisp", "-autoexit", "-loglevel", "quiet", path],
    };
  }

  throw new Error("No audio player found. Install ffmpeg/ffplay, or run on macOS with afplay.");
}

export function playAudioFile(path: string, player = findAudioPlayer()): Promise<void> {
  return new PlaybackController(player).play(path).then(() => undefined);
}

export class PlaybackController {
  private child: ReturnType<SpawnAudioProcess> | null = null;
  private stopped = false;

  constructor(
    private readonly player = findAudioPlayer(),
    private readonly spawnAudioProcess: SpawnAudioProcess = defaultSpawnAudioProcess,
  ) {}

  play(path: string): Promise<boolean> {
    this.stopped = false;

    return new Promise((resolve, reject) => {
      const child = this.spawnAudioProcess(
        this.player.command,
        this.player.argsFor(path),
      );
      this.child = child;

      child.on("error", (error) => {
        this.child = null;
        reject(error);
      });
      child.on("close", (code) => {
        this.child = null;
        if (this.stopped) {
          resolve(false);
        } else if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`${this.player.command} exited with code ${code}`));
        }
      });
    });
  }

  stop(): void {
    this.stopped = true;
    this.child?.kill("SIGTERM");
    this.child = null;
  }
}

function defaultSpawnAudioProcess(
  command: string,
  args: string[],
): ReturnType<SpawnAudioProcess> {
  return spawn(command, args, {
    stdio: "ignore",
  });
}

function defaultCommandExists(command: string): boolean {
  return spawnSync("sh", ["-c", `command -v ${command}`], {
    stdio: "ignore",
  }).status === 0;
}
