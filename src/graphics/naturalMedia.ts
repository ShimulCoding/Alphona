import type { PixelSurface } from './rasterizer';
import { hexToRgba } from './types';

export type NaturalSubstrateId =
  | 'mati-mud'
  | 'ekushey-asphalt'
  | 'tant-cotton'
  | 'patachitra-paper';

export interface NaturalSubstrateSpec {
  id: NaturalSubstrateId;
  name: string;
  bengali: string;
  desc: string;
}

export const NATURAL_SUBSTRATES: NaturalSubstrateSpec[] = [
  {
    id: 'mati-mud',
    name: 'Red Mati Mud Courtyard',
    bengali: 'লাল মাটির উঠোন',
    desc: 'Hand-plastered terracotta clay sweep marks with wet rice-paste relief',
  },
  {
    id: 'ekushey-asphalt',
    name: 'Ekushey Street Asphalt',
    bengali: 'একুশে আলপনা পিচ',
    desc: 'Weathered urban street bitumen grain with chalk-powder scatter',
  },
  {
    id: 'tant-cotton',
    name: 'Handloom Tant Cotton',
    bengali: 'তাঁতের কাপড়',
    desc: 'Perpendicular warp-and-weft handloom weave with dyed pigment bleed',
  },
  {
    id: 'patachitra-paper',
    name: 'Handmade Patachitra',
    bengali: 'পটচিত্র কাগজ',
    desc: 'Warm deckled fiber scroll paper with mineral pigment grain',
  },
];

export interface NaturalMediaOptions {
  substrate: NaturalSubstrateId;
  brushGrain: number; // [0..1] dry-brush bristle streak breakup
  pasteImpasto: number; // [0..1] wet rice-paste edge ridge highlight
  speckleIntensity: number; // [0..1] chalk/rice-powder micro-speckle around strokes
  warmth: number; // [0..1] ambient courtyard daylight warmth
}

export const DEFAULT_NATURAL_MEDIA_OPTIONS: NaturalMediaOptions = {
  substrate: 'mati-mud',
  brushGrain: 0.58,
  pasteImpasto: 0.65,
  speckleIntensity: 0.45,
  warmth: 0.5,
};

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * Deterministic 2D integer hash noise in [0, 1] (matches C++11 bit-for-bit).
 */
export function hash2D(ix: number, iy: number): number {
  let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177) | 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/**
 * 3-octave Fractional Brownian Motion (fBm) procedural texture in [0, 1].
 */
export function fbm2D(x: number, y: number): number {
  return (
    0.58 * valueNoise2D(x, y) +
    0.29 * valueNoise2D(x * 2.03 + 11.7, y * 2.03 - 5.3) +
    0.13 * valueNoise2D(x * 4.11 - 7.1, y * 4.11 + 19.4)
  );
}

function sampleSubstratePixel(
  x: number,
  y: number,
  width: number,
  height: number,
  substrate: NaturalSubstrateId,
  warmth: number
): [number, number, number] {
  const nx = x / Math.max(1, width);
  const ny = y / Math.max(1, height);
  const warmShift = (warmth - 0.5) * 18;

  if (substrate === 'mati-mud') {
    // Curved hand-plastered Bengali mud courtyard sweep strokes
    const sweep = Math.sin(nx * 24 + fbm2D(nx * 8, ny * 8) * 3.8) * 8;
    const clay = (fbm2D(nx * 22, ny * 22) - 0.5) * 26;
    const fine = (hash2D(x, y) - 0.5) * 10;
    const d = sweep + clay + fine;
    return [
      clamp255(126 + d + warmShift),
      clamp255(68 + d * 0.72 + warmShift * 0.4),
      clamp255(52 + d * 0.58 - warmShift * 0.3),
    ];
  }

  if (substrate === 'ekushey-asphalt') {
    const pebble = (fbm2D(nx * 46, ny * 46) - 0.5) * 36;
    const grit = (hash2D(x, y) - 0.5) * 28;
    const crack = Math.abs(fbm2D(nx * 10, ny * 10) - 0.5) < 0.012 ? -18 : 0;
    const v = 42 + pebble + grit + crack;
    return [
      clamp255(v + warmShift * 0.4),
      clamp255(v + 2),
      clamp255(v + 6 - warmShift * 0.3),
    ];
  }

  if (substrate === 'tant-cotton') {
    const warp = Math.sin(x * 1.45) * 6.5;
    const weft = Math.sin(y * 1.45) * 6.5;
    const slub = (fbm2D(nx * 18, ny * 4) - 0.5) * 14;
    const weave = warp + weft + slub;
    return [
      clamp255(234 + weave + warmShift * 0.5),
      clamp255(226 + weave + warmShift * 0.25),
      clamp255(209 + weave - warmShift * 0.3),
    ];
  }

  // Handmade Patachitra scroll paper
  const fiber = (fbm2D(nx * 16, ny * 16) - 0.5) * 20;
  const fleck = hash2D(x >> 1, y >> 1) > 0.96 ? -16 : 0;
  const edgeVig =
    Math.hypot(nx - 0.5, ny - 0.5) > 0.46 ? -12 : 0;
  const d = fiber + fleck + edgeVig;
  return [
    clamp255(242 + d + warmShift * 0.6),
    clamp255(231 + d + warmShift * 0.2),
    clamp255(206 + d - warmShift * 0.4),
  ];
}

/**
 * Non-Photorealistic Natural Media Renderer (CSE 401/402 NPR):
 * Transforms crisp digital Alpona strokes into tactile wet rice-paste (Chaler Guro),
 * chalk powder, or mineral pigment painted over authentic Bengali physical substrates.
 */
export function renderNaturalMediaAlpona(
  studioSurface: PixelSurface,
  bgHex: string,
  options: NaturalMediaOptions
): PixelSurface {
  const { width, height, data: src } = studioSurface;
  const total = width * height;
  const bg = hexToRgba(bgHex);
  const out = new Uint8ClampedArray(total * 4);

  // Pass 1: Extract stroke alpha mask [0..1] from color distance to studio background
  const mask = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const off = i * 4;
    const dr = src[off] - bg.r;
    const dg = src[off + 1] - bg.g;
    const db = src[off + 2] - bg.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    mask[i] = Math.max(0, Math.min(1, (dist - 16) / 68));
  }

  const isLightPaper =
    options.substrate === 'tant-cotton' || options.substrate === 'patachitra-paper';

  // Pass 2: Composite procedural substrate + impasto edge relief + bristle grain + powder speckle
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const off = idx * 4;
      const [subR, subG, subB] = sampleSubstratePixel(
        x,
        y,
        width,
        height,
        options.substrate,
        options.warmth
      );

      let alpha = mask[idx];
      let pigR = src[off];
      let pigG = src[off + 1];
      let pigB = src[off + 2];

      // On light handloom/paper substrates, shift near-white rice paste to authentic Sindoor red
      if (isLightPaper && alpha > 0.1 && pigR > 225 && pigG > 220 && pigB > 210) {
        pigR = 178;
        pigG = 34;
        pigB = 34;
      }

      // Chalk/rice-paste edge micro-speckle in 2px halo around strokes
      if (alpha < 0.15 && options.speckleIntensity > 0.01) {
        const up = y > 1 ? mask[(y - 2) * width + x] : 0;
        const dn = y < height - 2 ? mask[(y + 2) * width + x] : 0;
        const lf = x > 1 ? mask[y * width + (x - 2)] : 0;
        const rt = x < width - 2 ? mask[y * width + (x + 2)] : 0;
        const halo = Math.max(up, dn, lf, rt);
        if (halo > 0.4) {
          const sp = hash2D(x * 3 + 7, y * 3 + 13);
          if (sp > 1 - options.speckleIntensity * 0.28) {
            alpha = 0.35 + 0.3 * options.speckleIntensity;
            pigR = isLightPaper ? 165 : 246;
            pigG = isLightPaper ? 42 : 242;
            pigB = isLightPaper ? 36 : 232;
          }
        }
      }

      if (alpha <= 0.01) {
        out[off] = subR;
        out[off + 1] = subG;
        out[off + 2] = subB;
        out[off + 3] = 255;
        continue;
      }

      // Dry-brush bristle texture & substrate tooth peeking through thin rice paste
      const grain = fbm2D(x * 0.14, y * 0.14);
      const bristle = 1 - options.brushGrain * (0.48 * (1 - grain));
      const effAlpha = Math.max(0.12, Math.min(1, alpha * bristle));

      // Wet rice-paste impasto rim lighting via Sobel gradient of stroke mask
      let impastoLift = 0;
      if (options.pasteImpasto > 0.01 && x > 0 && y > 0 && x < width - 1 && y < height - 1) {
        const gx = mask[idx + 1] - mask[idx - 1];
        const gy = mask[idx + width] - mask[idx - width];
        // Directional top-left highlight & bottom-right micro-shadow
        impastoLift = (-gx * 0.7 - gy * 0.7) * 44 * options.pasteImpasto;
      }

      const pr = clamp255(pigR + impastoLift);
      const pg = clamp255(pigG + impastoLift);
      const pb = clamp255(pigB + impastoLift * 0.9);

      out[off] = clamp255(subR * (1 - effAlpha) + pr * effAlpha);
      out[off + 1] = clamp255(subG * (1 - effAlpha) + pg * effAlpha);
      out[off + 2] = clamp255(subB * (1 - effAlpha) + pb * effAlpha);
      out[off + 3] = 255;
    }
  }

  return { width, height, data: out };
}
