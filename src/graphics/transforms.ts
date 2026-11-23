import type {
  ClipAlgorithm,
  ClipBounds,
  Point2D,
  PolygonClipAlgorithm,
  SymmetryConfig,
  Transform2DConfig,
} from './types';

// Cohen-Sutherland 4-bit region outcodes
export const OUTCODE_INSIDE = 0b0000; // 0
export const OUTCODE_LEFT = 0b0001; // 1
export const OUTCODE_RIGHT = 0b0010; // 2
export const OUTCODE_BOTTOM = 0b0100; // 4
export const OUTCODE_TOP = 0b1000; // 8

export interface ClippedSegment {
  p0: Point2D;
  p1: Point2D;
  wasClipped: boolean;
}

// 3x3 row-major homogeneous matrix
export type Mat3 = [
  number, number, number,
  number, number, number,
  number, number, number,
];

export function mat3Identity(): Mat3 {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

export function mat3Multiply(a: Mat3, b: Mat3): Mat3 {
  const out = new Array<number>(9).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] =
        a[r * 3 + 0] * b[0 * 3 + c] +
        a[r * 3 + 1] * b[1 * 3 + c] +
        a[r * 3 + 2] * b[2 * 3 + c];
    }
  }
  return out as Mat3;
}

export function mat3Translate(tx: number, ty: number): Mat3 {
  return [1, 0, tx, 0, 1, ty, 0, 0, 1];
}

export function mat3Scale(sx: number, sy: number): Mat3 {
  return [sx, 0, 0, 0, sy, 0, 0, 0, 1];
}

export function mat3Rotate(angleRad: number): Mat3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

export function mat3Shear(shx: number, shy: number): Mat3 {
  return [1, shx, 0, shy, 1, 0, 0, 0, 1];
}

export function mat3Reflect(flipX: boolean, flipY: boolean): Mat3 {
  return [flipX ? -1 : 1, 0, 0, 0, flipY ? -1 : 1, 0, 0, 0, 1];
}

export function mat3Inverse(m: Mat3): Mat3 | null {
  const [a, b, tx, c, d, ty] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-10) {
    return null;
  }
  const invDet = 1 / det;
  const ia = d * invDet;
  const ib = -b * invDet;
  const ic = -c * invDet;
  const id = a * invDet;
  const itx = -(ia * tx + ib * ty);
  const ity = -(ic * tx + id * ty);
  return [ia, ib, itx, ic, id, ity, 0, 0, 1];
}

export function applyMat3(m: Mat3, p: Point2D): Point2D {
  return {
    x: m[0] * p.x + m[1] * p.y + m[2],
    y: m[3] * p.x + m[4] * p.y + m[5],
  };
}

export function buildHomogeneousTransform2D(
  cfg: Transform2DConfig,
  center: Point2D
): Mat3 {
  const rad = (cfg.rotateDeg * Math.PI) / 180;
  let m = mat3Translate(center.x + cfg.translateX, center.y + cfg.translateY);
  m = mat3Multiply(m, mat3Rotate(rad));
  m = mat3Multiply(m, mat3Shear(cfg.shearX, cfg.shearY));
  m = mat3Multiply(m, mat3Scale(cfg.scaleX, cfg.scaleY));
  m = mat3Multiply(m, mat3Reflect(Boolean(cfg.flipX), Boolean(cfg.flipY)));
  m = mat3Multiply(m, mat3Translate(-center.x, -center.y));
  return m;
}

export function buildCenteredTransformMatrix2D(cfg: Transform2DConfig): Mat3 {
  const rad = (cfg.rotateDeg * Math.PI) / 180;
  let m = mat3Translate(cfg.translateX, cfg.translateY);
  m = mat3Multiply(m, mat3Rotate(rad));
  m = mat3Multiply(m, mat3Shear(cfg.shearX, cfg.shearY));
  m = mat3Multiply(m, mat3Scale(cfg.scaleX, cfg.scaleY));
  m = mat3Multiply(m, mat3Reflect(Boolean(cfg.flipX), Boolean(cfg.flipY)));
  return m;
}

export function isIdentityTransform2D(cfg: Transform2DConfig): boolean {
  return (
    cfg.translateX === 0 &&
    cfg.translateY === 0 &&
    cfg.scaleX === 1 &&
    cfg.scaleY === 1 &&
    cfg.rotateDeg === 0 &&
    cfg.shearX === 0 &&
    cfg.shearY === 0 &&
    !cfg.flipX &&
    !cfg.flipY
  );
}

export function computeOutcode(x: number, y: number, bounds: ClipBounds): number {
  let code = OUTCODE_INSIDE;
  if (x < bounds.xmin) {
    code |= OUTCODE_LEFT;
  } else if (x > bounds.xmax) {
    code |= OUTCODE_RIGHT;
  }
  if (y < bounds.ymin) {
    code |= OUTCODE_TOP;
  } else if (y > bounds.ymax) {
    code |= OUTCODE_BOTTOM;
  }
  return code;
}

export function cohenSutherlandClip(
  p0: Point2D,
  p1: Point2D,
  bounds: ClipBounds
): ClippedSegment | null {
  let x0 = p0.x;
  let y0 = p0.y;
  let x1 = p1.x;
  let y1 = p1.y;

  let code0 = computeOutcode(x0, y0, bounds);
  let code1 = computeOutcode(x1, y1, bounds);
  let wasClipped = false;

  for (let iter = 0; iter < 8; iter++) {
    if ((code0 | code1) === 0) {
      return {
        p0: { x: x0, y: y0 },
        p1: { x: x1, y: y1 },
        wasClipped,
      };
    }

    if ((code0 & code1) !== 0) {
      return null;
    }

    wasClipped = true;
    const outcodeOut = code0 !== 0 ? code0 : code1;
    let x = 0;
    let y = 0;

    if (outcodeOut & OUTCODE_BOTTOM) {
      x = x0 + ((x1 - x0) * (bounds.ymax - y0)) / (y1 - y0);
      y = bounds.ymax;
    } else if (outcodeOut & OUTCODE_TOP) {
      x = x0 + ((x1 - x0) * (bounds.ymin - y0)) / (y1 - y0);
      y = bounds.ymin;
    } else if (outcodeOut & OUTCODE_RIGHT) {
      y = y0 + ((y1 - y0) * (bounds.xmax - x0)) / (x1 - x0);
      x = bounds.xmax;
    } else if (outcodeOut & OUTCODE_LEFT) {
      y = y0 + ((y1 - y0) * (bounds.xmin - x0)) / (x1 - x0);
      x = bounds.xmin;
    }

    if (outcodeOut === code0) {
      x0 = x;
      y0 = y;
      code0 = computeOutcode(x0, y0, bounds);
    } else {
      x1 = x;
      y1 = y;
      code1 = computeOutcode(x1, y1, bounds);
    }
  }

  return null;
}

export function liangBarskyClip(
  p0: Point2D,
  p1: Point2D,
  bounds: ClipBounds
): ClippedSegment | null {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;

  const p = [-dx, dx, -dy, dy];
  const q = [
    p0.x - bounds.xmin,
    bounds.xmax - p0.x,
    p0.y - bounds.ymin,
    bounds.ymax - p0.y,
  ];

  let t0 = 0;
  let t1 = 1;

  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-12) {
      if (q[i] < 0) {
        return null;
      }
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }

  const wasClipped = t0 > 1e-9 || t1 < 1 - 1e-9;
  return {
    p0: { x: p0.x + t0 * dx, y: p0.y + t0 * dy },
    p1: { x: p0.x + t1 * dx, y: p0.y + t1 * dy },
    wasClipped,
  };
}

export function clipLineSegment(
  p0: Point2D,
  p1: Point2D,
  bounds: ClipBounds,
  algorithm: ClipAlgorithm = 'cohen-sutherland'
): ClippedSegment | null {
  return algorithm === 'liang-barsky'
    ? liangBarskyClip(p0, p1, bounds)
    : cohenSutherlandClip(p0, p1, bounds);
}

/**
 * Sutherland-Hodgman Re-entrant Polygon Clipping Algorithm (CSE 401/402 CLO-3/5).
 */
export function sutherlandHodgmanClip(
  polygon: Point2D[],
  bounds: ClipBounds
): Point2D[] {
  if (polygon.length < 3) return [];

  type EdgeTest = {
    inside: (p: Point2D) => boolean;
    intersect: (a: Point2D, b: Point2D) => Point2D;
  };

  const edges: EdgeTest[] = [
    {
      inside: (p) => p.x >= bounds.xmin,
      intersect: (a, b) => {
        const t = (bounds.xmin - a.x) / (b.x - a.x);
        return { x: bounds.xmin, y: a.y + t * (b.y - a.y) };
      },
    },
    {
      inside: (p) => p.x <= bounds.xmax,
      intersect: (a, b) => {
        const t = (bounds.xmax - a.x) / (b.x - a.x);
        return { x: bounds.xmax, y: a.y + t * (b.y - a.y) };
      },
    },
    {
      inside: (p) => p.y >= bounds.ymin,
      intersect: (a, b) => {
        const t = (bounds.ymin - a.y) / (b.y - a.y);
        return { x: a.x + t * (b.x - a.x), y: bounds.ymin };
      },
    },
    {
      inside: (p) => p.y <= bounds.ymax,
      intersect: (a, b) => {
        const t = (bounds.ymax - a.y) / (b.y - a.y);
        return { x: a.x + t * (b.x - a.x), y: bounds.ymax };
      },
    },
  ];

  let output = polygon.slice();

  for (const edge of edges) {
    const input = output;
    output = [];
    if (input.length === 0) break;

    let prev = input[input.length - 1];
    let prevInside = edge.inside(prev);

    for (const curr of input) {
      const currInside = edge.inside(curr);
      if (currInside) {
        if (!prevInside) {
          output.push(edge.intersect(prev, curr));
        }
        output.push(curr);
      } else if (prevInside) {
        output.push(edge.intersect(prev, curr));
      }
      prev = curr;
      prevInside = currInside;
    }
  }

  return output;
}

function polygonSignedArea(poly: Point2D[]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area * 0.5;
}

function pointInPolygon(pt: Point2D, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-15) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInBounds(p: Point2D, b: ClipBounds): boolean {
  return p.x >= b.xmin && p.x <= b.xmax && p.y >= b.ymin && p.y <= b.ymax;
}

function segmentIntersection(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D
): { x: number; y: number; t: number; u: number; cross: number } | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const cross = rx * sy - ry * sx;
  if (Math.abs(cross) < 1e-10) return null;

  const qpx = c.x - a.x;
  const qpy = c.y - a.y;
  const t = (qpx * sy - qpy * sx) / cross;
  const u = (qpx * ry - qpy * rx) / cross;

  if (t > 1e-7 && t < 1 - 1e-7 && u > 1e-7 && u < 1 - 1e-7) {
    return {
      x: a.x + t * rx,
      y: a.y + t * ry,
      t,
      u,
      cross,
    };
  }
  return null;
}

/**
 * Weiler-Atherton Concave Polygon Clipping Algorithm (CSE 401 CLO-3 & CSE 402 CLO-5).
 * Constructs linked subject & clip-window intersection lists and traverses
 * entering/exiting pairs so concave polygons split cleanly into separate disjoint
 * polygons without degenerate connecting edges along the clip boundary.
 */
export function weilerAthertonClip(
  polygon: Point2D[],
  bounds: ClipBounds
): Point2D[][] {
  if (polygon.length < 3) return [];

  // Orient subject polygon clockwise in screen coordinates (positive signed area)
  // Perturb vertices that lie exactly on clip edges by tiny epsilon to avoid degeneracy
  const raw = polygonSignedArea(polygon) < 0 ? polygon.slice().reverse() : polygon.slice();
  const subject: Point2D[] = raw.map((v) => {
    let x = v.x;
    let y = v.y;
    if (Math.abs(x - bounds.xmin) < 1e-4) x += 1e-3;
    if (Math.abs(x - bounds.xmax) < 1e-4) x -= 1e-3;
    if (Math.abs(y - bounds.ymin) < 1e-4) y += 1e-3;
    if (Math.abs(y - bounds.ymax) < 1e-4) y -= 1e-3;
    return { x, y };
  });

  // Clip window in same clockwise orientation (screen Y-down: TL -> TR -> BR -> BL)
  const clipRect: Point2D[] = [
    { x: bounds.xmin, y: bounds.ymin },
    { x: bounds.xmax, y: bounds.ymin },
    { x: bounds.xmax, y: bounds.ymax },
    { x: bounds.xmin, y: bounds.ymax },
  ];

  interface WANode {
    pt: Point2D;
    isIntersection: boolean;
    isEntering: boolean;
    visited: boolean;
    partnerIdx: number;
    edgeIdx: number;
    t: number;
  }

  const subIntersections: Array<WANode & { clipEdgeIdx: number; clipT: number }> = [];

  for (let i = 0; i < subject.length; i++) {
    const a = subject[i];
    const b = subject[(i + 1) % subject.length];
    for (let j = 0; j < clipRect.length; j++) {
      const c = clipRect[j];
      const d = clipRect[(j + 1) % clipRect.length];
      const hit = segmentIntersection(a, b, c, d);
      if (hit) {
        // In clockwise screen coords, clip interior lies to the right of c->d (cross < 0 means entering)
        const isEntering = hit.cross < 0;
        subIntersections.push({
          pt: { x: hit.x, y: hit.y },
          isIntersection: true,
          isEntering,
          visited: false,
          partnerIdx: -1,
          edgeIdx: i,
          t: hit.t,
          clipEdgeIdx: j,
          clipT: hit.u,
        });
      }
    }
  }

  // No boundary crossings: either completely inside, completely enclosing, or completely outside
  if (subIntersections.length === 0) {
    if (pointInBounds(subject[0], bounds)) {
      return [subject];
    }
    if (pointInPolygon(clipRect[0], subject)) {
      return [clipRect];
    }
    return [];
  }

  // Build ordered Subject circular list
  const subList: WANode[] = [];
  const subIdxByHit = new Map<number, number>();
  for (let i = 0; i < subject.length; i++) {
    subList.push({
      pt: subject[i],
      isIntersection: false,
      isEntering: false,
      visited: false,
      partnerIdx: -1,
      edgeIdx: i,
      t: 0,
    });
    const hitsOnEdge = subIntersections
      .map((h, id) => ({ h, id }))
      .filter(({ h }) => h.edgeIdx === i)
      .sort((u, v) => u.h.t - v.h.t);

    for (const { h, id } of hitsOnEdge) {
      subIdxByHit.set(id, subList.length);
      subList.push({
        pt: h.pt,
        isIntersection: true,
        isEntering: h.isEntering,
        visited: false,
        partnerIdx: -1,
        edgeIdx: i,
        t: h.t,
      });
    }
  }

  // Build ordered Clip Window circular list
  const clipList: WANode[] = [];
  for (let j = 0; j < clipRect.length; j++) {
    clipList.push({
      pt: clipRect[j],
      isIntersection: false,
      isEntering: false,
      visited: false,
      partnerIdx: -1,
      edgeIdx: j,
      t: 0,
    });
    const hitsOnClip = subIntersections
      .map((h, id) => ({ h, id }))
      .filter(({ h }) => h.clipEdgeIdx === j)
      .sort((u, v) => u.h.clipT - v.h.clipT);

    for (const { h, id } of hitsOnClip) {
      const clipIdx = clipList.length;
      const subIdx = subIdxByHit.get(id)!;
      clipList.push({
        pt: h.pt,
        isIntersection: true,
        isEntering: h.isEntering,
        visited: false,
        partnerIdx: subIdx,
        edgeIdx: j,
        t: h.clipT,
      });
      subList[subIdx].partnerIdx = clipIdx;
    }
  }

  // Traverse entering intersections to emit all disjoint clipped polygons
  const results: Point2D[][] = [];
  const maxSteps = (subList.length + clipList.length) * 3;

  for (let startIdx = 0; startIdx < subList.length; startIdx++) {
    const startNode = subList[startIdx];
    if (!startNode.isIntersection || !startNode.isEntering || startNode.visited) {
      continue;
    }

    const outPoly: Point2D[] = [];
    let onSubject = true;
    let idx = startIdx;
    let steps = 0;

    while (steps < maxSteps) {
      steps++;
      const list = onSubject ? subList : clipList;
      const node = list[idx];
      node.visited = true;

      if (
        outPoly.length === 0 ||
        Math.hypot(
          outPoly[outPoly.length - 1].x - node.pt.x,
          outPoly[outPoly.length - 1].y - node.pt.y
        ) > 1e-4
      ) {
        outPoly.push({
          x: Math.max(bounds.xmin, Math.min(bounds.xmax, node.pt.x)),
          y: Math.max(bounds.ymin, Math.min(bounds.ymax, node.pt.y)),
        });
      }

      if (onSubject) {
        idx = (idx + 1) % subList.length;
        const nextNode = subList[idx];
        if (nextNode.isIntersection && !nextNode.isEntering && nextNode.partnerIdx >= 0) {
          nextNode.visited = true;
          outPoly.push({
            x: Math.max(bounds.xmin, Math.min(bounds.xmax, nextNode.pt.x)),
            y: Math.max(bounds.ymin, Math.min(bounds.ymax, nextNode.pt.y)),
          });
          onSubject = false;
          idx = (nextNode.partnerIdx + 1) % clipList.length;
        }
      } else {
        const currClip = clipList[idx];
        if (currClip.isIntersection && currClip.partnerIdx >= 0) {
          if (currClip.partnerIdx === startIdx) {
            break;
          }
          if (currClip.isEntering) {
            onSubject = true;
            idx = currClip.partnerIdx;
            continue;
          }
        }
        idx = (idx + 1) % clipList.length;
      }

      if (onSubject && idx === startIdx) {
        break;
      }
    }

    if (outPoly.length >= 3) {
      results.push(outPoly);
    }
  }

  // Fallback to Sutherland-Hodgman only if numerical edge case produced empty list while intersections exist
  if (results.length === 0) {
    const sh = sutherlandHodgmanClip(polygon, bounds);
    return sh.length >= 3 ? [sh] : [];
  }

  return results;
}

/**
 * Dispatches polygon clipping to either Sutherland-Hodgman or Weiler-Atherton.
 */
export function clipPolygon(
  polygon: Point2D[],
  bounds: ClipBounds,
  algorithm: PolygonClipAlgorithm = 'sutherland-hodgman'
): Point2D[][] {
  if (algorithm === 'weiler-atherton') {
    return weilerAthertonClip(polygon, bounds);
  }
  const clipped = sutherlandHodgmanClip(polygon, bounds);
  return clipped.length >= 3 ? [clipped] : [];
}

export function rotatePoint(
  p: Point2D,
  center: Point2D,
  angleRad: number
): Point2D {
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  return {
    x: center.x + dx * cosA - dy * sinA,
    y: center.y + dx * sinA + dy * cosA,
  };
}

export function reflectPointHorizontal(p: Point2D, center: Point2D): Point2D {
  return {
    x: p.x,
    y: 2 * center.y - p.y,
  };
}

export function generateSymmetricPoints(
  p: Point2D,
  center: Point2D,
  symmetry: SymmetryConfig
): Point2D[] {
  const sectors = Math.max(1, Math.min(24, Math.round(symmetry.sectors)));
  const step = (2 * Math.PI) / sectors;
  const result: Point2D[] = [];
  const mirrored = symmetry.reflect ? reflectPointHorizontal(p, center) : null;

  for (let k = 0; k < sectors; k++) {
    const theta = k * step;
    result.push(rotatePoint(p, center, theta));
    if (mirrored) {
      result.push(rotatePoint(mirrored, center, theta));
    }
  }

  return result;
}

export function generateSymmetricSegments(
  p0: Point2D,
  p1: Point2D,
  center: Point2D,
  symmetry: SymmetryConfig
): Array<{ p0: Point2D; p1: Point2D }> {
  const sectors = Math.max(1, Math.min(24, Math.round(symmetry.sectors)));
  const step = (2 * Math.PI) / sectors;
  const segments: Array<{ p0: Point2D; p1: Point2D }> = [];

  const m0 = symmetry.reflect ? reflectPointHorizontal(p0, center) : null;
  const m1 = symmetry.reflect ? reflectPointHorizontal(p1, center) : null;

  for (let k = 0; k < sectors; k++) {
    const theta = k * step;
    segments.push({
      p0: rotatePoint(p0, center, theta),
      p1: rotatePoint(p1, center, theta),
    });
    if (m0 && m1) {
      segments.push({
        p0: rotatePoint(m0, center, theta),
        p1: rotatePoint(m1, center, theta),
      });
    }
  }

  return segments;
}

export function generateSymmetricPolygons(
  vertices: Point2D[],
  center: Point2D,
  symmetry: SymmetryConfig
): Point2D[][] {
  const sectors = Math.max(1, Math.min(24, Math.round(symmetry.sectors)));
  const step = (2 * Math.PI) / sectors;
  const polygons: Point2D[][] = [];
  const mirrored = symmetry.reflect
    ? vertices.map((v) => reflectPointHorizontal(v, center))
    : null;

  for (let k = 0; k < sectors; k++) {
    const theta = k * step;
    polygons.push(vertices.map((v) => rotatePoint(v, center, theta)));
    if (mirrored) {
      polygons.push(mirrored.map((v) => rotatePoint(v, center, theta)));
    }
  }

  return polygons;
}

export function getRotationMatrix2x2(angleDeg: number): {
  cos: number;
  sin: number;
  negSin: number;
} {
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    cos: Math.abs(c) < 1e-10 ? 0 : c,
    sin: Math.abs(s) < 1e-10 ? 0 : s,
    negSin: Math.abs(s) < 1e-10 ? 0 : -s,
  };
}

export interface SymmetryReflectionAxis {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  angleDeg: number;
  isPrimary: boolean;
  isReflectionMirror: boolean;
}

function rayDistanceToSquareBorder(
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  size: number
): number {
  let tMax = Number.POSITIVE_INFINITY;
  if (Math.abs(dx) > 1e-10) {
    const tx = dx > 0 ? (size - cx) / dx : (0 - cx) / dx;
    if (tx > 0 && tx < tMax) tMax = tx;
  }
  if (Math.abs(dy) > 1e-10) {
    const ty = dy > 0 ? (size - cy) / dy : (0 - cy) / dy;
    if (ty > 0 && ty < tMax) tMax = ty;
  }
  return Number.isFinite(tMax) ? tMax : size / 2;
}

/**
 * Computes exact edge-to-edge reflection mirror axes for Dihedral D_n symmetry
 * (angles k * pi / n, fixing points under reflectPointHorizontal + k*(2*pi/n) rotation)
 * or rotational sector boundary rays for Cyclic C_n symmetry (angles 2*pi*k / n).
 */
export function computeSymmetryReflectionAxes(
  canvasSize: number,
  symmetry: SymmetryConfig
): SymmetryReflectionAxis[] {
  const sectors = Math.max(1, Math.min(24, Math.round(symmetry.sectors)));
  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const axes: SymmetryReflectionAxis[] = [];

  if (symmetry.reflect) {
    // Dihedral D_n has n full mirror lines through center at alpha_k = k * pi / n
    for (let k = 0; k < sectors; k++) {
      const alpha = (Math.PI * k) / sectors;
      const dx = Math.cos(alpha);
      const dy = Math.sin(alpha);
      const tPos = rayDistanceToSquareBorder(cx, cy, dx, dy, canvasSize);
      const tNeg = rayDistanceToSquareBorder(cx, cy, -dx, -dy, canvasSize);
      axes.push({
        x1: cx - dx * tNeg,
        y1: cy - dy * tNeg,
        x2: cx + dx * tPos,
        y2: cy + dy * tPos,
        angleDeg: (180 * k) / sectors,
        isPrimary: k % 2 === 0,
        isReflectionMirror: true,
      });
    }
  } else {
    // Cyclic C_n has n rotational sector boundary rays from center at theta_k = 2*pi*k / n
    for (let k = 0; k < sectors; k++) {
      const theta = (2 * Math.PI * k) / sectors;
      const dx = Math.cos(theta);
      const dy = Math.sin(theta);
      const tPos = rayDistanceToSquareBorder(cx, cy, dx, dy, canvasSize);
      axes.push({
        x1: cx,
        y1: cy,
        x2: cx + dx * tPos,
        y2: cy + dy * tPos,
        angleDeg: (360 * k) / sectors,
        isPrimary: k === 0,
        isReflectionMirror: false,
      });
    }
  }

  return axes;
}
