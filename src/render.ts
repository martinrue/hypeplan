import type {
  AnimationState,
  PresenterArmPose,
  PresenterPose,
} from "./animation";
import { getAudienceCapacity } from "./animation";

export interface RenderOptions {
  width: number;
  height: number;
  plan: string;
  screenText?: string | null;
  slideCounter?: string | null;
  finale?: boolean;
}

const MIN_WIDTH = 48;
const MIN_HEIGHT = 18;
const SCREEN_TEXT_PADDING = 2;

export function renderFrame(
  state: AnimationState,
  options: RenderOptions,
): string {
  const width = Math.max(MIN_WIDTH, options.width);
  const height = Math.max(MIN_HEIGHT, options.height);
  const grid = createGrid(width, height);

  drawStage(
    grid,
    options.plan,
    options.screenText ?? null,
    options.finale ? null : (options.slideCounter ?? null),
  );
  drawAudience(
    grid,
    options.finale
      ? new Set(Array.from({ length: getAudienceCapacity(width) }, (_, index) => index))
      : new Set(state.audienceWaves.map((wave) => wave.seat)),
  );
  drawPresenter(
    grid,
    Math.round(state.presenter.x),
    options.finale ? "stand" : state.presenter.pose,
    options.finale ? "bothUp" : state.presenter.armPose,
  );

  return grid.map((line) => line.join("")).join("\n");
}

export function containsOnlyAsciiArt(frame: string): boolean {
  return [...frame].every((char) => {
    const code = char.charCodeAt(0);
    return char === "\n" || (code >= 32 && code <= 126);
  });
}

function createGrid(width: number, height: number): string[][] {
  return Array.from({ length: height }, () => Array(width).fill(" "));
}

function drawStage(
  grid: string[][],
  plan: string,
  screenText: string | null,
  slideCounter?: string | null,
): void {
  const width = grid[0]?.length ?? 0;
  const height = grid.length;
  const screenTop = 2;
  const screenBottom = Math.max(10, Math.floor(height * 0.55));
  const screenLeft = Math.max(8, Math.floor(width * 0.18));
  const screenRight = Math.min(width - 9, Math.floor(width * 0.82));
  const stageFloor = height - 8;
  const apron = height - 7;

  drawBackdropStars(grid, {
    screenTop,
    screenBottom,
    screenLeft,
    screenRight,
  });
  drawHorizontal(
    grid,
    screenLeft,
    screenTop,
    screenRight - screenLeft + 1,
    "-",
  );
  drawHorizontal(
    grid,
    screenLeft,
    screenBottom,
    screenRight - screenLeft + 1,
    "-",
  );
  drawVertical(grid, screenLeft, screenTop, screenBottom - screenTop + 1, "|");
  drawVertical(grid, screenRight, screenTop, screenBottom - screenTop + 1, "|");
  plot(grid, screenLeft, screenTop, "+");
  plot(grid, screenRight, screenTop, "+");
  plot(grid, screenLeft, screenBottom, "+");
  plot(grid, screenRight, screenBottom, "+");

  const screenWidth = screenRight - screenLeft - 1;
  const screenHeight = screenBottom - screenTop - 1;
  const title = extractPlanTitle(plan);
  drawScreenText(grid, {
    x: screenLeft + 1 + SCREEN_TEXT_PADDING,
    y: screenTop + 1 + SCREEN_TEXT_PADDING,
    width: screenWidth - SCREEN_TEXT_PADDING * 2,
    height: screenHeight - SCREEN_TEXT_PADDING * 2,
    title,
    text: screenText?.trim() ?? "",
  });
  drawScreenCounter(
    grid,
    screenRight - 1 - SCREEN_TEXT_PADDING,
    screenBottom - 1,
    slideCounter ?? null,
  );

  for (let y = 2; y < stageFloor; y += 2) {
    drawText(grid, 1, y, "|");
    drawText(grid, width - 2, y, "|");
  }

  drawHorizontal(grid, 0, stageFloor, width, "_");
  drawHorizontal(grid, 0, apron, width, "-");
}

function drawScreenCounter(
  grid: string[][],
  rightX: number,
  y: number,
  counter: string | null,
): void {
  const displayCounter = counter?.trim();
  if (!displayCounter) {
    return;
  }

  drawText(grid, rightX - displayCounter.length + 1, y, displayCounter);
}

function drawBackdropStars(
  grid: string[][],
  bounds: {
    screenTop: number;
    screenBottom: number;
    screenLeft: number;
    screenRight: number;
  },
): void {
  const width = grid[0]?.length ?? 0;
  const starCount = Math.max(15, Math.floor(width / 6));
  const starBottom = Math.min(
    Math.floor(grid.length * 0.55),
    bounds.screenBottom + 3,
  );
  const placed = new Set<string>();

  for (
    let attempt = 0;
    placed.size < starCount && attempt < starCount * 12;
    attempt += 1
  ) {
    const x = 3 + ((attempt * 37 + 17) % Math.max(1, width - 6));
    const y = 1 + ((attempt * 11 + 5) % Math.max(1, starBottom - 1));
    const key = `${x}:${y}`;

    if (
      placed.has(key) ||
      (y >= bounds.screenTop - 1 &&
        y <= bounds.screenBottom + 1 &&
        x >= bounds.screenLeft - 1 &&
        x <= bounds.screenRight + 1)
    ) {
      continue;
    }

    placed.add(key);
    plot(grid, x, y, "*");
  }
}

function extractPlanTitle(plan: string): string {
  for (const line of plan.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading?.[1]) {
      return heading[1].trim();
    }
  }

  const firstTextLine = plan
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstTextLine ?? "";
}

function fitText(text: string, width: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= width) {
    return normalized;
  }

  if (width <= 3) {
    return normalized.slice(0, width);
  }

  return `${normalized.slice(0, width - 3)}...`;
}

function drawScreenText(
  grid: string[][],
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    text: string;
  },
): void {
  if (options.width <= 0 || options.height <= 0) {
    return;
  }

  const displayTitle = fitText(options.title, options.width);
  if (displayTitle) {
    drawText(
      grid,
      options.x + Math.floor((options.width - displayTitle.length) / 2),
      options.y,
      displayTitle,
    );
  }

  if (!options.text.trim() || options.height < 3) {
    return;
  }

  const bodyY = options.y + 2;
  const bodyHeight = options.height - 2;
  const wrappedLines = wrapScreenText(options.text, options.width);
  const visibleLines = wrappedLines.slice(-bodyHeight);
  const startY = bodyY + bodyHeight - visibleLines.length;

  visibleLines.forEach((line, index) => {
    drawText(grid, options.x, startY + index, fitText(line, options.width));
  });
}

function wrapScreenText(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) {
      if (lines.length > 0 && lines.at(-1) !== "") {
        lines.push("");
      }
      continue;
    }

    let remaining = line;
    while (remaining.length > width) {
      const breakAt = Math.max(1, remaining.lastIndexOf(" ", width));
      lines.push(remaining.slice(0, breakAt).trimEnd());
      remaining = remaining.slice(breakAt).trimStart();
    }
    lines.push(remaining);
  }

  return lines;
}

function drawAudience(grid: string[][], raisedHands: Set<number>): void {
  const width = grid[0]?.length ?? 0;
  const height = grid.length;
  const rows = [
    { y: height - 6, offset: 1 },
    { y: height - 4, offset: 5 },
    { y: height - 2, offset: 0 },
  ];
  let seat = 0;

  for (const row of rows) {
    for (let x = row.offset; x <= width - 3; x += 9) {
      if (raisedHands.has(seat)) {
        drawText(grid, x, row.y, "\\o/");
        drawText(grid, x, row.y + 1, " | ");
      } else {
        drawText(grid, x, row.y, " o ");
        drawText(grid, x, row.y + 1, "/|\\");
      }
      seat += 1;
    }
  }
}

function drawPresenter(
  grid: string[][],
  x: number,
  pose: PresenterPose,
  armPose: PresenterArmPose,
): void {
  const floor = grid.length - 9;
  const legs: Record<PresenterPose, [string, string]> = {
    stand: [" / \\ ", "/   \\"],
    walkA: [" / \\ ", "/   \\"],
    walkB: [" /|  ", "  |\\ "],
  };
  const sprite = [
    "  ☺  ",
    getRaisedArmLine(armPose),
    getBodyArmLine(armPose),
    "  |  ",
    ...legs[pose],
  ];
  const top = floor - sprite.length + 1;

  sprite.forEach((line, index) => {
    drawText(grid, x, top + index, line);
  });
}

function getRaisedArmLine(armPose: PresenterArmPose): string {
  if (armPose === "bothUp") {
    return " \\|/ ";
  }

  if (armPose === "out") {
    return "__|__";
  }

  if (armPose === "leftUp") {
    return " \\|  ";
  }

  if (armPose === "rightUp") {
    return "  |/ ";
  }

  return "  |  ";
}

function getBodyArmLine(armPose: PresenterArmPose): string {
  if (armPose === "bothUp") {
    return "  |  ";
  }

  if (armPose === "out") {
    return "  |  ";
  }

  if (armPose === "leftUp") {
    return "  |\\ ";
  }

  if (armPose === "rightUp") {
    return " /|  ";
  }

  return " /|\\ ";
}

function drawHorizontal(
  grid: string[][],
  x: number,
  y: number,
  length: number,
  char: string,
): void {
  for (let i = 0; i < length; i += 1) {
    plot(grid, x + i, y, char);
  }
}

function drawVertical(
  grid: string[][],
  x: number,
  y: number,
  length: number,
  char: string,
): void {
  for (let i = 0; i < length; i += 1) {
    plot(grid, x, y + i, char);
  }
}

function drawText(grid: string[][], x: number, y: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    plot(grid, x + i, y, text[i] ?? " ");
  }
}

function plot(grid: string[][], x: number, y: number, char: string): void {
  if (y < 0 || y >= grid.length) {
    return;
  }

  const row = grid[y];
  if (!row || x < 0 || x >= row.length) {
    return;
  }

  row[x] = char;
}
