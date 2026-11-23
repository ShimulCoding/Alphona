import type { CanvasSurfaceId, DrawOperation, Point2D, SymmetryConfig } from './types';

export interface AlponaMotifPreset {
  id: string;
  name: string;
  bengaliTitle: string;
  description: string;
  defaultSurface: CanvasSurfaceId;
  defaultSymmetry: SymmetryConfig;
  buildOperations: (canvasSize: number) => DrawOperation[];
}

function polarToCanvas(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): Point2D {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + Math.cos(rad) * radius,
    y: cy + Math.sin(rad) * radius,
  };
}

function sampleQuadraticCurve(
  p0: Point2D,
  ctrl: Point2D,
  p2: Point2D,
  steps: number
): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    pts.push({
      x: inv * inv * p0.x + 2 * inv * t * ctrl.x + t * t * p2.x,
      y: inv * inv * p0.y + 2 * inv * t * ctrl.y + t * t * p2.y,
    });
  }
  return pts;
}

export const ALPONA_MOTIFS: AlponaMotifPreset[] = [
  {
    id: 'padma-lotus',
    name: 'Padma Lotus',
    bengaliTitle: 'Shapla & Padma',
    description: 'Traditional 8-fold Bengal lotus with layered pointed petals, seed-filled crimson inner crown, and chaler-guro bead ring.',
    defaultSurface: 'courtyard',
    defaultSymmetry: { sectors: 8, reflect: true },
    buildOperations: (size: number) => {
      const c = size / 2;
      const s = size / 720;
      const sym: SymmetryConfig = { sectors: 8, reflect: true };
      const sym1: SymmetryConfig = { sectors: 1, reflect: false };

      // Inner pointed petal half-curve (reflected across 0° to close the petal cleanly)
      const innerPetal = sampleQuadraticCurve(
        polarToCanvas(c, c, 44 * s, 22.5),
        polarToCanvas(c, c, 108 * s, 18),
        polarToCanvas(c, c, 152 * s, 0),
        14
      );

      // Outer sweeping lotus petal half-curve
      const outerPetal = sampleQuadraticCurve(
        polarToCanvas(c, c, 148 * s, 22.5),
        polarToCanvas(c, c, 232 * s, 19),
        polarToCanvas(c, c, 286 * s, 0),
        18
      );

      // Decorative double-line inner rib inside outer petal
      const innerRib = sampleQuadraticCurve(
        polarToCanvas(c, c, 162 * s, 15),
        polarToCanvas(c, c, 212 * s, 12),
        polarToCanvas(c, c, 256 * s, 0),
        12
      );

      // Scalloped border arch between outer petal tips
      const scallopArch = sampleQuadraticCurve(
        polarToCanvas(c, c, 294 * s, 0),
        polarToCanvas(c, c, 326 * s, 11.25),
        polarToCanvas(c, c, 294 * s, 22.5),
        12
      );

      return [
        // Central concentric circles (Bresenham circle)
        {
          id: 'lotus-core-ring-1',
          kind: 'circle',
          center: { x: c, y: c },
          radius: 44 * s,
          color: '#FAF8F2',
          thickness: 3,
          symmetry: sym1,
          group: 'Core',
        },
        {
          id: 'lotus-core-ring-2',
          kind: 'circle',
          center: { x: c, y: c },
          radius: 22 * s,
          color: '#F59E0B',
          thickness: 2,
          symmetry: sym1,
          group: 'Core',
        },
        // Fill central core
        {
          id: 'lotus-core-fill',
          kind: 'fill',
          seed: { x: c, y: c },
          color: '#DC2626',
          symmetric: false,
          symmetry: sym1,
          group: 'Core',
        },
        // Inner lotus petals
        {
          id: 'lotus-inner-petal',
          kind: 'freehand',
          points: innerPetal,
          color: '#FAF8F2',
          thickness: 3,
          symmetry: sym,
          group: 'Petals',
        },
        // Seed-fill inner petals with Sindoor Crimson
        {
          id: 'lotus-inner-fill',
          kind: 'fill',
          seed: polarToCanvas(c, c, 92 * s, 3),
          color: '#B91C1C',
          symmetric: true,
          symmetry: sym,
          group: 'Petals',
        },
        // Middle separating circle
        {
          id: 'lotus-mid-ring',
          kind: 'circle',
          center: { x: c, y: c },
          radius: 152 * s,
          color: '#F59E0B',
          thickness: 2,
          symmetry: sym1,
          group: 'Core',
        },
        // Outer lotus petals
        {
          id: 'lotus-outer-petal',
          kind: 'freehand',
          points: outerPetal,
          color: '#FAF8F2',
          thickness: 3,
          symmetry: sym,
          group: 'Petals',
        },
        // Inner petal decorative rib
        {
          id: 'lotus-outer-rib',
          kind: 'freehand',
          points: innerRib,
          color: '#F59E0B',
          thickness: 2,
          symmetry: sym,
          group: 'Petals',
        },
        // Radial accent line inside each outer petal
        {
          id: 'lotus-petal-spine',
          kind: 'line',
          p0: polarToCanvas(c, c, 166 * s, 0),
          p1: polarToCanvas(c, c, 238 * s, 0),
          color: '#FAF8F2',
          thickness: 2,
          symmetry: sym,
          group: 'Petals',
        },
        // Decorative rice-paste dots between petals
        {
          id: 'lotus-inter-dot',
          kind: 'circle',
          center: polarToCanvas(c, c, 224 * s, 22.5),
          radius: 9 * s,
          color: '#FAF8F2',
          thickness: 2,
          symmetry: sym,
          group: 'Border',
        },
        {
          id: 'lotus-inter-dot-fill',
          kind: 'fill',
          seed: polarToCanvas(c, c, 224 * s, 22.5),
          color: '#F59E0B',
          symmetric: true,
          symmetry: sym,
          group: 'Border',
        },
        // Outer scalloped ring
        {
          id: 'lotus-scallop-arch',
          kind: 'freehand',
          points: scallopArch,
          color: '#FAF8F2',
          thickness: 2,
          symmetry: sym,
          group: 'Border',
        },
        // Outer tip dots
        {
          id: 'lotus-tip-dot',
          kind: 'circle',
          center: polarToCanvas(c, c, 316 * s, 0),
          radius: 6 * s,
          color: '#FAF8F2',
          thickness: 2,
          symmetry: sym,
          group: 'Border',
        },
      ];
    },
  },
  {
    id: 'boishakhi-sun',
    name: 'Boishakhi Sun',
    bengaliTitle: 'Pohela Boishakh',
    description: 'Radiant 12-fold Bengali New Year sunburst with sharp diamond rays, turmeric medallions, and vermilion courtyard ground.',
    defaultSurface: 'terracotta',
    defaultSymmetry: { sectors: 12, reflect: true },
    buildOperations: (size: number) => {
      const c = size / 2;
      const s = size / 720;
      const sym: SymmetryConfig = { sectors: 12, reflect: true };
      const sym1: SymmetryConfig = { sectors: 1, reflect: false };

      const flareCurve = sampleQuadraticCurve(
        polarToCanvas(c, c, 128 * s, 15),
        polarToCanvas(c, c, 215 * s, 10),
        polarToCanvas(c, c, 296 * s, 0),
        14
      );

      return [
        {
          id: 'sun-inner-ring',
          kind: 'circle',
          center: { x: c, y: c },
          radius: 64 * s,
          color: '#FAF8F2',
          thickness: 3,
          symmetry: sym1,
          group: 'Core',
        },
        {
          id: 'sun-core-fill',
          kind: 'fill',
          seed: { x: c, y: c },
          color: '#F59E0B',
          symmetric: false,
          symmetry: sym1,
          group: 'Core',
        },
        {
          id: 'sun-mid-ring',
          kind: 'circle',
          center: { x: c, y: c },
          radius: 126 * s,
          color: '#FAF8F2',
          thickness: 3,
          symmetry: sym1,
          group: 'Core',
        },
        // Zig-zag geometric inner crown
        {
          id: 'sun-crown-line',
          kind: 'line',
          p0: polarToCanvas(c, c, 66 * s, 0),
          p1: polarToCanvas(c, c, 124 * s, 15),
          color: '#FAF8F2',
          thickness: 2,
          symmetry: sym,
          group: 'Core',
        },
        // Sunburst outer rays
        {
          id: 'sun-ray-curve',
          kind: 'freehand',
          points: flareCurve,
          color: '#FAF8F2',
          thickness: 3,
          symmetry: sym,
          group: 'Petals',
        },
        // Fill alternating sun rays in Halud Gold
        {
          id: 'sun-ray-fill',
          kind: 'fill',
          seed: polarToCanvas(c, c, 185 * s, 2),
          color: '#F59E0B',
          symmetric: true,
          symmetry: sym,
          group: 'Petals',
        },
        // Radial spokes
        {
          id: 'sun-spoke',
          kind: 'line',
          p0: polarToCanvas(c, c, 136 * s, 0),
          p1: polarToCanvas(c, c, 260 * s, 0),
          color: '#FAF8F2',
          thickness: 2,
          symmetry: sym,
          group: 'Petals',
        },
        // Outer framing circles
        {
          id: 'sun-outer-ring-1',
          kind: 'circle',
          center: { x: c, y: c },
          radius: 308 * s,
          color: '#FAF8F2',
          thickness: 3,
          symmetry: sym1,
          group: 'Border',
        },
        {
          id: 'sun-outer-ring-2',
          kind: 'circle',
          center: { x: c, y: c },
          radius: 326 * s,
          color: '#F59E0B',
          thickness: 2,
          symmetry: sym1,
          group: 'Border',
        },
        // Festive dots on outer band
        {
          id: 'sun-outer-dot',
          kind: 'circle',
          center: polarToCanvas(c, c, 317 * s, 15),
          radius: 5 * s,
          color: '#FAF8F2',
          thickness: 2,
          symmetry: sym,
          group: 'Border',
        },
      ];
    },
  },
  {
    id: 'kalka-rosette',
    name: 'Kalka Rosette',
    bengaliTitle: 'Shankha & Kalka',
    description: 'Flowing 6-fold cyclic spiral rosette inspired by traditional Bengali Kalka & conch motifs — demonstrates pure rotational C₆ symmetry.',
    defaultSurface: 'indigo',
    defaultSymmetry: { sectors: 6, reflect: false },
    buildOperations: (size: number) => {
      const c = size / 2;
      const s = size / 720;
      const sym: SymmetryConfig = { sectors: 6, reflect: false };
      const sym1: SymmetryConfig = { sectors: 1, reflect: false };

      const kalkaSweepOuter = sampleQuadraticCurve(
        polarToCanvas(c, c, 54 * s, 0),
        polarToCanvas(c, c, 210 * s, 68),
        polarToCanvas(c, c, 285 * s, 18),
        22
      );

      const kalkaSweepInner = sampleQuadraticCurve(
        polarToCanvas(c, c, 54 * s, 0),
        polarToCanvas(c, c, 155 * s, -22),
        polarToCanvas(c, c, 285 * s, 18),
        22
      );

      const innerCurl = sampleQuadraticCurve(
        polarToCanvas(c, c, 108 * s, 18),
        polarToCanvas(c, c, 178 * s, 44),
        polarToCanvas(c, c, 230 * s, 20),
        14
      );

      return [
        {
          id: 'kalka-center-ring',
          kind: 'circle',
          center: { x: c, y: c },
          radius: 54 * s,
          color: '#FAF8F2',
          thickness: 3,
          symmetry: sym1,
          group: 'Core',
        },
        {
          id: 'kalka-center-fill',
          kind: 'fill',
          seed: { x: c, y: c },
          color: '#E11D48',
          symmetric: false,
          symmetry: sym1,
          group: 'Core',
        },
        {
          id: 'kalka-outer-sweep',
          kind: 'freehand',
          points: kalkaSweepOuter,
          color: '#FAF8F2',
          thickness: 3,
          symmetry: sym,
          group: 'Petals',
        },
        {
          id: 'kalka-inner-sweep',
          kind: 'freehand',
          points: kalkaSweepInner,
          color: '#FAF8F2',
          thickness: 3,
          symmetry: sym,
          group: 'Petals',
        },
        {
          id: 'kalka-curl',
          kind: 'freehand',
          points: innerCurl,
          color: '#F59E0B',
          thickness: 2,
          symmetry: sym,
          group: 'Petals',
        },
        {
          id: 'kalka-pearl',
          kind: 'circle',
          center: polarToCanvas(c, c, 250 * s, 46),
          radius: 16 * s,
          color: '#F59E0B',
          thickness: 2,
          symmetry: sym,
          group: 'Border',
        },
        {
          id: 'kalka-pearl-fill',
          kind: 'fill',
          seed: polarToCanvas(c, c, 250 * s, 46),
          color: '#DC2626',
          symmetric: true,
          symmetry: sym,
          group: 'Border',
        },
        {
          id: 'kalka-outer-ring',
          kind: 'circle',
          center: { x: c, y: c },
          radius: 314 * s,
          color: '#FAF8F2',
          thickness: 3,
          symmetry: sym1,
          group: 'Border',
        },
      ];
    },
  },
  {
    id: 'courtyard-chowk',
    name: 'Courtyard Chowk',
    bengaliTitle: 'Alpona Chowk',
    description: 'Classical 4-fold threshold square & diamond lattice painted at Bengal home entrances for auspicious welcome.',
    defaultSurface: 'paper',
    defaultSymmetry: { sectors: 4, reflect: true },
    buildOperations: (size: number) => {
      const c = size / 2;
      const s = size / 720;
      const sym: SymmetryConfig = { sectors: 4, reflect: true };
      const sym1: SymmetryConfig = { sectors: 1, reflect: false };

      const cornerPetal = sampleQuadraticCurve(
        { x: c + 120 * s, y: c + 120 * s },
        { x: c + 215 * s, y: c + 150 * s },
        { x: c + 265 * s, y: c + 265 * s },
        14
      );

      return [
        // Outer square boundary (4-fold rotated + reflected)
        {
          id: 'chowk-outer-sq',
          kind: 'line',
          p0: { x: c + 292 * s, y: c },
          p1: { x: c + 292 * s, y: c + 292 * s },
          color: '#B91C1C',
          thickness: 3,
          symmetry: sym,
          group: 'Border',
        },
        {
          id: 'chowk-inner-sq',
          kind: 'line',
          p0: { x: c + 268 * s, y: c },
          p1: { x: c + 268 * s, y: c + 268 * s },
          color: '#18181B',
          thickness: 2,
          symmetry: sym,
          group: 'Border',
        },
        // Central diamond
        {
          id: 'chowk-diamond',
          kind: 'line',
          p0: { x: c + 240 * s, y: c },
          p1: { x: c, y: c + 240 * s },
          color: '#B91C1C',
          thickness: 3,
          symmetry: sym,
          group: 'Petals',
        },
        // Inner square
        {
          id: 'chowk-center-sq',
          kind: 'line',
          p0: { x: c + 120 * s, y: c },
          p1: { x: c + 120 * s, y: c + 120 * s },
          color: '#18181B',
          thickness: 2,
          symmetry: sym,
          group: 'Core',
        },
        // Center medallion
        {
          id: 'chowk-center-circle',
          kind: 'circle',
          center: { x: c, y: c },
          radius: 76 * s,
          color: '#B91C1C',
          thickness: 3,
          symmetry: sym1,
          group: 'Core',
        },
        {
          id: 'chowk-center-fill',
          kind: 'fill',
          seed: { x: c, y: c },
          color: '#F59E0B',
          symmetric: false,
          symmetry: sym1,
          group: 'Core',
        },
        // Corner floral leaf
        {
          id: 'chowk-corner-petal',
          kind: 'freehand',
          points: cornerPetal,
          color: '#B91C1C',
          thickness: 3,
          symmetry: sym,
          group: 'Petals',
        },
        // Cardinal lotus buds
        {
          id: 'chowk-cardinal-bud',
          kind: 'circle',
          center: { x: c + 185 * s, y: c },
          radius: 26 * s,
          color: '#18181B',
          thickness: 2,
          symmetry: sym,
          group: 'Petals',
        },
        {
          id: 'chowk-cardinal-fill',
          kind: 'fill',
          seed: { x: c + 185 * s, y: c },
          color: '#DC2626',
          symmetric: true,
          symmetry: sym,
          group: 'Petals',
        },
      ];
    },
  },
];
