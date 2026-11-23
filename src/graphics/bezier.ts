import type { Point2D, SymmetryConfig, DrawOperation } from './types';

export interface DeCasteljauFrame {
  t: number;
  q0: Point2D;
  q1: Point2D;
  q2: Point2D;
  r0: Point2D;
  r1: Point2D;
  point: Point2D;
}

export interface BengaliBezierStamp {
  id: string;
  name: string;
  bengali: string;
  description: string;
  build: (
    canvasSize: number,
    radiusFactor: number,
    color: string,
    thickness: number,
    symmetry: SymmetryConfig,
    showDeCasteljau?: boolean
  ) => DrawOperation[];
}

function lerpPoint(a: Point2D, b: Point2D, t: number): Point2D {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/**
 * Evaluates a parametric cubic Bezier curve:
 *   B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
 */
export function evaluateCubicBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number
): Point2D {
  const u = 1 - t;
  const u2 = u * u;
  const u3 = u2 * u;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: u3 * p0.x + 3 * u2 * t * p1.x + 3 * u * t2 * p2.x + t3 * p3.x,
    y: u3 * p0.y + 3 * u2 * t * p1.y + 3 * u * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Computes the geometric de Casteljau recursive linear interpolation pyramid
 * at parameter t in [0, 1] for educational visualization & exact tangent display.
 */
export function deCasteljauSubdivision(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number
): DeCasteljauFrame {
  const clampedT = Math.max(0, Math.min(1, t));
  const q0 = lerpPoint(p0, p1, clampedT);
  const q1 = lerpPoint(p1, p2, clampedT);
  const q2 = lerpPoint(p2, p3, clampedT);
  const r0 = lerpPoint(q0, q1, clampedT);
  const r1 = lerpPoint(q1, q2, clampedT);
  const point = lerpPoint(r0, r1, clampedT);
  return { t: clampedT, q0, q1, q2, r0, r1, point };
}

/**
 * Samples a cubic Bezier curve into a dense polyline for integer Bresenham/DDA rasterization.
 */
export function sampleCubicBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  segments = 28
): Point2D[] {
  const steps = Math.max(4, Math.min(96, Math.round(segments)));
  const pts: Point2D[] = [];
  for (let i = 0; i <= steps; i++) {
    pts.push(evaluateCubicBezier(p0, p1, p2, p3, i / steps));
  }
  return pts;
}

/**
 * Builds ergonomic control points P1, P2 from a start/end drag vector plus curvature factor (-1..1).
 */
export function buildArchBezierFromEndpoints(
  p0: Point2D,
  p3: Point2D,
  curvature = 0.45
): { p0: Point2D; p1: Point2D; p2: Point2D; p3: Point2D } {
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const nx = -dy;
  const ny = dx;

  const p1: Point2D = {
    x: p0.x + dx * 0.3 + nx * curvature,
    y: p0.y + dy * 0.3 + ny * curvature,
  };
  const p2: Point2D = {
    x: p0.x + dx * 0.7 + nx * curvature * 0.85,
    y: p0.y + dy * 0.7 + ny * curvature * 0.85,
  };

  return { p0, p1, p2, p3 };
}

function makeBezierId(prefix: string, idx: number): string {
  return `${prefix}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Authentic parametric Bengali folk motif stamps built from Cubic Bezier splines.
 */
export const BENGALI_BEZIER_STAMPS: BengaliBezierStamp[] = [
  {
    id: 'kalka',
    name: 'Kalka Paisley',
    bengali: 'কলকা (Kalka)',
    description: 'Traditional Bengali wedding & Pohela Boishakh teardrop paisley curl',
    build: (size, rFactor, color, thickness, symmetry, showDeCasteljau) => {
      const c = size / 2;
      const r0 = size * Math.max(0.12, Math.min(0.36, rFactor * 0.65));
      const r1 = size * Math.max(0.22, Math.min(0.45, rFactor));
      const span = r1 - r0;
      const outer: DrawOperation = {
        id: makeBezierId('kalka-outer', 0),
        kind: 'bezier',
        p0: { x: c, y: c - r0 },
        p1: { x: c + span * 0.95, y: c - r0 - span * 0.35 },
        p2: { x: c + span * 0.55, y: c - r1 - span * 0.2 },
        p3: { x: c + span * 0.14, y: c - r1 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau,
      };
      const curl: DrawOperation = {
        id: makeBezierId('kalka-curl', 1),
        kind: 'bezier',
        p0: { x: c + span * 0.14, y: c - r1 },
        p1: { x: c - span * 0.32, y: c - r1 + span * 0.18 },
        p2: { x: c + span * 0.24, y: c - r0 - span * 0.52 },
        p3: { x: c, y: c - r0 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau: false,
      };
      return [outer, curl];
    },
  },
  {
    id: 'shankha',
    name: 'Shankha Conch',
    bengali: 'শঙ্খ (Shankha)',
    description: 'Auspicious spiral conch scroll common in Bengali courtyard borders',
    build: (size, rFactor, color, thickness, symmetry, showDeCasteljau) => {
      const c = size / 2;
      const r = size * Math.max(0.18, Math.min(0.43, rFactor));
      const s = size * 0.085;
      const shell: DrawOperation = {
        id: makeBezierId('shankha-shell', 0),
        kind: 'bezier',
        p0: { x: c - s * 0.75, y: c - r + s * 0.45 },
        p1: { x: c - s * 0.5, y: c - r - s * 0.95 },
        p2: { x: c + s * 1.1, y: c - r - s * 0.7 },
        p3: { x: c + s * 0.55, y: c - r + s * 0.35 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau,
      };
      const spiral: DrawOperation = {
        id: makeBezierId('shankha-spiral', 1),
        kind: 'bezier',
        p0: { x: c + s * 0.55, y: c - r + s * 0.35 },
        p1: { x: c + s * 0.15, y: c - r + s * 0.95 },
        p2: { x: c - s * 0.45, y: c - r + s * 0.15 },
        p3: { x: c + s * 0.1, y: c - r - s * 0.08 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau: false,
      };
      return [shell, spiral];
    },
  },
  {
    id: 'shapla-bud',
    name: 'Shapla Bud',
    bengali: 'শাপলা কলি',
    description: 'Pointed symmetric Bengali water-lily petal arch',
    build: (size, rFactor, color, thickness, symmetry, showDeCasteljau) => {
      const c = size / 2;
      const r0 = size * Math.max(0.1, Math.min(0.32, rFactor * 0.52));
      const r1 = size * Math.max(0.24, Math.min(0.46, rFactor));
      const w = (r1 - r0) * 0.56;
      const rightArch: DrawOperation = {
        id: makeBezierId('shapla-r', 0),
        kind: 'bezier',
        p0: { x: c, y: c - r0 },
        p1: { x: c + w * 1.15, y: c - r0 - (r1 - r0) * 0.34 },
        p2: { x: c + w * 0.72, y: c - r1 + (r1 - r0) * 0.18 },
        p3: { x: c, y: c - r1 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau,
      };
      const leftArch: DrawOperation = {
        id: makeBezierId('shapla-l', 1),
        kind: 'bezier',
        p0: { x: c, y: c - r0 },
        p1: { x: c - w * 1.15, y: c - r0 - (r1 - r0) * 0.34 },
        p2: { x: c - w * 0.72, y: c - r1 + (r1 - r0) * 0.18 },
        p3: { x: c, y: c - r1 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau: false,
      };
      return [rightArch, leftArch];
    },
  },
  {
    id: 'border-vine',
    name: 'Scallop Vine',
    bengali: 'লতা পাড়',
    description: 'Flowing outer Alpona garland connecting neighboring radial sectors',
    build: (size, rFactor, color, thickness, symmetry, showDeCasteljau) => {
      const c = size / 2;
      const r = size * Math.max(0.2, Math.min(0.45, rFactor));
      const halfAngle = Math.PI / Math.max(3, symmetry.sectors);
      const p0: Point2D = {
        x: c + Math.sin(-halfAngle) * r,
        y: c - Math.cos(-halfAngle) * r,
      };
      const p3: Point2D = {
        x: c + Math.sin(halfAngle) * r,
        y: c - Math.cos(halfAngle) * r,
      };
      const swell = r * 1.14;
      const p1: Point2D = {
        x: c + Math.sin(-halfAngle * 0.45) * swell,
        y: c - Math.cos(-halfAngle * 0.45) * swell,
      };
      const p2: Point2D = {
        x: c + Math.sin(halfAngle * 0.45) * swell,
        y: c - Math.cos(halfAngle * 0.45) * swell,
      };
      return [
        {
          id: makeBezierId('vine', 0),
          kind: 'bezier',
          p0,
          p1,
          p2,
          p3,
          color,
          thickness,
          symmetry: { ...symmetry },
          showDeCasteljau,
        },
      ];
    },
  },
  {
    id: 'lokkhir-paa',
    name: 'Lokkhir Paa',
    bengali: 'লক্ষ্মীর পা',
    description: 'Traditional Lakshmi Puja auspicious footprint pair with 5 toe dots',
    build: (size, rFactor, color, thickness, symmetry, showDeCasteljau) => {
      const c = size / 2;
      const r = size * Math.max(0.18, Math.min(0.43, rFactor));
      const s = size * 0.055;
      const fx = c + s * 0.22;
      const fy = c - r;
      const leftEdge: DrawOperation = {
        id: makeBezierId('paa-l', 0),
        kind: 'bezier',
        p0: { x: fx - s * 0.22, y: fy + s * 0.85 },
        p1: { x: fx - s * 0.56, y: fy + s * 0.2 },
        p2: { x: fx - s * 0.45, y: fy - s * 0.58 },
        p3: { x: fx, y: fy - s * 0.65 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau,
      };
      const rightEdge: DrawOperation = {
        id: makeBezierId('paa-r', 1),
        kind: 'bezier',
        p0: { x: fx, y: fy - s * 0.65 },
        p1: { x: fx + s * 0.55, y: fy - s * 0.52 },
        p2: { x: fx + s * 0.42, y: fy + s * 0.35 },
        p3: { x: fx + s * 0.16, y: fy + s * 0.85 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau: false,
      };
      const heel: DrawOperation = {
        id: makeBezierId('paa-heel', 2),
        kind: 'circle',
        center: { x: fx - s * 0.03, y: fy + s * 0.72 },
        radius: Math.max(4, Math.round(s * 0.22)),
        color,
        thickness,
        symmetry: { ...symmetry },
      };
      const bigToe: DrawOperation = {
        id: makeBezierId('paa-toe0', 3),
        kind: 'circle',
        center: { x: fx - s * 0.26, y: fy - s * 0.88 },
        radius: Math.max(3, Math.round(s * 0.14)),
        color,
        thickness,
        symmetry: { ...symmetry },
      };
      const midToe: DrawOperation = {
        id: makeBezierId('paa-toe1', 4),
        kind: 'circle',
        center: { x: fx + s * 0.06, y: fy - s * 0.9 },
        radius: Math.max(2, Math.round(s * 0.1)),
        color,
        thickness,
        symmetry: { ...symmetry },
      };
      const sideToe: DrawOperation = {
        id: makeBezierId('paa-toe2', 5),
        kind: 'circle',
        center: { x: fx + s * 0.34, y: fy - s * 0.78 },
        radius: Math.max(2, Math.round(s * 0.09)),
        color,
        thickness,
        symmetry: { ...symmetry },
      };
      return [leftEdge, rightEdge, heel, bigToe, midToe, sideToe];
    },
  },
  {
    id: 'pyacha-owl',
    name: 'Pyacha Owl',
    bengali: 'পেঁচা (Lakshmi Owl)',
    description: 'Folk Bengali Lakshmi Owl motif with round eyes and arched wings',
    build: (size, rFactor, color, thickness, symmetry, showDeCasteljau) => {
      const c = size / 2;
      const r = size * Math.max(0.2, Math.min(0.42, rFactor));
      const s = size * 0.072;
      const ox = c;
      const oy = c - r;
      const bodyR: DrawOperation = {
        id: makeBezierId('owl-br', 0),
        kind: 'bezier',
        p0: { x: ox, y: oy - s * 0.85 },
        p1: { x: ox + s * 1.05, y: oy - s * 0.55 },
        p2: { x: ox + s * 0.95, y: oy + s * 0.72 },
        p3: { x: ox, y: oy + s * 0.95 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau,
      };
      const bodyL: DrawOperation = {
        id: makeBezierId('owl-bl', 1),
        kind: 'bezier',
        p0: { x: ox, y: oy - s * 0.85 },
        p1: { x: ox - s * 1.05, y: oy - s * 0.55 },
        p2: { x: ox - s * 0.95, y: oy + s * 0.72 },
        p3: { x: ox, y: oy + s * 0.95 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau: false,
      };
      const eyeL: DrawOperation = {
        id: makeBezierId('owl-el', 2),
        kind: 'circle',
        center: { x: ox - s * 0.3, y: oy - s * 0.22 },
        radius: Math.max(4, Math.round(s * 0.22)),
        color,
        thickness,
        symmetry: { ...symmetry },
      };
      const eyeR: DrawOperation = {
        id: makeBezierId('owl-er', 3),
        kind: 'circle',
        center: { x: ox + s * 0.3, y: oy - s * 0.22 },
        radius: Math.max(4, Math.round(s * 0.22)),
        color,
        thickness,
        symmetry: { ...symmetry },
      };
      const beak: DrawOperation = {
        id: makeBezierId('owl-beak', 4),
        kind: 'polygon',
        vertices: [
          { x: ox - s * 0.14, y: oy - s * 0.02 },
          { x: ox + s * 0.14, y: oy - s * 0.02 },
          { x: ox, y: oy + s * 0.22 },
        ],
        color,
        thickness,
        symmetry: { ...symmetry },
      };
      return [bodyR, bodyL, eyeL, eyeR, beak];
    },
  },
  {
    id: 'mangal-ghat',
    name: 'Mangal Ghat',
    bengali: 'মঙ্গল ঘট (Kalash)',
    description: 'Sacred ceremonial Bengali pot crowned with mango leaves & coconut',
    build: (size, rFactor, color, thickness, symmetry, showDeCasteljau) => {
      const c = size / 2;
      const r = size * Math.max(0.2, Math.min(0.42, rFactor));
      const s = size * 0.07;
      const gx = c;
      const gy = c - r;
      const potR: DrawOperation = {
        id: makeBezierId('ghat-r', 0),
        kind: 'bezier',
        p0: { x: gx + s * 0.35, y: gy - s * 0.32 },
        p1: { x: gx + s * 1.1, y: gy + s * 0.02 },
        p2: { x: gx + s * 0.85, y: gy + s * 0.88 },
        p3: { x: gx, y: gy + s * 0.92 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau,
      };
      const potL: DrawOperation = {
        id: makeBezierId('ghat-l', 1),
        kind: 'bezier',
        p0: { x: gx - s * 0.35, y: gy - s * 0.32 },
        p1: { x: gx - s * 1.1, y: gy + s * 0.02 },
        p2: { x: gx - s * 0.85, y: gy + s * 0.88 },
        p3: { x: gx, y: gy + s * 0.92 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau: false,
      };
      const rim: DrawOperation = {
        id: makeBezierId('ghat-rim', 2),
        kind: 'line',
        p0: { x: gx - s * 0.45, y: gy - s * 0.34 },
        p1: { x: gx + s * 0.45, y: gy - s * 0.34 },
        color,
        thickness,
        symmetry: { ...symmetry },
      };
      const coconut: DrawOperation = {
        id: makeBezierId('ghat-coco', 3),
        kind: 'circle',
        center: { x: gx, y: gy - s * 0.56 },
        radius: Math.max(5, Math.round(s * 0.25)),
        color,
        thickness,
        symmetry: { ...symmetry },
      };
      const leafR: DrawOperation = {
        id: makeBezierId('ghat-lr', 4),
        kind: 'bezier',
        p0: { x: gx + s * 0.16, y: gy - s * 0.38 },
        p1: { x: gx + s * 0.72, y: gy - s * 0.88 },
        p2: { x: gx + s * 0.92, y: gy - s * 0.55 },
        p3: { x: gx + s * 0.38, y: gy - s * 0.34 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau: false,
      };
      const leafL: DrawOperation = {
        id: makeBezierId('ghat-ll', 5),
        kind: 'bezier',
        p0: { x: gx - s * 0.16, y: gy - s * 0.38 },
        p1: { x: gx - s * 0.72, y: gy - s * 0.88 },
        p2: { x: gx - s * 0.92, y: gy - s * 0.55 },
        p3: { x: gx - s * 0.38, y: gy - s * 0.34 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau: false,
      };
      return [potR, potL, rim, coconut, leafR, leafL];
    },
  },
  {
    id: 'dhaner-shish',
    name: 'Dhaner Shish',
    bengali: 'ধানের শীষ (Paddy)',
    description: 'Harvest paddy sheaf stem with symmetrical rice grain plumes',
    build: (size, rFactor, color, thickness, symmetry, showDeCasteljau) => {
      const c = size / 2;
      const r0 = size * Math.max(0.14, Math.min(0.32, rFactor * 0.58));
      const r1 = size * Math.max(0.26, Math.min(0.45, rFactor));
      const span = r1 - r0;
      const stem: DrawOperation = {
        id: makeBezierId('dhan-stem', 0),
        kind: 'bezier',
        p0: { x: c, y: c - r0 },
        p1: { x: c + span * 0.18, y: c - r0 - span * 0.35 },
        p2: { x: c - span * 0.14, y: c - r0 - span * 0.72 },
        p3: { x: c, y: c - r1 },
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau,
      };
      const ops: DrawOperation[] = [stem];
      for (let g = 1; g <= 3; g++) {
        const yBase = c - r0 - span * (0.22 * g);
        const w = span * (0.32 - g * 0.04);
        ops.push({
          id: makeBezierId(`dhan-gr-${g}`, g * 2),
          kind: 'bezier',
          p0: { x: c, y: yBase },
          p1: { x: c + w * 0.9, y: yBase - w * 0.25 },
          p2: { x: c + w * 0.75, y: yBase - w * 0.9 },
          p3: { x: c + w * 0.2, y: yBase - w * 0.65 },
          color,
          thickness,
          symmetry: { ...symmetry },
          showDeCasteljau: false,
        });
        ops.push({
          id: makeBezierId(`dhan-gl-${g}`, g * 2 + 1),
          kind: 'bezier',
          p0: { x: c, y: yBase },
          p1: { x: c - w * 0.9, y: yBase - w * 0.25 },
          p2: { x: c - w * 0.75, y: yBase - w * 0.9 },
          p3: { x: c - w * 0.2, y: yBase - w * 0.65 },
          color,
          thickness,
          symmetry: { ...symmetry },
          showDeCasteljau: false,
        });
      }
      return ops;
    },
  },
];
