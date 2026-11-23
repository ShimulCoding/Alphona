import { extractPrintableStencil } from './imageProcessing';
import type { CanvasSurface } from './types';

export interface GreetingCardOptions {
  enabled: boolean;
  headline: string;
  subtitle: string;
}

export const FESTIVAL_GREETING_PRESETS: Array<{
  label: string;
  headline: string;
  subtitle: string;
}> = [
  {
    label: 'Pohela Boishakh',
    headline: 'Shubho Noboborsho',
    subtitle: 'Wishing peace, joy & radiant beginnings',
  },
  {
    label: 'Sharodiya',
    headline: 'Shubho Bijoya',
    subtitle: 'Warm festive greetings from our home to yours',
  },
  {
    label: 'Eid',
    headline: 'Eid Mubarak',
    subtitle: 'May harmony & light fill your courtyard',
  },
  {
    label: 'Minimal',
    headline: 'Alpona Studio',
    subtitle: 'Hand-crafted 2D Bengal symmetry artwork',
  },
];

/**
 * Exports either a crisp 4K Ultra-HD (2880x2880) Alpona artwork PNG or a
 * print-grade 300 DPI framed Bengali festive greeting card PNG (3456x3840)
 * scaled proportionally to the source canvas resolution.
 */
export function exportAlponaPng(
  sourceCanvas: HTMLCanvasElement,
  surface: CanvasSurface,
  card: GreetingCardOptions
): { dataUrl: string; width: number; height: number } {
  if (!card.enabled) {
    const dataUrl = sourceCanvas.toDataURL('image/png');
    triggerDownload(dataUrl, 'alpona-studio-4k-uhd.png');
    return {
      dataUrl,
      width: sourceCanvas.width,
      height: sourceCanvas.height,
    };
  }

  const artSize = sourceCanvas.width;
  const dpiScale = Math.max(1, artSize / 720);
  const padX = Math.round(72 * dpiScale);
  const padTop = Math.round(72 * dpiScale);
  const padBottom = Math.round(168 * dpiScale);
  const outWidth = artSize + padX * 2;
  const outHeight = artSize + padTop + padBottom;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outWidth;
  outCanvas.height = outHeight;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) {
    const fallback = sourceCanvas.toDataURL('image/png');
    triggerDownload(fallback, 'alpona-studio-4k-uhd.png');
    return { dataUrl: fallback, width: artSize, height: artSize };
  }

  // Outer archival mat-board background matching live Greeting Card preview
  ctx.fillStyle = '#FAF8F3';
  ctx.fillRect(0, 0, outWidth, outHeight);

  const outerInset = Math.round(24 * dpiScale);
  const innerInset = Math.round(34 * dpiScale);

  // Double hairline decorative framing border (DPI-scaled)
  ctx.strokeStyle = 'rgba(185, 28, 28, 0.45)';
  ctx.lineWidth = Math.max(2, 2 * dpiScale);
  ctx.strokeRect(
    outerInset,
    outerInset,
    outWidth - outerInset * 2,
    outHeight - outerInset * 2
  );

  ctx.strokeStyle = 'rgba(24, 24, 27, 0.14)';
  ctx.lineWidth = Math.max(1, 1 * dpiScale);
  ctx.strokeRect(
    innerInset,
    innerInset,
    outWidth - innerInset * 2,
    outHeight - innerInset * 2
  );

  // Corner decorative diamonds
  const d = Math.round(6 * dpiScale);
  const corners = [
    [outerInset, outerInset],
    [outWidth - outerInset, outerInset],
    [outerInset, outHeight - outerInset],
    [outWidth - outerInset, outHeight - outerInset],
  ];
  ctx.fillStyle = '#B91C1C';
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - d);
    ctx.lineTo(cx + d, cy);
    ctx.lineTo(cx, cy + d);
    ctx.lineTo(cx - d, cy);
    ctx.closePath();
    ctx.fill();
  }

  // Draw the 4K anti-aliased Alpona canvas centered inside the archival frame
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, padX, padTop, artSize, artSize);

  // Hairline inner frame around the artwork
  ctx.strokeStyle = surface.isDark
    ? 'rgba(24, 24, 27, 0.25)'
    : 'rgba(24, 24, 27, 0.15)';
  ctx.lineWidth = Math.max(1, 1 * dpiScale);
  ctx.strokeRect(padX, padTop, artSize, artSize);

  // Festive greeting typography (DPI-scaled for crisp 300 DPI print)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#18181B';
  ctx.font = `600 ${Math.round(40 * dpiScale)}px "Fraunces", Georgia, serif`;
  ctx.fillText(
    card.headline.trim() || 'Shubho Noboborsho',
    outWidth / 2,
    padTop + artSize + Math.round(72 * dpiScale)
  );

  ctx.fillStyle = '#52525B';
  ctx.font = `400 ${Math.round(18 * dpiScale)}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillText(
    card.subtitle.trim() || 'Hand-crafted 2D Bengali Alpona artwork',
    outWidth / 2,
    padTop + artSize + Math.round(112 * dpiScale)
  );

  const dataUrl = outCanvas.toDataURL('image/png');
  triggerDownload(dataUrl, 'alpona-greeting-card-300dpi.png');
  return { dataUrl, width: outWidth, height: outHeight };
}

/**
 * Exports a crisp 300 DPI black-on-white Printable Alpona Floor Stencil PNG.
 * If `preRenderedVectorStencil` is true, stamps DPI-scaled registration corner ticks
 * directly onto the high-res black-on-white vector stencil canvas; otherwise runs
 * Gaussian smoothing + Sobel gradient extraction on the raster canvas.
 */
export function exportPrintableStencilPng(
  sourceCanvas: HTMLCanvasElement,
  threshold = 46,
  preRenderedVectorStencil = false
): string {
  const outCanvas = document.createElement('canvas');
  outCanvas.width = sourceCanvas.width;
  outCanvas.height = sourceCanvas.height;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return '';

  if (preRenderedVectorStencil) {
    outCtx.drawImage(sourceCanvas, 0, 0);
  } else {
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return '';
    const imgData = ctx.getImageData(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height
    );
    const stencil = extractPrintableStencil(
      {
        width: sourceCanvas.width,
        height: sourceCanvas.height,
        data: imgData.data,
      },
      threshold
    );
    const outImg = outCtx.createImageData(stencil.width, stencil.height);
    outImg.data.set(stencil.data);
    outCtx.putImageData(outImg, 0, 0);
  }

  // DPI-scaled printer registration corner ticks
  const dpiScale = Math.max(1, outCanvas.width / 720);
  outCtx.strokeStyle = '#52525B';
  outCtx.lineWidth = Math.max(1.5, 1.5 * dpiScale);
  const pad = Math.round(16 * dpiScale);
  const tick = Math.round(18 * dpiScale);
  const w = outCanvas.width;
  const h = outCanvas.height;
  const corners: Array<[number, number, number, number]> = [
    [pad, pad, 1, 1],
    [w - pad, pad, -1, 1],
    [pad, h - pad, 1, -1],
    [w - pad, h - pad, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    outCtx.beginPath();
    outCtx.moveTo(cx, cy + dy * tick);
    outCtx.lineTo(cx, cy);
    outCtx.lineTo(cx + dx * tick, cy);
    outCtx.stroke();
  }

  const dataUrl = outCanvas.toDataURL('image/png');
  triggerDownload(dataUrl, 'alpona-printable-stencil-300dpi.png');
  return dataUrl;
}

function triggerDownload(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
