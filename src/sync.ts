import type { KeynoteSegment } from "./presentation";

export class PresentationPlaybackState {
  private index = 0;
  private revision = 0;
  private listeners = new Set<() => void>();

  constructor(private readonly segments: KeynoteSegment[]) {}

  activeSegment(): KeynoteSegment | null {
    return this.segments[this.index] ?? null;
  }

  currentIndex(): number {
    return Math.min(this.index, this.segments.length);
  }

  visibleSegments(): KeynoteSegment[] {
    return this.segments.slice(0, Math.min(this.index, this.segments.length));
  }

  progress(): { current: number; total: number } {
    return {
      current: Math.min(this.index + 1, this.segments.length),
      total: this.segments.length,
    };
  }

  skip(delta: number): void {
    const nextIndex = clamp(this.index + delta, 0, this.segments.length);
    if (nextIndex === this.index) {
      return;
    }
    this.index = nextIndex;
    this.notifyChanged();
  }

  markPlaybackComplete(): void {
    if (this.index < this.segments.length) {
      this.index += 1;
      this.notifyChanged();
    }
  }

  isComplete(): boolean {
    return this.index >= this.segments.length;
  }

  waitForChange(sinceRevision: number): Promise<void> {
    if (this.revision !== sinceRevision) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const listener = () => {
        this.listeners.delete(listener);
        resolve();
      };
      this.listeners.add(listener);
    });
  }

  revisionNumber(): number {
    return this.revision;
  }

  private notifyChanged(): void {
    this.revision += 1;
    for (const listener of this.listeners) {
      listener();
    }
    this.listeners.clear();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
