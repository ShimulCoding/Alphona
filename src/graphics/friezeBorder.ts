import type { PixelSurface } from './rasterizer';
import { hexToRgba, type RGBA } from './types';

export type FriezeGroupId =
  | 'p1'
  | 'p11g'
  | 'p11m'
  | 'p1m1'
  | 'p2'
  | 'p2mg'
  | 'p2mm';

export interface FriezeGroupSpec {
  id: FriezeGroupId;
  name: string;
  notation: string;
  symmetryDesc: string;
}

export const FRIEZE_GROUPS: FriezeGroupSpec[] = [
  {
    id: 'p1',
    name: 'Hop (Translation)',
    notation: 'p1',
    symmetryDesc: 'Pure horizontal repeat along the border',
  },
  {
    id: 'p11g',
    name: 'Step (Glide Reflection)',
    notation: 'p11g',
    symmetryDesc: 'Alternating vertical flip on half-tile glide',
  },
  {
    id: 'p11m',
    name: 'Jump (Horizontal Mirror)',
    notation: 'p11m',
    symmetryDesc: 'Top-to-bottom reflection across border centerline',
  },
  {
    id: 'p1m1',
    name: 'Sidle (Vertical Mirror)',
    notation: 'p1m1',
    symmetryDesc: 'Left-to-right bilateral mirror inside each tile',
  },
  {
    id: 'p2',
    name: 'Spinning Hop (180°)',
    notation: 'p2',
    symmetryDesc: 'Alternating 180° half-turn rotation per repeat',
  },
  {
    id: 'p2mg',
    name: 'Spinning Sidle',
    notation: 'p2mg',
    symmetryDesc: 'Vertical mirror combined with alternating glide',
  },
  {
    id: 'p2mm',
    name: 'Spinning Jump (Dihedral)',
    notation: 'p2mm',
    symmetryDesc: 'Full horizontal + vertical mirror + 180° symmetry',
  },
];

export type BorderMockupContext = 'strip' | 'corner-90' | 'saree-pallu';

export interface FriezeBorderOptions {
  group: FriezeGroupId;
  innerRadiusFrac: number; // [0.12 .. 0.65] of circular Alpona radius
  outerRadiusFrac: number; // [0.45 .. 0.98] of circular Alpona radius
  repeatCount: number; // [2 .. 8]
  trimLines: boolean; // Add traditional double saree-paar border rails
  trimColorHex: string;
  fabricHex: string;
  sectors: number; // Used to align one exact sector period when unwrapping
}

export interface FriezeBorderResult {
  tile: PixelSurface;
  strip: PixelSurface;
  corner90: PixelSurface;
  group: FriezeGroupId;
  repeatCount: number;
}

function sampleBilinear(
  src: PixelSurface,
  fx: number,
  fy: number
): RGBA {
  const x = Math.max(0, Math.min(src.width - 1.001, fx));
  const y = Math.max(0, Math.min(src.height - 1.001, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(src.width - 1, x0 + 1);
  const y1 = Math.min(src.height - 1, y0 + 1);
  const dx = x - x0;
  const dy = y - y0;

  const o00 = (y0 * src.width + x0) * 4;
  const o10 = (y0 * src.width + x1) * 4;
  const o01 = (y1 * src.width + x0) * 4;
  const o11 = (y1 * src.width + x1) * 4;
  const d = src.data;

  const w00 = (1 - dx) * (1 - dy);
  const w10 = dx * (1 - dy);
  const w01 = (1 - dx) * dy;
  const w11 = dx * dy;

  return {
    r: Math.round(d[o00] * w00 + d[o10] * w10 + d[o01] * w01 + d[o11] * w11),
    g: Math.round(
      d[o00 + 1] * w00 + d[o10 + 1] * w10 + d[o01 + 1] * w01 + d[o11 + 1] * w11
    ),
    b: Math.round(
      d[o00 + 2] * w00 + d[o10 + 2] * w10 + d[o01 + 2] * w01 + d[o11 + 2] * w11
    ),
    a: 255,
  };
}

/**
 * Polar-to-Cartesian Ring Unwrapper (CLO-4 / CLO-6):
 * Unwraps an annular sector of a circular Alpona into a seamless rectangular tile.
 *   u in [0, 1] -> angle theta across `spanSectors` of the circle
 *   v in [0, 1] -> radius r from outerRadiusFrac down to innerRadiusFrac
 */
export function unwrapAlponaRingToTile(
  alpona: PixelSurface,
  tileW: number,
  tileH: number,
  innerRadiusFrac: number,
  outerRadiusFrac: number,
  sectors: number
): PixelSurface {
  const w = Math.max(32, Math.round(tileW));
  const h = Math.max(32, Math.round(tileH));
  const data = new Uint8ClampedArray(w * h * 4);

  const cx = alpona.width / 2;
  const cy = alpona.height / 2;
  const maxR = Math.min(cx, cy) * 0.96;
  const rIn = Math.max(0.05, Math.min(0.82, innerRadiusFrac)) * maxR;
  const rOut = Math.max(rIn + 12, Math.min(0.99, outerRadiusFrac) * maxR);

  // One full sector wedge (or 2 wedges for higher-order motifs) gives an exact periodic repeat
  const safeSectors = Math.max(4, Math.min(16, Math.round(sectors)));
  const sectorAngle = (2 * Math.PI) / safeSectors;

  for (let y = 0; y < h; y++) {
    const v = h <= 1 ? 0.5 : y / (h - 1);
    const r = rOut - v * (rOut - rIn);
    for (let x = 0; x < w; x++) {
      const u = w <= 1 ? 0 : x / w;
      const theta = -Math.PI / 2 - sectorAngle * 0.5 + u * sectorAngle;
      const sx = cx + Math.cos(theta) * r;
      const sy = cy + Math.sin(theta) * r;
      const px = sampleBilinear(alpona, sx, sy);
      const off = (y * w + x) * 4;
      data[off] = px.r;
      data[off + 1] = px.g;
      data[off + 2] = px.b;
      data[off + 3] = 255;
    }
  }

  return { width: w, height: h, data };
}

/**
 * Applies the selected mathematical 1D Frieze Group symmetry transformation
 * to normalize any tile coordinate (u, v) in [0, 1]^2 and repeat index `k`.
 */
export function mapFriezeCoordinates(
  group: FriezeGroupId,
  repeatIndex: number,
  u: number,
  v: number
): { tu: number; tv: number } {
  const odd = (repeatIndex & 1) === 1;
  switch (group) {
    case 'p1':
      return { tu: u, tv: v };
    case 'p11g':
      return { tu: u, tv: odd ? 1 - v : v };
    case 'p11m':
      return { tu: u, tv: v < 0.5 ? v * 2 : (1 - v) * 2 };
    case 'p1m1':
      return { tu: u < 0.5 ? u * 2 : (1 - u) * 2, tv: v };
    case 'p2':
      return odd ? { tu: 1 - u, tv: 1 - v } : { tu: u, tv: v };
    case 'p2mg': {
      const mirroredU = u < 0.5 ? u * 2 : (1 - u) * 2;
      return { tu: mirroredU, tv: odd ? 1 - v : v };
    }
    case 'p2mm':
      return {
        tu: u < 0.5 ? u * 2 : (1 - u) * 2,
        tv: v < 0.5 ? v * 2 : (1 - v) * 2,
      };
  }
}

/**
 * Renders a seamless repeating Saree Paar / Street Alpona Runner strip
 * using the chosen mathematical Frieze Group + optional traditional double border rails.
 */
export function renderFriezeStrip(
  tile: PixelSurface,
  group: FriezeGroupId,
  repeatCount: number,
  trimLines: boolean,
  trimColorHex: string
): PixelSurface {
  const reps = Math.max(2, Math.min(10, Math.round(repeatCount)));
  const stripW = tile.width * reps;
  const railPad = trimLines ? Math.max(10, Math.round(tile.height * 0.14)) : 0;
  const stripH = tile.height + railPad * 2;
  const data = new Uint8ClampedArray(stripW * stripH * 4);
  const trimRgb = hexToRgba(trimColorHex);

  // Estimate border background from top-left pixel of tile
  const bgR = tile.data[0];
  const bgG = tile.data[1];
  const bgB = tile.data[2];

  // Fill background
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bgR;
    data[i + 1] = bgG;
    data[i + 2] = bgB;
    data[i + 3] = 255;
  }

  for (let k = 0; k < reps; k++) {
    const xBase = k * tile.width;
    for (let y = 0; y < tile.height; y++) {
      const v = tile.height <= 1 ? 0.5 : y / (tile.height - 1);
      for (let x = 0; x < tile.width; x++) {
        const u = tile.width <= 1 ? 0 : x / (tile.width - 1);
        const mapped = mapFriezeCoordinates(group, k, u, v);
        const px = sampleBilinear(
          tile,
          mapped.tu * (tile.width - 1),
          mapped.tv * (tile.height - 1)
        );
        const off = ((y + railPad) * stripW + (xBase + x)) * 4;
        data[off] = px.r;
        data[off + 1] = px.g;
        data[off + 2] = px.b;
        data[off + 3] = 255;
      }
    }
  }

  // Traditional Bengali double paar trim lines + delicate bead dots
  if (trimLines && railPad >= 6) {
    const drawHLine = (yRow: number, thickness: number) => {
      for (let t = 0; t < thickness; t++) {
        const yy = Math.max(0, Math.min(stripH - 1, yRow + t));
        for (let x = 0; x < stripW; x++) {
          const off = (yy * stripW + x) * 4;
          data[off] = trimRgb.r;
          data[off + 1] = trimRgb.g;
          data[off + 2] = trimRgb.b;
        }
      }
    };
    const thick = Math.max(2, Math.round(railPad * 0.2));
    drawHLine(Math.round(railPad * 0.22), thick);
    drawHLine(Math.round(railPad * 0.65), Math.max(1, Math.round(thick * 0.65)));
    drawHLine(stripH - railPad + Math.round(railPad * 0.22), Math.max(1, Math.round(thick * 0.65)));
    drawHLine(stripH - Math.round(railPad * 0.22) - thick, thick);
  }

  return { width: stripW, height: stripH, data };
}

/**
 * Generates an exact 90-degree mitered L-Corner (Saree Anchal / Doorframe / Street Corner)
 * by folding the frieze strip seamlessly across the 45-degree diagonal miter line (x == y).
 */
export function renderMiteredCorner90(
  strip: PixelSurface,
  outSize: number,
  fabricHex: string
): PixelSurface {
  const size = Math.max(160, Math.round(outSize));
  const data = new Uint8ClampedArray(size * size * 4);
  const fabric = hexToRgba(fabricHex);

  // Fill saree fabric / courtyard interior with subtle woven texture
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const weave = ((x + y) & 3) === 0 ? 5 : ((x ^ y) & 7) === 0 ? -4 : 0;
      const off = (y * size + x) * 4;
      data[off] = Math.max(0, Math.min(255, fabric.r + weave));
      data[off + 1] = Math.max(0, Math.min(255, fabric.g + weave));
      data[off + 2] = Math.max(0, Math.min(255, fabric.b + weave));
      data[off + 3] = 255;
    }
  }

  const bandThickness = Math.max(48, Math.round(size * 0.3));
  const margin = Math.round(size * 0.06);
  const innerLimit = size - margin;

  for (let y = margin; y < innerLimit; y++) {
    for (let x = margin; x < innerLimit; x++) {
      const dx = x - margin;
      const dy = y - margin;

      // Top horizontal paar OR left vertical paar, cleanly mitered along dx == dy!
      const inTop = dy < bandThickness && dx >= dy;
      const inLeft = dx < bandThickness && dy > dx;
      if (!inTop && !inLeft) continue;

      let stripU: number;
      let stripV: number;
      if (inTop) {
        stripU = (dx / Math.max(1, innerLimit - margin)) * (strip.width - 1);
        stripV = (dy / Math.max(1, bandThickness - 1)) * (strip.height - 1);
      } else {
        // Mirror across 45° diagonal so motif corners lock seamlessly
        stripU = (dy / Math.max(1, innerLimit - margin)) * (strip.width - 1);
        stripV = (dx / Math.max(1, bandThickness - 1)) * (strip.height - 1);
      }

      const px = sampleBilinear(strip, stripU, stripV);
      const off = (y * size + x) * 4;
      data[off] = px.r;
      data[off + 1] = px.g;
      data[off + 2] = px.b;
      data[off + 3] = 255;
    }
  }

  return { width: size, height: size, data };
}

/**
 * End-to-end Frieze Border Studio generator:
 * Unwraps the live Alpona ring -> applies chosen 1D Frieze Group -> builds strip & 90° corner.
 */
export function buildFriezeBorderStudio(
  alpona: PixelSurface,
  options: FriezeBorderOptions,
  tileW = 140,
  tileH = 112,
  cornerSize = 420
): FriezeBorderResult {
  const tile = unwrapAlponaRingToTile(
    alpona,
    tileW,
    tileH,
    options.innerRadiusFrac,
    options.outerRadiusFrac,
    options.sectors
  );
  const strip = renderFriezeStrip(
    tile,
    options.group,
    options.repeatCount,
    options.trimLines,
    options.trimColorHex
  );
  const corner90 = renderMiteredCorner90(strip, cornerSize, options.fabricHex);
  return {
    tile,
    strip,
    corner90,
    group: options.group,
    repeatCount: options.repeatCount,
  };
}
