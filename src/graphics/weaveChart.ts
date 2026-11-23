import { extractKMeansPalette, rgbToHex } from './colorwayRemap';
import type { PixelSurface } from './rasterizer';
import { hexToRgba } from './types';

export type WeavePalettePreset =
  | 'alpona-source'
  | 'jamdani-zari'
  | 'nakshi-kantha'
  | 'dmc-heritage';

export type WeaveDitherMode = 'nearest' | 'bayer' | 'floyd-steinberg';

export interface WeaveChartOptions {
  gridSize: number; // Warp x Weft grid cells (e.g. 32, 48, 64, 80, 96)
  maxColors: number; // 3..8 thread colors
  ditherMode: WeaveDitherMode;
  palettePreset: WeavePalettePreset;
  clothCountPerInch: number; // e.g. 11, 14, 18 stitches per inch
}

export interface WeaveThreadStat {
  index: number;
  hex: string;
  name: string;
  symbol: string;
  stitchCount: number;
  percent: number;
  estimatedThreadMeters: number;
}

export interface WeaveChartResult {
  gridSize: number;
  cells: Uint8Array; // [gridSize * gridSize] thread palette index per cell
  threads: WeaveThreadStat[];
  totalStitches: number;
  finishedSizeCm: number;
  ditherMode: WeaveDitherMode;
}

const SYMBOLS = ['·', '●', '▲', '■', '◆', '×', '+', '○'];

const CURATED_THREAD_PALETTES: Record<
  Exclude<WeavePalettePreset, 'alpona-source'>,
  Array<{ hex: string; name: string }>
> = {
  'jamdani-zari': [
    { hex: '#1B2845', name: 'Nilambari Indigo' },
    { hex: '#FAF6EE', name: 'Kora Muslin Ivory' },
    { hex: '#EAB308', name: 'Sonali Zari Gold' },
    { hex: '#B91C1C', name: 'Lal Paar Crimson' },
    { hex: '#15803D', name: 'Pata Green' },
    { hex: '#F472B6', name: 'Golapi Rose' },
    { hex: '#38BDF8', name: 'Meghna Sky' },
    { hex: '#18181B', name: 'Kajal Black' },
  ],
  'nakshi-kantha': [
    { hex: '#F7F3E9', name: 'Unbleached Cotton' },
    { hex: '#B91C1C', name: 'Kantha Sindoor' },
    { hex: '#1D4ED8', name: 'Neel Thread' },
    { hex: '#D97706', name: 'Halud Mustard' },
    { hex: '#166534', name: 'Shobuj Leaf' },
    { hex: '#1F2937', name: 'Charcoal Outline' },
    { hex: '#BE185D', name: 'Alta Magenta' },
    { hex: '#EA580C', name: 'Marigold Rust' },
  ],
  'dmc-heritage': [
    { hex: '#262628', name: 'DMC 310 Slate' },
    { hex: '#FAF8F2', name: 'DMC B5200 White' },
    { hex: '#C81E1E', name: 'DMC 666 Red' },
    { hex: '#F59E0B', name: 'DMC 742 Gold' },
    { hex: '#16A34A', name: 'DMC 701 Green' },
    { hex: '#2563EB', name: 'DMC 797 Royal' },
    { hex: '#EA580C', name: 'DMC 720 Flame' },
    { hex: '#A855F7', name: 'DMC 552 Violet' },
  ],
};

// Classic 4x4 Bayer threshold matrix normalized to [-0.5 .. +0.5]
const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
].map((v) => (v + 0.5) / 16 - 0.5);

function findNearestColorIdx(
  r: number,
  g: number,
  b: number,
  paletteRgb: Array<{ r: number; g: number; b: number }>
): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < paletteRgb.length; i++) {
    const p = paletteRgb[i];
    const dr = r - p.r;
    const dg = g - p.g;
    const db = b - p.b;
    // Perceptually weighted RGB distance
    const d = 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Converts a live circular/square Alpona PixelSurface into a loom-ready
 * Jamdani Handloom / Nakshi Kantha Cross-Stitch weave chart with exact
 * Bayer or Floyd-Steinberg dithering and stitch/thread meter estimates.
 */
export function buildWeaveChart(
  alpona: PixelSurface,
  options: WeaveChartOptions
): WeaveChartResult {
  const n = Math.max(24, Math.min(112, Math.round(options.gridSize)));
  const maxColors = Math.max(3, Math.min(8, Math.round(options.maxColors)));

  // Step 1: Area-averaged downsampling onto n x n warp/weft float RGB grid
  const rBuf = new Float32Array(n * n);
  const gBuf = new Float32Array(n * n);
  const bBuf = new Float32Array(n * n);

  for (let y = 0; y < n; y++) {
    const sy0 = Math.floor((y / n) * alpona.height);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) / n) * alpona.height));
    for (let x = 0; x < n; x++) {
      const sx0 = Math.floor((x / n) * alpona.width);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) / n) * alpona.width));
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let cnt = 0;
      for (let sy = sy0; sy < sy1 && sy < alpona.height; sy++) {
        for (let sx = sx0; sx < sx1 && sx < alpona.width; sx++) {
          const off = (sy * alpona.width + sx) * 4;
          sr += alpona.data[off];
          sg += alpona.data[off + 1];
          sb += alpona.data[off + 2];
          cnt++;
        }
      }
      const idx = y * n + x;
      const inv = cnt > 0 ? 1 / cnt : 1;
      rBuf[idx] = sr * inv;
      gBuf[idx] = sg * inv;
      bBuf[idx] = sb * inv;
    }
  }

  // Step 2: Select thread palette (curated Bengali loom shades or K-Means from artwork)
  let rawPalette: Array<{ hex: string; name: string }>;
  if (options.palettePreset === 'alpona-source') {
    const km = extractKMeansPalette(alpona, maxColors);
    rawPalette = km.map((hex, idx) => ({
      hex,
      name: `Thread #${idx + 1}`,
    }));
  } else {
    rawPalette = CURATED_THREAD_PALETTES[options.palettePreset].slice(0, maxColors);
  }

  const paletteRgb = rawPalette.map((p) => hexToRgba(p.hex));

  // Step 3: Quantize onto weave grid using Nearest, 4x4 Ordered Bayer, or Floyd-Steinberg
  const cells = new Uint8Array(n * n);
  const counts = new Int32Array(rawPalette.length);

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const idx = y * n + x;
      let r = rBuf[idx];
      let g = gBuf[idx];
      let b = bBuf[idx];

      if (options.ditherMode === 'bayer') {
        const bias = BAYER_4X4[(y & 3) * 4 + (x & 3)] * 52;
        r = Math.max(0, Math.min(255, r + bias));
        g = Math.max(0, Math.min(255, g + bias));
        b = Math.max(0, Math.min(255, b + bias));
      }

      const bestIdx = findNearestColorIdx(r, g, b, paletteRgb);
      cells[idx] = bestIdx;
      counts[bestIdx]++;

      if (options.ditherMode === 'floyd-steinberg') {
        const er = r - paletteRgb[bestIdx].r;
        const eg = g - paletteRgb[bestIdx].g;
        const eb = b - paletteRgb[bestIdx].b;
        const distribute = (nx: number, ny: number, w: number) => {
          if (nx < 0 || nx >= n || ny < 0 || ny >= n) return;
          const nIdx = ny * n + nx;
          rBuf[nIdx] = Math.max(0, Math.min(255, rBuf[nIdx] + er * w));
          gBuf[nIdx] = Math.max(0, Math.min(255, gBuf[nIdx] + eg * w));
          bBuf[nIdx] = Math.max(0, Math.min(255, bBuf[nIdx] + eb * w));
        };
        distribute(x + 1, y, 7 / 16);
        distribute(x - 1, y + 1, 3 / 16);
        distribute(x, y + 1, 5 / 16);
        distribute(x + 1, y + 1, 1 / 16);
      }
    }
  }

  const totalStitches = n * n;
  const countPerInch = Math.max(8, Math.min(24, options.clothCountPerInch));
  const finishedSizeCm = Number(((n / countPerInch) * 2.54).toFixed(1));
  // Standard 2-strand cross-stitch / jamdani extra-weft uses ~2.6 cm thread per stitch at 14ct
  const cmPerStitch = (2.6 * 14) / countPerInch;

  const threads: WeaveThreadStat[] = rawPalette.map((p, idx) => {
    const st = counts[idx];
    return {
      index: idx,
      hex: p.hex.toUpperCase(),
      name: p.name,
      symbol: SYMBOLS[idx % SYMBOLS.length],
      stitchCount: st,
      percent: Number(((st / Math.max(1, totalStitches)) * 100).toFixed(1)),
      estimatedThreadMeters: Number(((st * cmPerStitch) / 100).toFixed(2)),
    };
  });

  return {
    gridSize: n,
    cells,
    threads,
    totalStitches,
    finishedSizeCm,
    ditherMode: options.ditherMode,
  };
}

/**
 * Exports the numbered warp x weft loom stitch matrix + thread guide as a CSV string.
 */
export function exportWeaveChartCsv(chart: WeaveChartResult): string {
  const lines: string[] = [
    `# Alpona Studio Jamdani / Nakshi Kantha Weave Chart (${chart.gridSize}x${chart.gridSize})`,
    `# Finished size: ${chart.finishedSizeCm} cm x ${chart.finishedSizeCm} cm | Dither: ${chart.ditherMode}`,
    '# Symbol,Thread Name,Hex,Stitches,Percent,Thread Meters',
  ];
  for (const t of chart.threads) {
    lines.push(
      `# "${t.symbol}","${t.name}",${t.hex},${t.stitchCount},${t.percent}%,${t.estimatedThreadMeters}m`
    );
  }
  for (let y = 0; y < chart.gridSize; y++) {
    const row: string[] = [];
    for (let x = 0; x < chart.gridSize; x++) {
      const idx = chart.cells[y * chart.gridSize + x];
      row.push(chart.threads[idx]?.symbol ?? '.');
    }
    lines.push(row.join(','));
  }
  return lines.join('\n') + '\n';
}

/**
 * Renders the weave chart directly onto a Canvas2D context with crisp numbered
 * warp/weft rulers, bold 10-stitch graph lines, and optional stitch symbols.
 */
export function renderWeaveChartToCanvas(
  canvas: HTMLCanvasElement,
  chart: WeaveChartResult,
  cellPx = 10,
  showSymbols = true
): void {
  const n = chart.gridSize;
  const padLeft = 34;
  const padTop = 30;
  const padRight = 16;
  const padBottom = 16;
  const gridPx = n * cellPx;

  canvas.width = padLeft + gridPx + padRight;
  canvas.height = padTop + gridPx + padBottom;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#FAF8F3';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Fill every weave cell
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const tIdx = chart.cells[y * n + x];
      const thread = chart.threads[tIdx];
      const px = padLeft + x * cellPx;
      const py = padTop + y * cellPx;
      ctx.fillStyle = thread ? thread.hex : '#FFFFFF';
      ctx.fillRect(px, py, cellPx, cellPx);

      if (showSymbols && cellPx >= 9 && thread) {
        const c = hexToRgba(thread.hex);
        const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        ctx.fillStyle = lum > 130 ? 'rgba(24,24,27,0.72)' : 'rgba(250,248,242,0.85)';
        ctx.font = `${Math.max(7, Math.floor(cellPx * 0.68))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(thread.symbol, px + cellPx * 0.5, py + cellPx * 0.54);
      }
    }
  }

  // Fine grid lines + bold every-10th-cell Jamdani graph rulings
  for (let i = 0; i <= n; i++) {
    const isMajor = i % 10 === 0 || i === n;
    ctx.strokeStyle = isMajor ? 'rgba(185, 28, 28, 0.72)' : 'rgba(24, 24, 27, 0.16)';
    ctx.lineWidth = isMajor ? 1.3 : 0.6;

    const xPos = padLeft + i * cellPx + 0.5;
    ctx.beginPath();
    ctx.moveTo(xPos, padTop);
    ctx.lineTo(xPos, padTop + gridPx);
    ctx.stroke();

    const yPos = padTop + i * cellPx + 0.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, yPos);
    ctx.lineTo(padLeft + gridPx, yPos);
    ctx.stroke();

    if (i % 10 === 0 && i < n) {
      ctx.fillStyle = '#52525B';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(i + 1), padLeft + i * cellPx + cellPx * 0.5, padTop - 6);

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), padLeft - 6, padTop + i * cellPx + cellPx * 0.5);
    }
  }
}

export { rgbToHex };
