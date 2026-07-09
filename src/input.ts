import { spawnSync } from "node:child_process";

export type ClipboardReader = () => string | null;

export async function readPlanInput(options: {
  stdin: NodeJS.ReadStream;
  clipboardReader?: ClipboardReader;
}): Promise<string> {
  if (!options.stdin.isTTY) {
    return readStream(options.stdin);
  }

  if ("clipboardReader" in options) {
    return options.clipboardReader?.() ?? "";
  }

  return readClipboard() ?? "";
}

function readStream(stream: NodeJS.ReadStream): Promise<string> {
  stream.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let buffer = "";
    stream.on("data", (chunk: string) => {
      buffer += chunk;
    });
    stream.on("end", () => resolve(buffer));
    stream.on("error", reject);
  });
}

export function readClipboard(platform = process.platform): string | null {
  if (platform === "darwin") {
    return runClipboardCommand("pbpaste", []);
  }

  if (platform === "win32") {
    return runClipboardCommand("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-Clipboard",
    ]);
  }

  return (
    runClipboardCommand("wl-paste", ["--no-newline"]) ??
    runClipboardCommand("xclip", ["-selection", "clipboard", "-out"])
  );
}

function runClipboardCommand(command: string, args: string[]): string | null {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 500,
  });

  if (result.status !== 0 || result.error) {
    return null;
  }

  return result.stdout;
}
