import { sampleCubicBezier } from './bezier';
import type { DrawOperation, Point2D } from './types';

export interface LayerBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

function clampCoord(v: number, canvasSize = 720): number {
  return Math.max(-canvasSize * 0.25, Math.min(canvasSize * 1.25, v));
}

function rotatePt(pt: Point2D, angleRad: number, origin: Point2D): Point2D {
  const dx = pt.x - origin.x;
  const dy = pt.y - origin.y;
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return {
    x: origin.x + dx * c - dy * s,
    y: origin.y + dx * s + dy * c,
  };
}

function scalePt(pt: Point2D, scale: number, origin: Point2D): Point2D {
  return {
    x: origin.x + (pt.x - origin.x) * scale,
    y: origin.y + (pt.y - origin.y) * scale,
  };
}

function translatePt(pt: Point2D, dx: number, dy: number): Point2D {
  return { x: pt.x + dx, y: pt.y + dy };
}

/**
 * Computes the axis-aligned bounding box and geometric centroid of a single
 * primary DrawOperation (before radial symmetry expansion) so the artist can
 * move, scale, or rotate any placed circle, line, polygon, freehand curve,
 * Bézier motif, or fill seed directly on canvas.
 */
export function computeOperationBounds(op: DrawOperation): LayerBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const include = (p: Point2D, pad = 0) => {
    if (p.x - pad < minX) minX = p.x - pad;
    if (p.y - pad < minY) minY = p.y - pad;
    if (p.x + pad > maxX) maxX = p.x + pad;
    if (p.y + pad > maxY) maxY = p.y + pad;
  };

  if (op.kind === 'line') {
    include(op.p0);
    include(op.p1);
  } else if (op.kind === 'circle') {
    include(op.center, Math.max(8, op.radius));
  } else if (op.kind === 'polygon') {
    for (const v of op.vertices) include(v);
  } else if (op.kind === 'freehand') {
    for (const p of op.points) include(p);
  } else if (op.kind === 'bezier') {
    include(op.p0);
    include(op.p1);
    include(op.p2);
    include(op.p3);
    for (const p of sampleCubicBezier(op.p0, op.p1, op.p2, op.p3, 16)) {
      include(p);
    }
  } else if (op.kind === 'fill') {
    include(op.seed, 18);
  }

  if (!Number.isFinite(minX)) {
    minX = 340;
    minY = 340;
    maxX = 380;
    maxY = 380;
  }

  // Ensure a comfortable minimum selection box size for thin horizontal/vertical strokes
  const minHalf = 14;
  if (maxX - minX < minHalf * 2) {
    const mid = (minX + maxX) / 2;
    minX = mid - minHalf;
    maxX = mid + minHalf;
  }
  if (maxY - minY < minHalf * 2) {
    const mid = (minY + maxY) / 2;
    minY = mid - minHalf;
    maxY = mid + minHalf;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

/**
 * Translates a single DrawOperation by (dx, dy) in logical canvas coordinates.
 * Locked operations are returned unchanged.
 */
export function translateOperation(
  op: DrawOperation,
  dx: number,
  dy: number,
  canvasSize = 720
): DrawOperation {
  if (op.locked) return op;
  const mv = (p: Point2D): Point2D => ({
    x: clampCoord(translatePt(p, dx, dy).x, canvasSize),
    y: clampCoord(translatePt(p, dx, dy).y, canvasSize),
  });

  if (op.kind === 'line') {
    return { ...op, p0: mv(op.p0), p1: mv(op.p1) };
  }
  if (op.kind === 'circle') {
    return { ...op, center: mv(op.center) };
  }
  if (op.kind === 'polygon') {
    return { ...op, vertices: op.vertices.map(mv) };
  }
  if (op.kind === 'freehand') {
    return { ...op, points: op.points.map(mv) };
  }
  if (op.kind === 'bezier') {
    return {
      ...op,
      p0: mv(op.p0),
      p1: mv(op.p1),
      p2: mv(op.p2),
      p3: mv(op.p3),
    };
  }
  return { ...op, seed: mv(op.seed) };
}

/**
 * Scales a single DrawOperation uniformly around `origin`.
 * Clamps scale factor to [0.15, 4.0] and preserves locked operations unchanged.
 */
export function scaleOperationAroundPoint(
  op: DrawOperation,
  scaleInput: number,
  origin: Point2D
): DrawOperation {
  if (op.locked) return op;
  const scale = Math.max(0.15, Math.min(4.0, scaleInput));
  const sc = (p: Point2D) => scalePt(p, scale, origin);

  if (op.kind === 'line') {
    return { ...op, p0: sc(op.p0), p1: sc(op.p1) };
  }
  if (op.kind === 'circle') {
    return {
      ...op,
      center: sc(op.center),
      radius: Math.max(3, Math.min(350, op.radius * scale)),
    };
  }
  if (op.kind === 'polygon') {
    return { ...op, vertices: op.vertices.map(sc) };
  }
  if (op.kind === 'freehand') {
    return { ...op, points: op.points.map(sc) };
  }
  if (op.kind === 'bezier') {
    return {
      ...op,
      p0: sc(op.p0),
      p1: sc(op.p1),
      p2: sc(op.p2),
      p3: sc(op.p3),
    };
  }
  return { ...op, seed: sc(op.seed) };
}

/**
 * Rotates a single DrawOperation by `angleRad` radians around `origin`.
 * Preserves locked operations unchanged.
 */
export function rotateOperationAroundPoint(
  op: DrawOperation,
  angleRad: number,
  origin: Point2D
): DrawOperation {
  if (op.locked) return op;
  const rt = (p: Point2D) => rotatePt(p, angleRad, origin);

  if (op.kind === 'line') {
    return { ...op, p0: rt(op.p0), p1: rt(op.p1) };
  }
  if (op.kind === 'circle') {
    return { ...op, center: rt(op.center) };
  }
  if (op.kind === 'polygon') {
    return { ...op, vertices: op.vertices.map(rt) };
  }
  if (op.kind === 'freehand') {
    return { ...op, points: op.points.map(rt) };
  }
  if (op.kind === 'bezier') {
    return {
      ...op,
      p0: rt(op.p0),
      p1: rt(op.p1),
      p2: rt(op.p2),
      p3: rt(op.p3),
    };
  }
  return { ...op, seed: rt(op.seed) };
}

/**
 * Replaces an unlocked operation by id with its transformed version.
 */
export function replaceOperationInStack(
  operations: DrawOperation[],
  transformed: DrawOperation
): DrawOperation[] {
  return operations.map((op) =>
    op.id === transformed.id && !op.locked ? transformed : op
  );
}
