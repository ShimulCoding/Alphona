import { nextDeterministicRand } from './generativeComposer';
import type { DrawOperation, Point2D } from './types';

/**
 * Kolam / Pulli Dot-Grid Composer — Mirror-Curve Algorithm
 * ---------------------------------------------------------
 * A dot-grid (pulli) kolam is modelled as a "mirror curve" (P. Gerdes, Lunda designs):
 *
 *  - rows × cols dots sit at the centres of unit grid cells.
 *  - The curve runs diagonally (45°) between the midpoints of the cell edges, looping
 *    around the dots.
 *  - Every outer border edge is a mirror. Each inner grid edge may hold a two-sided
 *    mirror; when the curve meets a mirror it reflects (dx = -dx on a vertical edge,
 *    dy = -dy on a horizontal edge), otherwise it passes straight through and crosses
 *    itself, which gives the characteristic kolam crossings.
 *
 * Every cell holds exactly 4 diagonal segments (one per quadrant around its dot), so the
 * whole design always uses 4·rows·cols segments, split over one or more closed loops.
 * Classic results used in the tests: with no inner mirrors the number of loops is
 * gcd(rows, cols); with every inner edge mirrored each dot gets its own loop.
 *
 * Coordinates are traced on a doubled integer lattice (all values exact), then mapped to
 * canvas pixels and rounded with closed Chaikin corner cutting. The C++11 twin lives in
 * cpp-alpona-studio/src/kolam_composer.cpp and produces bit-identical loop counts.
 */

export type KolamSymmetry = 'none' | 'mirror' | 'rotational';

export interface KolamConfig {
  rows: number; // 2..12 dots
  cols: number; // 2..12 dots
  mirrorDensity: number; // 0..1 probability that an inner edge holds a mirror
  seed: number;
  symmetry: KolamSymmetry; // mirror = left-right + top-bottom; rotational = 90° (square) or 180°
  requireSingleLoop: boolean; // search seed, seed+1, ... for a one-stroke kolam
  loopColors: string[]; // loop i uses loopColors[i % length]
  dotColor: string;
  thickness: number;
  showDots: boolean;
  smoothingIterations: number; // Chaikin passes, 0..3
}

export interface KolamMirrorGrid {
  rows: number;
  cols: number;
  /** vertical edges, index y * (cols + 1) + x, x in 0..cols, y in 0..rows-1 */
  vertical: boolean[];
  /** horizontal edges, index y * cols + x, x in 0..cols-1, y in 0..rows */
  horizontal: boolean[];
  innerMirrorCount: number;
}

export interface KolamTraceResult {
  /** closed loops as points on the doubled lattice (x2), first point repeated at the end */
  loops: Point2D[][];
  segmentCount: number;
}

export interface KolamComposeResult {
  operations: DrawOperation[];
  loopCount: number;
  segmentCount: number;
  innerMirrorCount: number;
  seedUsed: number;
  attempts: number;
  isSingleLoop: boolean;
  rows: number;
  cols: number;
}

export const KOLAM_MIN_DOTS = 2;
export const KOLAM_MAX_DOTS = 12;
export const KOLAM_MAX_SEARCH_ATTEMPTS = 240;

export function clampKolamDots(n: number): number {
  return Math.max(KOLAM_MIN_DOTS, Math.min(KOLAM_MAX_DOTS, Math.round(n) || KOLAM_MIN_DOTS));
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

// Edge encoding: vertical edges first, then horizontal edges.
function edgeId(rows: number, cols: number, vertical: boolean, x: number, y: number): number {
  return vertical ? y * (cols + 1) + x : rows * (cols + 1) + y * cols + x;
}

function symmetryImages(
  rows: number,
  cols: number,
  symmetry: KolamSymmetry,
  vertical: boolean,
  x: number,
  y: number
): Array<[boolean, number, number]> {
  if (symmetry === 'mirror') {
    // Left-right: x -> cols - x ; top-bottom: y -> rows - y
    return vertical
      ? [
          [true, cols - x, y],
          [true, x, rows - 1 - y],
        ]
      : [
          [false, cols - 1 - x, y],
          [false, x, rows - y],
        ];
  }
  if (symmetry === 'rotational') {
    if (rows === cols) {
      // 90° rotation (x, y) -> (n - y, x)
      const n = rows;
      return vertical ? [[false, n - 1 - y, x]] : [[true, n - y, x]];
    }
    // 180° rotation (x, y) -> (cols - x, rows - y)
    return vertical ? [[true, cols - x, rows - 1 - y]] : [[false, cols - 1 - x, rows - y]];
  }
  return [];
}

/**
 * Places mirrors on the inner grid edges. One random draw is made per symmetry orbit,
 * visiting edges in a fixed order (vertical edges row by row, then horizontal edges),
 * so TypeScript and C++11 produce the same grid for the same seed.
 */
export function buildKolamMirrorGrid(
  rows: number,
  cols: number,
  mirrorDensity: number,
  seed: number,
  symmetry: KolamSymmetry
): KolamMirrorGrid {
  const r = clampKolamDots(rows);
  const c = clampKolamDots(cols);
  const density = Math.max(0, Math.min(1, mirrorDensity));
  const vertical = new Array<boolean>((c + 1) * r).fill(false);
  const horizontal = new Array<boolean>(c * (r + 1)).fill(false);
  const decided = new Array<boolean>((c + 1) * r + c * (r + 1)).fill(false);
  const rng = { value: seed >>> 0 || 1 };

  const setEdge = (isVertical: boolean, x: number, y: number, value: boolean) => {
    if (isVertical) vertical[y * (c + 1) + x] = value;
    else horizontal[y * c + x] = value;
    decided[edgeId(r, c, isVertical, x, y)] = true;
  };

  const decideOrbit = (isVertical: boolean, x0: number, y0: number) => {
    if (decided[edgeId(r, c, isVertical, x0, y0)]) return;
    const value = nextDeterministicRand(rng) < density;
    const stack: Array<[boolean, number, number]> = [[isVertical, x0, y0]];
    while (stack.length > 0) {
      const [v, x, y] = stack.pop()!;
      if (decided[edgeId(r, c, v, x, y)]) continue;
      setEdge(v, x, y, value);
      for (const img of symmetryImages(r, c, symmetry, v, x, y)) {
        if (!decided[edgeId(r, c, img[0], img[1], img[2])]) stack.push(img);
      }
    }
  };

  for (let y = 0; y < r; y++) for (let x = 1; x < c; x++) decideOrbit(true, x, y);
  for (let y = 1; y < r; y++) for (let x = 0; x < c; x++) decideOrbit(false, x, y);

  let innerMirrorCount = 0;
  for (let y = 0; y < r; y++) for (let x = 1; x < c; x++) if (vertical[y * (c + 1) + x]) innerMirrorCount++;
  for (let y = 1; y < r; y++) for (let x = 0; x < c; x++) if (horizontal[y * c + x]) innerMirrorCount++;

  // The outer border always reflects.
  for (let y = 0; y < r; y++) {
    vertical[y * (c + 1)] = true;
    vertical[y * (c + 1) + c] = true;
  }
  for (let x = 0; x < c; x++) {
    horizontal[x] = true;
    horizontal[r * c + x] = true;
  }

  return { rows: r, cols: c, vertical, horizontal, innerMirrorCount };
}

function segmentIndex(cols: number, px: number, py: number, dx: number, dy: number): number {
  // Midpoint of the segment on the quadrupled lattice: K = 2P + d (always ≡ 1 or 3 mod 4)
  const kx = 2 * px + dx;
  const ky = 2 * py + dy;
  const cx = Math.floor(kx / 4);
  const cy = Math.floor(ky / 4);
  const qx = kx - 4 * cx === 3 ? 1 : 0;
  const qy = ky - 4 * cy === 3 ? 1 : 0;
  return ((cy * cols + cx) * 2 + qy) * 2 + qx;
}

/** Traces every closed mirror curve of the grid. */
export function traceKolamLoops(grid: KolamMirrorGrid): KolamTraceResult {
  const { rows, cols, vertical, horizontal } = grid;
  const total = 4 * rows * cols;
  const used = new Array<boolean>(total).fill(false);
  const loops: Point2D[][] = [];

  for (let s = 0; s < total; s++) {
    if (used[s]) continue;
    const qx = s & 1;
    const qy = (s >> 1) & 1;
    const cell = s >> 2;
    const cx = cell % cols;
    const cy = Math.floor(cell / cols);
    // Start on the vertical edge of this quadrant, heading to its horizontal edge.
    const startX = 2 * (cx + qx);
    const startY = 2 * cy + 1;
    const startDx = 1 - 2 * qx;
    const startDy = 2 * qy - 1;

    let px = startX;
    let py = startY;
    let dx = startDx;
    let dy = startDy;
    const loop: Point2D[] = [{ x: px, y: py }];
    for (let guard = 0; guard <= total; guard++) {
      used[segmentIndex(cols, px, py, dx, dy)] = true;
      px += dx;
      py += dy;
      loop.push({ x: px, y: py });
      if (px % 2 === 0) {
        if (vertical[((py - 1) / 2) * (cols + 1) + px / 2]) dx = -dx;
      } else if (horizontal[(py / 2) * cols + (px - 1) / 2]) {
        dy = -dy;
      }
      if (px === startX && py === startY && dx === startDx && dy === startDy) break;
    }
    loops.push(loop);
  }

  return { loops, segmentCount: total };
}

/** Closed-polygon Chaikin corner cutting (Q = ¾P_i + ¼P_i+1, R = ¼P_i + ¾P_i+1). */
export function chaikinClosed(points: Point2D[], iterations: number): Point2D[] {
  let pts = points.slice();
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (a.x === b.x && a.y === b.y) pts.pop();
  }
  const passes = Math.max(0, Math.min(3, Math.round(iterations)));
  for (let it = 0; it < passes && pts.length >= 3; it++) {
    const next: Point2D[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      next.push({ x: 0.75 * p.x + 0.25 * q.x, y: 0.75 * p.y + 0.25 * q.y });
      next.push({ x: 0.25 * p.x + 0.75 * q.x, y: 0.25 * p.y + 0.75 * q.y });
    }
    pts = next;
  }
  if (pts.length > 0) pts.push({ x: pts[0].x, y: pts[0].y });
  return pts;
}

/** Canvas layout: the dot grid fills ~82% of the square canvas and is centred. */
export function kolamCellSize(canvasSize: number, rows: number, cols: number): number {
  return Math.floor((canvasSize * 0.82) / Math.max(rows, cols));
}

export function composeKolam(canvasSize: number, config: KolamConfig): KolamComposeResult {
  const rows = clampKolamDots(config.rows);
  const cols = clampKolamDots(config.cols);
  const baseSeed = config.seed >>> 0;

  let bestGrid: KolamMirrorGrid | null = null;
  let bestTrace: KolamTraceResult | null = null;
  let bestSeed = baseSeed;
  let attempts = 0;
  const maxAttempts = config.requireSingleLoop ? KOLAM_MAX_SEARCH_ATTEMPTS : 1;

  for (let a = 0; a < maxAttempts; a++) {
    const seed = (baseSeed + a) >>> 0;
    const grid = buildKolamMirrorGrid(rows, cols, config.mirrorDensity, seed, config.symmetry);
    const trace = traceKolamLoops(grid);
    attempts = a + 1;
    if (!bestTrace || trace.loops.length < bestTrace.loops.length) {
      bestGrid = grid;
      bestTrace = trace;
      bestSeed = seed;
    }
    if (bestTrace.loops.length === 1) break;
  }

  const grid = bestGrid!;
  const trace = bestTrace!;
  const cell = kolamCellSize(canvasSize, rows, cols);
  const ox = (canvasSize - cols * cell) / 2;
  const oy = (canvasSize - rows * cell) / 2;
  const toCanvas = (p: Point2D): Point2D => ({
    x: ox + (p.x / 2) * cell,
    y: oy + (p.y / 2) * cell,
  });

  const colors = config.loopColors.length > 0 ? config.loopColors : ['#F8F4EC'];
  const thickness = Math.max(1, Math.round(config.thickness));
  const tag = `kolam-${rows}x${cols}-${bestSeed}`;
  const noSymmetry = { sectors: 1, reflect: false };
  const operations: DrawOperation[] = [];

  trace.loops.forEach((loop, i) => {
    operations.push({
      id: `${tag}-loop-${i}`,
      kind: 'freehand',
      points: chaikinClosed(loop.map(toCanvas), config.smoothingIterations),
      color: colors[i % colors.length],
      thickness,
      symmetry: noSymmetry,
      group: 'Kolam',
    });
  });

  if (config.showDots) {
    // A circle of radius r stamped with a disc brush of radius r renders a solid dot of radius ~2r.
    const dotRadius = Math.max(2, Math.round(cell * 0.06));
    const radius = Math.max(1, Math.round(dotRadius / 2));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        operations.push({
          id: `${tag}-dot-${y}-${x}`,
          kind: 'circle',
          center: { x: Math.round(ox + (x + 0.5) * cell), y: Math.round(oy + (y + 0.5) * cell) },
          radius,
          color: config.dotColor,
          thickness: 2 * radius + 1,
          symmetry: noSymmetry,
          group: 'Pulli Dots',
        });
      }
    }
  }

  return {
    operations,
    loopCount: trace.loops.length,
    segmentCount: trace.segmentCount,
    innerMirrorCount: grid.innerMirrorCount,
    seedUsed: bestSeed,
    attempts,
    isSingleLoop: trace.loops.length === 1,
    rows,
    cols,
  };
}
