import type { PreparationProgress } from "./presentation";

export function formatPreparationStatus(progress: PreparationProgress): string {
  if (progress.total === null) {
    return "Hypeplan will start soon...";
  }

  return [
    "Hypeplan will start soon...",
    `Soundcheck: ${progress.completed}/${progress.total}`,
  ].join("\n");
}
