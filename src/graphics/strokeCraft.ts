import type { Point2D } from './types';

/**
 * Chaikin Corner-Cutting Subdivision + Moving-Average Stroke Stabilizer (CLO-2):
 * Eliminates mouse/touch hand-shake jitter while preserving exact start and end endpoints.
 *   - level 0: raw input points
 *   - level 1..3: 3-point weighted moving-average pass + `level` Chaikin (1/4, 3/4) subdivisions
 */
export function stabilizeStrokePoints(
  points: Point2D[],
  level: number
): Point2D[] {
  const safeLevel = Math.max(0, Math.min(3, Math.round(level)));
  if (safeLevel === 0 || points.length < 3) {
    return points.map((p) => ({ x: p.x, y: p.y }));
  }

  // Pass 1: Distance-filtered 3-point Gaussian smoothing (0.25, 0.5, 0.25)
  let current: Point2D[] = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    current.push({
      x: 0.25 * prev.x + 0.5 * cur.x + 0.25 * next.x,
      y: 0.25 * prev.y + 0.5 * cur.y + 0.25 * next.y,
    });
  }
  current.push({
    x: points[points.length - 1].x,
    y: points[points.length - 1].y,
  });

  // Pass 2: Chaikin Corner-Cutting Subdivision (Q_i = 0.75*P_i + 0.25*P_{i+1}, R_i = 0.25*P_i + 0.75*P_{i+1})
  for (let iter = 0; iter < safeLevel; iter++) {
    if (current.length < 3 || current.length > 420) break;
    const nextPts: Point2D[] = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const a = current[i];
      const b = current[i + 1];
      nextPts.push({
        x: 0.75 * a.x + 0.25 * b.x,
        y: 0.75 * a.y + 0.25 * b.y,
      });
      nextPts.push({
        x: 0.25 * a.x + 0.75 * b.x,
        y: 0.25 * a.y + 0.75 * b.y,
      });
    }
    nextPts.push(current[current.length - 1]);
    current = nextPts;
  }

  return current;
}

/**
 * Computes traditional Bengali Rice-Paste (Chaler Guro) calligraphy brush taper
 * at normalized arc-length parameter u in [0, 1]:
 *   - Pointed teardrop entry/exit tips (~0.32x base thickness)
 *   - Full creamy rice-paste swell in the middle (~1.38x base thickness)
 */
export function computeRicePasteTaperThickness(
  baseThickness: number,
  u: number
): number {
  const clampedU = Math.max(0, Math.min(1, u));
  const envelope = Math.sin(Math.PI * clampedU); // 0 at ends, 1 at midpoint
  const smoothBell = Math.pow(envelope, 0.65);
  const factor = 0.32 + 1.06 * smoothBell;
  return Math.max(1, Math.round(baseThickness * factor));
}

/**
 * Combines real pen/stylus PointerEvent.pressure (0..1, default 0.5 for mouse)
 * with optional Chaler Guro arc-length brush taper.
 *   - pressure = 0.5 yields 1.0x neutral scale (no change for standard mouse)
 *   - pressure = 0.1 yields ~0.46x hairline stroke
 *   - pressure = 1.0 yields ~1.675x expressive bold stroke
 */
export function computePressureTaperThickness(
  baseThickness: number,
  u: number,
  pressure?: number,
  applyTaper = true
): number {
  const p =
    typeof pressure === 'number' && Number.isFinite(pressure) && pressure > 0
      ? Math.max(0.05, Math.min(1, pressure))
      : 0.5;
  const pressureScale = 0.325 + 1.35 * p;
  if (!applyTaper) {
    return Math.max(1, Math.round(baseThickness * pressureScale));
  }
  const clampedU = Math.max(0, Math.min(1, u));
  const envelope = Math.sin(Math.PI * clampedU);
  const smoothBell = Math.pow(envelope, 0.65);
  const taperFactor = 0.32 + 1.06 * smoothBell;
  return Math.max(1, Math.round(baseThickness * taperFactor * pressureScale));
}

/**
 * Linearly resamples a raw pressure array so it stays 1:1 aligned with a
 * Chaikin-stabilized polyline of length `targetLen`.
 */
export function resamplePressuresForStabilized(
  rawPressures: number[],
  targetLen: number
): number[] {
  if (targetLen <= 0) return [];
  if (rawPressures.length === 0) {
    return new Array<number>(targetLen).fill(0.5);
  }
  if (rawPressures.length === 1 || targetLen === 1) {
    return new Array<number>(targetLen).fill(rawPressures[0]);
  }
  const out: number[] = [];
  const srcMax = rawPressures.length - 1;
  const dstMax = targetLen - 1;
  for (let i = 0; i < targetLen; i++) {
    const pos = (i / dstMax) * srcMax;
    const lo = Math.floor(pos);
    const hi = Math.min(srcMax, lo + 1);
    const frac = pos - lo;
    out.push(rawPressures[lo] * (1 - frac) + rawPressures[hi] * frac);
  }
  return out;
}

/**
 * Precomputes cumulative normalized arc-length parameters u_i in [0, 1]
 * for each segment along a freehand polyline.
 */
export function computePolylineArcParameters(points: Point2D[]): number[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [0.5];
  const cum: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    cum.push(total);
  }
  if (total <= 1e-6) {
    return points.map((_, idx) => idx / Math.max(1, points.length - 1));
  }
  return cum.map((d) => d / total);
}
