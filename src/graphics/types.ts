export type DrawingTool =
  | 'freehand'
  | 'line'
  | 'circle'
  | 'polygon'
  | 'bezier'
  | 'fill'
  | 'eraser'
  | 'edit';
export type LineAlgorithm = 'bresenham' | 'dda';
export type ClipAlgorithm = 'cohen-sutherland' | 'liang-barsky';
export type PolygonClipAlgorithm = 'sutherland-hodgman' | 'weiler-atherton';
export type PolygonShapeMode = 'diamond' | 'concave-star';

export interface Point2D {
  x: number;
  y: number;
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ClipBounds {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface ClippingWindowConfig {
  enabled: boolean;
  inset: number; // px inset from each canvas border (0..220)
  algorithm: ClipAlgorithm;
  polygonAlgorithm?: PolygonClipAlgorithm;
}

export interface Transform2DConfig {
  translateX: number; // -180..180 px
  translateY: number; // -180..180 px
  scaleX: number; // 0.4..1.8
  scaleY: number; // 0.4..1.8
  rotateDeg: number; // -180..180 deg
  shearX: number; // -0.6..0.6
  shearY: number; // -0.6..0.6
  flipX?: boolean; // Horizontal Mirror (left <-> right, x' = 2*cx - x)
  flipY?: boolean; // Vertical Mirror (top <-> bottom, y' = 2*cy - y)
}

export const DEFAULT_TRANSFORM_2D: Transform2DConfig = {
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  rotateDeg: 0,
  shearX: 0,
  shearY: 0,
  flipX: false,
  flipY: false,
};

export interface SymmetryConfig {
  sectors: number; // 3..16 (standard presets: 4, 6, 8, 12)
  reflect: boolean; // true = Dihedral D_n (2n copies), false = Cyclic C_n (n copies)
}

export type CanvasSurfaceId = 'courtyard' | 'terracotta' | 'indigo' | 'paper';

export interface CanvasSurface {
  id: CanvasSurfaceId;
  name: string;
  hex: string;
  guideHex: string;
  accentHex: string;
  isDark: boolean;
}

export type DrawOperation =
  | {
      id: string;
      kind: 'line';
      p0: Point2D;
      p1: Point2D;
      color: string;
      thickness: number;
      symmetry: SymmetryConfig;
      hidden?: boolean;
      locked?: boolean;
      opacity?: number;
      group?: string;
    }
  | {
      id: string;
      kind: 'circle';
      center: Point2D;
      radius: number;
      color: string;
      thickness: number;
      symmetry: SymmetryConfig;
      hidden?: boolean;
      locked?: boolean;
      opacity?: number;
      group?: string;
    }
  | {
      id: string;
      kind: 'polygon';
      vertices: Point2D[];
      color: string;
      thickness: number;
      symmetry: SymmetryConfig;
      hidden?: boolean;
      locked?: boolean;
      opacity?: number;
      group?: string;
    }
  | {
      id: string;
      kind: 'freehand';
      points: Point2D[];
      pressures?: number[];
      color: string;
      thickness: number;
      symmetry: SymmetryConfig;
      tapered?: boolean;
      hidden?: boolean;
      locked?: boolean;
      opacity?: number;
      group?: string;
    }
  | {
      id: string;
      kind: 'bezier';
      p0: Point2D;
      p1: Point2D;
      p2: Point2D;
      p3: Point2D;
      color: string;
      thickness: number;
      symmetry: SymmetryConfig;
      showDeCasteljau?: boolean;
      hidden?: boolean;
      locked?: boolean;
      opacity?: number;
      group?: string;
    }
  | {
      id: string;
      kind: 'fill';
      seed: Point2D;
      color: string;
      symmetric: boolean;
      symmetry: SymmetryConfig;
      hidden?: boolean;
      locked?: boolean;
      opacity?: number;
      group?: string;
    };

export interface PipelineMetrics {
  operationsCount: number;
  bresenhamLinePixels: number;
  ddaLinePixels: number;
  midpointCirclePixels: number;
  seedFillPixels: number;
  segmentsSubmitted: number;
  segmentsClipped: number;
  segmentsRejected: number;
  polygonsClipped: number;
  lastRenderMs: number;
}

export interface PaletteSwatch {
  name: string;
  bengali: string;
  hex: string;
}

export const ALPONA_PALETTE: PaletteSwatch[] = [
  { name: 'Rice Paste', bengali: 'Chaler Guro', hex: '#FAF8F2' },
  { name: 'Sindoor Red', bengali: 'Sindoor', hex: '#DC2626' },
  { name: 'Turmeric Gold', bengali: 'Halud', hex: '#F59E0B' },
  { name: 'Alta Rose', bengali: 'Alta', hex: '#E11D48' },
  { name: 'Marigold', bengali: 'Genda', hex: '#EA580C' },
  { name: 'Pata Green', bengali: 'Pata', hex: '#16A34A' },
  { name: 'Neel Indigo', bengali: 'Neel', hex: '#2563EB' },
  { name: 'Kajal Ink', bengali: 'Kajal', hex: '#18181B' },
];

export const CANVAS_SURFACES: CanvasSurface[] = [
  {
    id: 'courtyard',
    name: 'Courtyard Slate',
    hex: '#16161B',
    guideHex: 'rgba(250, 248, 242, 0.22)',
    accentHex: '#F59E0B',
    isDark: true,
  },
  {
    id: 'terracotta',
    name: 'Red Clay',
    hex: '#4A1D1A',
    guideHex: 'rgba(250, 248, 242, 0.25)',
    accentHex: '#FDE68A',
    isDark: true,
  },
  {
    id: 'indigo',
    name: 'Indigo Night',
    hex: '#111827',
    guideHex: 'rgba(226, 232, 240, 0.22)',
    accentHex: '#F59E0B',
    isDark: true,
  },
  {
    id: 'paper',
    name: 'Archival Paper',
    hex: '#FAFAF7',
    guideHex: 'rgba(24, 24, 27, 0.16)',
    accentHex: '#B91C1C',
    isDark: false,
  },
];

export function hexToRgba(hex: string): RGBA {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
    a: 255,
  };
}

export function hexToRgbaWithOpacity(hex: string, opacity?: number): RGBA {
  const base = hexToRgba(hex);
  const clamped =
    typeof opacity === 'number' && Number.isFinite(opacity)
      ? Math.max(0.1, Math.min(1, opacity))
      : 1;
  return { ...base, a: Math.round(clamped * 255) };
}

export function rgbaEqual(
  data: Uint8ClampedArray,
  offset: number,
  target: RGBA
): boolean {
  return (
    data[offset] === target.r &&
    data[offset + 1] === target.g &&
    data[offset + 2] === target.b &&
    data[offset + 3] === target.a
  );
}
