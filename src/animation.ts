export type PresenterPose = "walkA" | "walkB" | "stand";
export type PresenterArmPose = "down" | "leftUp" | "rightUp" | "out" | "bothUp";

export interface PresenterState {
  x: number;
  direction: -1 | 1;
  pose: PresenterPose;
  armPose: PresenterArmPose;
  entered: boolean;
  pauseFrames: number;
  pauseFrame: number;
  armHoldFrames: number;
  armRaisePose: PresenterArmPose;
  consecutiveArmRaises: number;
  lastRaisedArmPose: PresenterArmPose;
  strideFrame: number;
  walkFrames: number;
}

export interface AudienceWave {
  seat: number;
  remainingFrames: number;
}

export interface AnimationState {
  frame: number;
  presenter: PresenterState;
  audienceWaves: AudienceWave[];
  seed: number;
}

export interface StageBounds {
  minX: number;
  maxX: number;
}

const ENTRANCE_APPLAUSE_FRAMES = 30;
const AUDIENCE_WAVE_FRAMES = 10;
const MAX_PAUSE_FRAMES = 40;

export function createAnimationState(_width?: number): AnimationState {
  return {
    frame: 0,
    seed: 0x5eed1234,
    presenter: {
      x: -6,
      direction: 1,
      pose: "walkA",
      armPose: "down",
      entered: false,
      pauseFrames: 0,
      pauseFrame: 0,
      armHoldFrames: 0,
      armRaisePose: "down",
      consecutiveArmRaises: 0,
      lastRaisedArmPose: "down",
      strideFrame: 0,
      walkFrames: 0,
    },
    audienceWaves: [],
  };
}

export function getStageBounds(width: number): StageBounds {
  const minX = Math.max(4, Math.floor(width * 0.18));
  const maxX = Math.max(minX + 1, Math.floor(width * 0.78));
  return { minX, maxX };
}

export function advanceAnimation(
  state: AnimationState,
  width: number,
): AnimationState {
  const bounds = getStageBounds(width);
  const seed = nextSeed(state.seed);
  const presenter = { ...state.presenter };
  const shouldStep = state.frame % 5 === 0 || state.frame % 5 === 3;
  const audienceWaves = advanceAudienceWaves(
    state.audienceWaves,
    seed,
    width,
    state.frame,
  );

  if (!presenter.entered) {
    if (shouldStep) {
      presenter.x += 1;
      presenter.strideFrame += 1;
    }
    presenter.pose = presenter.strideFrame % 2 === 0 ? "walkA" : "walkB";
    presenter.armPose = "down";
    if (presenter.x >= bounds.minX) {
      presenter.entered = true;
      startPresenterPause(presenter, seed);
      presenter.pauseFrame = 0;
      presenter.walkFrames = 0;
      presenter.pose = "stand";
      presenter.direction = chooseNextDirection(seed, presenter.x, bounds);
    }
  } else if (presenter.pauseFrames > 0) {
    presenter.pose = "stand";
    presenter.armPose = getPauseArmPose(
      presenter.pauseFrame,
      presenter.armHoldFrames,
      presenter.armRaisePose,
    );
    presenter.pauseFrame += 1;
    presenter.pauseFrames -= 1;
    if (presenter.pauseFrames === 0) {
      presenter.direction = chooseNextDirection(seed, presenter.x, bounds);
    }
  } else {
    presenter.armPose = "down";
    if (presenter.walkFrames >= 6) {
      startPresenterPause(presenter, seed);
      presenter.walkFrames = 0;
      presenter.pose = "stand";
    } else if (shouldStep) {
      presenter.x += presenter.direction;
      presenter.strideFrame += 1;
      presenter.walkFrames += 1;
      presenter.pose = presenter.strideFrame % 2 === 0 ? "walkA" : "walkB";
      presenter.armPose = "down";
    }

    if (presenter.x <= bounds.minX) {
      presenter.x = bounds.minX;
      startPresenterPause(presenter, seed);
      presenter.walkFrames = 0;
      presenter.pose = "stand";
    }

    if (presenter.x >= bounds.maxX) {
      presenter.x = bounds.maxX;
      startPresenterPause(presenter, seed);
      presenter.walkFrames = 0;
      presenter.pose = "stand";
    }
  }

  return {
    frame: state.frame + 1,
    seed,
    presenter,
    audienceWaves,
  };
}

function getPauseDuration(seed: number): number {
  const roll = seed % 100;
  if (roll < 18) {
    return 30 + (seed % (MAX_PAUSE_FRAMES - 29));
  }

  if (roll < 55) {
    return 25 + (seed % 10);
  }

  return 18 + (seed % 7);
}

function startPresenterPause(presenter: PresenterState, seed: number): void {
  if (presenter.consecutiveArmRaises >= 2) {
    presenter.pauseFrames = 0;
    presenter.pauseFrame = 0;
    presenter.armHoldFrames = 0;
    presenter.armPose = "down";
    presenter.armRaisePose = "down";
    presenter.consecutiveArmRaises = 0;
    return;
  }

  presenter.pauseFrames = getPauseDuration(seed);
  presenter.pauseFrame = 0;
  presenter.armPose = "down";
  if (seed % 3 === 0) {
    presenter.armHoldFrames = getArmHoldDuration(seed, presenter.pauseFrames);
    presenter.armRaisePose = "out";
    presenter.consecutiveArmRaises = 0;
  } else if (seed % 2 === 0) {
    presenter.armHoldFrames = getArmHoldDuration(seed, presenter.pauseFrames);
    presenter.armRaisePose =
      presenter.lastRaisedArmPose === "leftUp" ? "rightUp" : "leftUp";
    presenter.lastRaisedArmPose = presenter.armRaisePose;
    presenter.consecutiveArmRaises += 1;
  } else {
    presenter.armHoldFrames = 0;
    presenter.armRaisePose = "down";
    presenter.consecutiveArmRaises = 0;
  }
}

function getArmHoldDuration(seed: number, pauseFrames: number): number {
  return Math.min(pauseFrames - 3, 15 + (seed % 10));
}

function getPauseArmPose(
  pauseFrame: number,
  armHoldFrames: number,
  armRaisePose: PresenterArmPose,
): PresenterArmPose {
  if (pauseFrame >= 3 && pauseFrame < 3 + armHoldFrames) {
    return armRaisePose;
  }

  return "down";
}

function chooseNextDirection(
  seed: number,
  x: number,
  bounds: StageBounds,
): -1 | 1 {
  if (x <= bounds.minX) {
    return 1;
  }

  if (x >= bounds.maxX) {
    return -1;
  }

  return seed % 2 === 0 ? 1 : -1;
}

export function getAudienceCapacity(width: number): number {
  const safeWidth = Math.max(48, width);
  const offsets = [1, 5, 0];
  return offsets.reduce((count, offset) => {
    if (offset > safeWidth - 3) {
      return count;
    }

    return count + Math.floor((safeWidth - 3 - offset) / 9) + 1;
  }, 0);
}

function advanceAudienceWaves(
  current: AudienceWave[],
  seed: number,
  width: number,
  frame: number,
): AudienceWave[] {
  const audienceCount = getAudienceCapacity(width);
  if (frame < ENTRANCE_APPLAUSE_FRAMES) {
    return advanceEntranceApplause(current, seed, audienceCount);
  }

  const activeWaves = frame === ENTRANCE_APPLAUSE_FRAMES ? [] : current;
  const waves = activeWaves
    .map((wave) => ({ ...wave, remainingFrames: wave.remainingFrames - 1 }))
    .filter((wave) => wave.remainingFrames > 0 && wave.seat < audienceCount);

  if (audienceCount === 0 || waves.length >= 2) {
    return waves;
  }

  const shouldStartWave = seed % 28 === 0;
  if (!shouldStartWave) {
    return waves;
  }

  const seat = Math.floor(seed / 28) % audienceCount;
  if (waves.some((wave) => wave.seat === seat)) {
    return waves;
  }

  return [
    ...waves,
    {
      seat,
      remainingFrames: AUDIENCE_WAVE_FRAMES,
    },
  ];
}

function advanceEntranceApplause(
  current: AudienceWave[],
  seed: number,
  audienceCount: number,
): AudienceWave[] {
  if (audienceCount === 0) {
    return [];
  }

  const maxRaised = Math.max(1, Math.floor(audienceCount / 2));
  const waves = current
    .map((wave) => ({ ...wave, remainingFrames: wave.remainingFrames - 1 }))
    .filter((wave) => wave.remainingFrames > 0 && wave.seat < audienceCount)
    .slice(0, maxRaised);
  const openSlots = maxRaised - waves.length;
  if (openSlots <= 0) {
    return waves;
  }

  const burstCount = Math.min(openSlots, 1 + (seed % 4));
  let nextSeatSeed = seed;

  for (let i = 0; i < burstCount; i += 1) {
    nextSeatSeed = nextSeed(nextSeatSeed);
    const seat = nextSeatSeed % audienceCount;
    if (waves.some((wave) => wave.seat === seat)) {
      continue;
    }

    waves.push({
      seat,
      remainingFrames: 5 + (nextSeed(nextSeatSeed) % 8),
    });
  }

  return waves;
}

function nextSeed(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}
