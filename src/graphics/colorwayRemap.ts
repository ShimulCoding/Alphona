import type { PixelSurface } from './rasterizer';
import {
  hexToRgba,
  type CanvasSurfaceId,
  type DrawOperation,
} from './types';

export interface FestivalColorway {
  id: string;
  name: string;
  bengali: string;
  surfaceId: CanvasSurfaceId;
  palette: string[]; // Ordered from highest-contrast primary -> secondary accents
}

export const FESTIVAL_COLORWAYS: FestivalColorway[] = [
  {
    id: 'pohela-boishakh',
    name: 'Pohela Boishakh',
    bengali: 'পহেলা বৈশাখ',
    surfaceId: 'terracotta',
    palette: ['#FAF8F2', '#F59E0B', '#DC2626', '#FDE68A', '#18181B'],
  },
  {
    id: 'gaye-holud',
    name: 'Gaye Holud',
    bengali: 'গায়ে হলুদ',
    surfaceId: 'courtyard',
    palette: ['#FACC15', '#FAF8F2', '#EA580C', '#16A34A', '#DC2626'],
  },
  {
    id: 'lakshmi-puja',
    name: 'Lakshmi Puja',
    bengali: 'লক্ষ্মী পূজা',
    surfaceId: 'paper',
    palette: ['#B91C1C', '#18181B', '#D97706', '#E11D48', '#15803D'],
  },
  {
    id: 'royal-jamdani',
    name: 'Royal Jamdani',
    bengali: 'জামদানি নীলাম্বরী',
    surfaceId: 'indigo',
    palette: ['#FDE68A', '#FAF8F2', '#F43F5E', '#38BDF8', '#F59E0B'],
  },
];

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function luminanceOfHex(hex: string): number {
  const c = hexToRgba(hex);
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

/**
 * Deterministic K-Means Color Quantization in RGB space (CSE 401/402 CLO-1/6):
 * Extracts the top `k` dominant saree / courtyard pigments from any uploaded photo.
 * Uses deterministic strided sampling + farthest-point centroid seeding so results
 * are reproducible and never fluctuate randomly.
 */
export function extractKMeansPalette(
  photo: PixelSurface,
  k = 5,
  maxIterations = 14
): string[] {
  const numClusters = Math.max(2, Math.min(8, Math.round(k)));
  const totalPixels = photo.width * photo.height;
  if (totalPixels === 0) return ['#FAF8F2', '#DC2626', '#F59E0B', '#16A34A', '#2563EB'].slice(0, numClusters);

  // Sample up to ~2,400 pixels deterministically
  const stride = Math.max(1, Math.floor(totalPixels / 2400));
  const samples: Array<[number, number, number]> = [];
  for (let i = 0; i < totalPixels; i += stride) {
    const off = i * 4;
    if (photo.data[off + 3] < 32) continue;
    samples.push([photo.data[off], photo.data[off + 1], photo.data[off + 2]]);
  }
  if (samples.length === 0) {
    return ['#FAF8F2', '#DC2626', '#F59E0B', '#16A34A', '#2563EB'].slice(0, numClusters);
  }

  // Deterministic farthest-point seeding (K-Means++ style without PRNG randomness)
  const centroids: Array<[number, number, number]> = [[...samples[0]]];
  while (centroids.length < numClusters) {
    let bestIdx = 0;
    let bestDistSq = -1;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      let minD = Infinity;
      for (const c of centroids) {
        const dr = s[0] - c[0];
        const dg = s[1] - c[1];
        const db = s[2] - c[2];
        const dSq = dr * dr + dg * dg + db * db;
        if (dSq < minD) minD = dSq;
      }
      if (minD > bestDistSq) {
        bestDistSq = minD;
        bestIdx = i;
      }
    }
    centroids.push([...samples[bestIdx]]);
  }

  const counts = new Int32Array(numClusters);
  const sumR = new Float64Array(numClusters);
  const sumG = new Float64Array(numClusters);
  const sumB = new Float64Array(numClusters);

  for (let iter = 0; iter < maxIterations; iter++) {
    counts.fill(0);
    sumR.fill(0);
    sumG.fill(0);
    sumB.fill(0);

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      let bestC = 0;
      let bestD = Infinity;
      for (let c = 0; c < numClusters; c++) {
        const dr = s[0] - centroids[c][0];
        const dg = s[1] - centroids[c][1];
        const db = s[2] - centroids[c][2];
        const dSq = dr * dr + dg * dg + db * db;
        if (dSq < bestD) {
          bestD = dSq;
          bestC = c;
        }
      }
      counts[bestC]++;
      sumR[bestC] += s[0];
      sumG[bestC] += s[1];
      sumB[bestC] += s[2];
    }

    let moved = 0;
    for (let c = 0; c < numClusters; c++) {
      if (counts[c] === 0) continue;
      const nr = sumR[c] / counts[c];
      const ng = sumG[c] / counts[c];
      const nb = sumB[c] / counts[c];
      moved += Math.abs(nr - centroids[c][0]) + Math.abs(ng - centroids[c][1]) + Math.abs(nb - centroids[c][2]);
      centroids[c] = [nr, ng, nb];
    }
    if (moved < 1.0) break;
  }

  // Sort extracted pigments by visual prominence (vividness + cluster weight)
  const ranked = centroids
    .map((c, idx) => {
      const maxCh = Math.max(c[0], c[1], c[2]);
      const minCh = Math.min(c[0], c[1], c[2]);
      const chroma = maxCh - minCh;
      const score = counts[idx] * (1 + chroma / 180);
      return { hex: rgbToHex(c[0], c[1], c[2]), score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked.map((r) => r.hex);
}

/**
 * Remaps every unique stroke and fill color in `operations` onto `targetPalette`
 * while preserving the visual hierarchy (most-used pigment -> palette[0], etc.).
 */
export function remapOperationsColorway(
  operations: DrawOperation[],
  targetPalette: string[]
): DrawOperation[] {
  if (operations.length === 0 || targetPalette.length === 0) return operations;

  // Count frequency of each existing color
  const freq = new Map<string, number>();
  for (const op of operations) {
    const key = op.color.toUpperCase();
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }

  const sortedColors = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex);

  const colorMap = new Map<string, string>();
  sortedColors.forEach((srcHex, idx) => {
    colorMap.set(srcHex, targetPalette[idx % targetPalette.length]);
  });

  return operations.map((op) => {
    const mapped = colorMap.get(op.color.toUpperCase()) ?? targetPalette[0];
    return { ...op, color: mapped };
  });
}

/**
 * Picks the best contrasting courtyard surface for a photo-extracted K-Means palette.
 */
export function pickContrastingSurfaceForPalette(
  palette: string[]
): CanvasSurfaceId {
  if (palette.length === 0) return 'courtyard';
  const primaryLum = luminanceOfHex(palette[0]);
  return primaryLum < 95 ? 'paper' : 'courtyard';
}
