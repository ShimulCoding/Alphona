export const DEFAULT_SPLASH_DURATION_MS = 720;

export type SplashPhase =
  | 'emblem-bloom'
  | 'stage-calibrate'
  | 'reveal-fade'
  | 'complete';

export interface SplashProgressState {
  phase: SplashPhase;
  progressPct: number;
  overlayOpacity: number;
  cardScale: number;
  lotusRotationDeg: number;
  statusLabel: string;
  isComplete: boolean;
}

export function shouldSkipSplashFromSearch(search: string): boolean {
  if (!search) return false;
  const normalized = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  return (
    params.get('autostart') === '1' ||
    params.get('autostart') === 'true' ||
    params.get('skipSplash') === '1'
  );
}

export function computeSplashProgress(
  elapsedMs: number,
  durationMs: number = DEFAULT_SPLASH_DURATION_MS,
  skip: boolean = false
): SplashProgressState {
  const safeDuration = Math.max(100, durationMs);
  if (skip || elapsedMs >= safeDuration) {
    return {
      phase: 'complete',
      progressPct: 100,
      overlayOpacity: 0,
      cardScale: 1,
      lotusRotationDeg: 22.5,
      statusLabel: 'Alpona Studio Ready',
      isComplete: true,
    };
  }

  const clampedElapsed = Math.max(0, elapsedMs);
  const t = clampedElapsed / safeDuration;
  const progressPct = Math.min(100, Math.max(0, Math.round(t * 100)));
  const lotusRotationDeg = Number((22.5 * t).toFixed(2));

  if (t < 0.45) {
    return {
      phase: 'emblem-bloom',
      progressPct,
      overlayOpacity: 1,
      cardScale: Number((0.985 + (t / 0.45) * 0.015).toFixed(4)),
      lotusRotationDeg,
      statusLabel: 'Initializing 8-Fold Symmetry Framebuffer…',
      isComplete: false,
    };
  }

  if (t < 0.78) {
    return {
      phase: 'stage-calibrate',
      progressPct,
      overlayOpacity: 1,
      cardScale: 1,
      lotusRotationDeg,
      statusLabel: 'Calibrating Pigments, Shaders & Spatial Surfaces…',
      isComplete: false,
    };
  }

  const fadeT = (t - 0.78) / 0.22;
  return {
    phase: 'reveal-fade',
    progressPct,
    overlayOpacity: Number(Math.max(0, 1 - fadeT).toFixed(4)),
    cardScale: Number((1 + fadeT * 0.012).toFixed(4)),
    lotusRotationDeg,
    statusLabel: 'Entering Graphics Rendering Workspace…',
    isComplete: false,
  };
}
