import type { PixelSurface } from './rasterizer';
import { ALPONA_PALETTE, hexToRgba } from './types';

export interface ChalkRingSpec {
  ringIndex: number;
  label: string;
  radiusCm: number;
  radiusInches: number;
  sectorChordCm: number;
  sectorChordInches: number;
}

export interface PigmentEstimate {
  name: string;
  bengali: string;
  hex: string;
  coveragePercent: number;
  areaSqMeters: number;
  estimatedPaintMl: number; // ~160 mL rice paste / acrylic per m^2
}

export interface FloorBlueprintReport {
  diameterCm: number;
  diameterFeet: number;
  sectors: number;
  sectorAngleDeg: number;
  totalAlponaAreaSqM: number;
  rings: ChalkRingSpec[];
  pigments: PigmentEstimate[];
  recommendedTileGrid: 2 | 3;
}

const CM_PER_INCH = 2.54;
const CM_PER_FOOT = 30.48;
const PAINT_ML_PER_SQ_METER = 175;

/**
 * Computes real-world floor chalk-string geometry (concentric compass radii,
 * exact sector chord length c = 2R sin(pi/n)) and pigment paint/rice-paste volume
 * estimates by scanning the rendered Alpona framebuffer.
 */
export function computeFloorBlueprint(
  surface: PixelSurface,
  backgroundHex: string,
  diameterCm: number,
  sectors: number
): FloorBlueprintReport {
  const safeDiam = Math.max(40, Math.min(600, diameterCm));
  const safeSectors = Math.max(3, Math.min(16, Math.round(sectors)));
  const maxRadiusCm = safeDiam / 2;

  const ringRatios = [
    { ratio: 0.25, label: 'Inner Core Ring (R₁)' },
    { ratio: 0.5, label: 'Lotus Petal Ring (R₂)' },
    { ratio: 0.75, label: 'Outer Garland Ring (R₃)' },
    { ratio: 1.0, label: 'Courtyard Border (R₄)' },
  ];

  const rings: ChalkRingSpec[] = ringRatios.map((r, idx) => {
    const radiusCm = Number((maxRadiusCm * r.ratio).toFixed(1));
    const chordCm = Number(
      (2 * radiusCm * Math.sin(Math.PI / safeSectors)).toFixed(1)
    );
    return {
      ringIndex: idx + 1,
      label: r.label,
      radiusCm,
      radiusInches: Number((radiusCm / CM_PER_INCH).toFixed(1)),
      sectorChordCm: chordCm,
      sectorChordInches: Number((chordCm / CM_PER_INCH).toFixed(1)),
    };
  });

  // Scan rendered pixels against palette swatches (ignoring background)
  const bg = hexToRgba(backgroundHex);
  const swatchRgba = ALPONA_PALETTE.map((sw) => ({
    ...sw,
    rgb: hexToRgba(sw.hex),
    count: 0,
  }));

  const { width, height, data } = surface;
  const totalPixels = width * height;
  let paintedPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const distBg = Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b);
    if (distBg < 24) continue;

    paintedPixels++;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let s = 0; s < swatchRgba.length; s++) {
      const sr = swatchRgba[s].rgb;
      const d = Math.abs(r - sr.r) + Math.abs(g - sr.g) + Math.abs(b - sr.b);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = s;
      }
    }
    swatchRgba[bestIdx].count++;
  }

  const canvasSqMeters = (safeDiam / 100) * (safeDiam / 100);
  const totalAlponaAreaSqM = Number(
    ((paintedPixels / Math.max(1, totalPixels)) * canvasSqMeters).toFixed(3)
  );

  const pigments: PigmentEstimate[] = swatchRgba
    .filter((sw) => sw.count > Math.max(25, totalPixels * 0.0005))
    .sort((a, b) => b.count - a.count)
    .map((sw) => {
      const frac = sw.count / Math.max(1, totalPixels);
      const areaSqMeters = Number((frac * canvasSqMeters).toFixed(3));
      const estimatedPaintMl = Math.max(
        5,
        Math.round(areaSqMeters * PAINT_ML_PER_SQ_METER)
      );
      return {
        name: sw.name,
        bengali: sw.bengali,
        hex: sw.hex,
        coveragePercent: Number((frac * 100).toFixed(1)),
        areaSqMeters,
        estimatedPaintMl,
      };
    });

  return {
    diameterCm: safeDiam,
    diameterFeet: Number((safeDiam / CM_PER_FOOT).toFixed(2)),
    sectors: safeSectors,
    sectorAngleDeg: Number((360 / safeSectors).toFixed(1)),
    totalAlponaAreaSqM,
    rings,
    pigments,
    recommendedTileGrid: safeDiam >= 150 ? 3 : 2,
  };
}

/**
 * Renders one tiled printable A4 floor stencil sheet (row, col inside gridN x gridN)
 * onto a canvas with corner registration crosshairs (+), glue overlap ticks, and sheet ID (e.g. A1..C3).
 */
export function renderA4StencilTileToCanvas(
  stencilSurface: PixelSurface,
  gridN: 2 | 3,
  row: number,
  col: number,
  diameterCm: number,
  outputWidth = 595,
  outputHeight = 842
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Clean white printable A4 paper sheet
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, outputWidth, outputHeight);

  const margin = Math.round(outputWidth * 0.075);
  const headerH = Math.round(outputHeight * 0.075);
  const footerH = Math.round(outputHeight * 0.065);
  const usableW = outputWidth - margin * 2;
  const usableH = outputHeight - margin * 2 - headerH - footerH;
  const squareSide = Math.min(usableW, usableH);
  const boxX = Math.round((outputWidth - squareSide) / 2);
  const boxY = Math.round(margin + headerH + (usableH - squareSide) / 2);

  // Convert stencilSurface into offscreen canvas so drawImage crops cleanly
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = stencilSurface.width;
  srcCanvas.height = stencilSurface.height;
  const sCtx = srcCanvas.getContext('2d');
  if (sCtx) {
    const img = sCtx.createImageData(stencilSurface.width, stencilSurface.height);
    img.data.set(stencilSurface.data);
    sCtx.putImageData(img, 0, 0);

    const tileW = stencilSurface.width / gridN;
    const tileH = stencilSurface.height / gridN;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      srcCanvas,
      col * tileW,
      row * tileH,
      tileW,
      tileH,
      boxX,
      boxY,
      squareSide,
      squareSide
    );
  }

  const dpiScale = Math.max(1, outputWidth / 595);

  // Dashed trim border (DPI-scaled)
  ctx.strokeStyle = '#71717A';
  ctx.lineWidth = Math.max(1, 1 * dpiScale);
  ctx.setLineDash([6 * dpiScale, 4 * dpiScale]);
  ctx.strokeRect(boxX, boxY, squareSide, squareSide);
  ctx.setLineDash([]);

  // Corner registration crosshairs (+) for physical taping alignment
  const corners = [
    { x: boxX, y: boxY },
    { x: boxX + squareSide, y: boxY },
    { x: boxX, y: boxY + squareSide },
    { x: boxX + squareSide, y: boxY + squareSide },
  ];
  const crossArm = 10 * dpiScale;
  const crossRad = 4 * dpiScale;
  ctx.strokeStyle = '#B91C1C';
  ctx.lineWidth = Math.max(1.5, 1.5 * dpiScale);
  for (const pt of corners) {
    ctx.beginPath();
    ctx.moveTo(pt.x - crossArm, pt.y);
    ctx.lineTo(pt.x + crossArm, pt.y);
    ctx.moveTo(pt.x, pt.y - crossArm);
    ctx.lineTo(pt.x, pt.y + crossArm);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, crossRad, 0, Math.PI * 2);
    ctx.stroke();
  }

  const rowLetter = String.fromCharCode(65 + row);
  const tileCode = `${rowLetter}${col + 1}`;
  const tileCm = (diameterCm / gridN).toFixed(1);

  // Header typography (DPI-scaled for 300 DPI A4 print)
  ctx.fillStyle = '#18181B';
  ctx.font = `600 ${Math.round(outputWidth * 0.03)}px Georgia, serif`;
  ctx.fillText(
    `Alpona Studio — Floor Stencil Tile ${tileCode}`,
    margin,
    margin + Math.round(22 * dpiScale)
  );

  ctx.fillStyle = '#52525B';
  ctx.font = `500 ${Math.round(outputWidth * 0.019)}px monospace`;
  ctx.fillText(
    `Grid ${gridN}x${gridN} · Row ${row + 1}/${gridN}, Col ${col + 1}/${gridN} · Tile Span: ${tileCm} cm`,
    margin,
    margin + Math.round(44 * dpiScale)
  );

  // Footer alignment note
  ctx.fillStyle = '#52525B';
  ctx.font = `400 ${Math.round(outputWidth * 0.018)}px monospace`;
  ctx.fillText(
    `Target Diameter: ${diameterCm} cm (${(diameterCm / CM_PER_FOOT).toFixed(
      1
    )} ft) · Align red (+) crosshairs when taping sheets`,
    margin,
    outputHeight - Math.round(margin * 0.85)
  );

  return canvas;
}
