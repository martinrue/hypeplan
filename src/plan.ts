export function validatePlanText(text: string): void {
  if (!looksLikePlan(text)) {
    throw new Error("Please pipe in or have copied to the clipboard a valid plan");
  }
}

export function looksLikePlan(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12) {
    return false;
  }

  const lines = trimmed.split(/\r?\n/);
  const headingCount = countMatches(lines, /^#{1,6}\s+\S/);
  const bulletCount = countMatches(lines, /^\s*[-*+]\s+\S/);
  const numberedCount = countMatches(lines, /^\s*\d+[.)]\s+\S/);
  const checklistCount = countMatches(lines, /^\s*[-*+]\s+\[[ xX]\]\s+\S/);
  const codeFenceCount = countMatches(lines, /^```/);
  const planTermCount = countTerms(trimmed, [
    "plan",
    "summary",
    "scope",
    "implementation",
    "changes",
    "test plan",
    "assumptions",
    "acceptance",
    "rollout",
  ]);

  const structureScore =
    headingCount * 2 +
    Math.min(bulletCount + numberedCount, 4) +
    checklistCount * 2 +
    Math.min(codeFenceCount, 2);

  return structureScore >= 3 && planTermCount >= 1;
}

function countMatches(lines: string[], pattern: RegExp): number {
  return lines.reduce((count, line) => count + (pattern.test(line) ? 1 : 0), 0);
}

function countTerms(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.reduce(
    (count, term) => count + (lower.includes(term) ? 1 : 0),
    0,
  );
}
