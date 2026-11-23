import { deCasteljauSubdivision } from './bezier';
import { getActiveClipBounds, renderScene, type RenderOptions } from './engine';
import { scaleOperations, scaleRenderOptions } from './highResExport';
import type { PixelSurface } from './rasterizer';
import {
  applyMat3,
  buildHomogeneousTransform2D,
  generateSymmetricPoints,
  generateSymmetricPolygons,
  generateSymmetricSegments,
  isIdentityTransform2D,
} from './transforms';
import {
  DEFAULT_TRANSFORM_2D,
  type CanvasSurface,
  type DrawOperation,
  type Point2D,
} from './types';

export interface ReelExportOptions {
  size?: number; // Default 1080x1080 square HD social reel
  fps?: number; // Default 30 fps
  durationSec?: number; // Default 5.5s smooth draw + 1.2s finished hold
  titleText?: string; // Optional Bengali / English festival title banner
  onProgress?: (percent: number) => void;
}

export interface PartialOpProgress {
  completedCount: number;
  activeIndex: number;
  activeT: number; // [0..1] progress within the active operation
}

/**
 * Pure deterministic helper: converts normalized animation time u in [0, 1]
 * into which operations are fully drawn and the parametric progress t in [0, 1]
 * of the currently animating stroke.
 */
export function computeReelOpProgress(
  totalOps: number,
  u: number
): PartialOpProgress {
  if (totalOps <= 0) {
    return { completedCount: 0, activeIndex: -1, activeT: 0 };
  }
  const clamped = Math.max(0, Math.min(1, u));
  if (clamped >= 1) {
    return { completedCount: totalOps, activeIndex: -1, activeT: 1 };
  }
  const scaled = clamped * totalOps;
  const activeIndex = Math.min(totalOps - 1, Math.floor(scaled));
  const activeT = scaled - activeIndex;
  return {
    completedCount: activeIndex,
    activeIndex,
    activeT,
  };
}

/**
 * Draws a single vector DrawOperation at fractional reveal t in (0, 1]
 * using smooth parametric interpolation across all radial symmetry sectors!
 */
function drawPartialOperation2D(
  ctx: CanvasRenderingContext2D,
  op: DrawOperation,
  t: number,
  center: Point2D,
  xf: (pt: Point2D) => Point2D,
  avgScale: number
): void {
  if (op.kind === 'fill' || t <= 0) return;

  ctx.strokeStyle = op.color;
  ctx.lineWidth = Math.max(1.5, op.thickness);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const tt = Math.max(0.01, Math.min(1, t));

  if (op.kind === 'line') {
    const copies = generateSymmetricSegments(op.p0, op.p1, center, op.symmetry);
    ctx.beginPath();
    for (const seg of copies) {
      const a = xf(seg.p0);
      const b = xf({
        x: seg.p0.x + (seg.p1.x - seg.p0.x) * tt,
        y: seg.p0.y + (seg.p1.y - seg.p0.y) * tt,
      });
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  } else if (op.kind === 'circle') {
    const centers = generateSymmetricPoints(op.center, center, op.symmetry);
    const seen = new Set<string>();
    const r = Math.max(0.5, op.radius * avgScale);
    const sweep = Math.PI * 2 * tt;
    for (const cPt of centers) {
      const key = `${Math.round(cPt.x)},${Math.round(cPt.y)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const tc = xf(cPt);
      ctx.beginPath();
      ctx.arc(tc.x, tc.y, r, -Math.PI / 2, -Math.PI / 2 + sweep);
      ctx.stroke();
    }
  } else if (op.kind === 'polygon') {
    const polys = generateSymmetricPolygons(op.vertices, center, op.symmetry);
    for (const poly of polys) {
      if (poly.length < 2) continue;
      const totalEdges = poly.length;
      const edgeProgress = tt * totalEdges;
      const fullEdges = Math.floor(edgeProgress);
      const frac = edgeProgress - fullEdges;

      ctx.beginPath();
      const p0 = xf(poly[0]);
      ctx.moveTo(p0.x, p0.y);
      for (let e = 0; e < Math.min(totalEdges, fullEdges); e++) {
        const next = xf(poly[(e + 1) % totalEdges]);
        ctx.lineTo(next.x, next.y);
      }
      if (fullEdges < totalEdges && frac > 0) {
        const a = poly[fullEdges];
        const b = poly[(fullEdges + 1) % totalEdges];
        const mid = xf({
          x: a.x + (b.x - a.x) * frac,
          y: a.y + (b.y - a.y) * frac,
        });
        ctx.lineTo(mid.x, mid.y);
      }
      ctx.stroke();
    }
  } else if (op.kind === 'freehand') {
    if (op.points.length < 2) return;
    const count = Math.max(2, Math.ceil(op.points.length * tt));
    const subPts = op.points.slice(0, count);
    const n = Math.max(1, Math.round(op.symmetry.sectors));

    for (let k = 0; k < n; k++) {
      const th = (2 * Math.PI * k) / n;
      const cosT = Math.cos(th);
      const sinT = Math.sin(th);
      const rot = (p: Point2D): Point2D => {
        const dx = p.x - center.x;
        const dy = p.y - center.y;
        return xf({
          x: center.x + dx * cosT - dy * sinT,
          y: center.y + dx * sinT + dy * cosT,
        });
      };

      ctx.beginPath();
      const s0 = rot(subPts[0]);
      ctx.moveTo(s0.x, s0.y);
      for (let i = 1; i < subPts.length; i++) {
        const si = rot(subPts[i]);
        ctx.lineTo(si.x, si.y);
      }
      ctx.stroke();

      if (op.symmetry.reflect) {
        ctx.beginPath();
        const m0 = rot({ x: 2 * center.x - subPts[0].x, y: subPts[0].y });
        ctx.moveTo(m0.x, m0.y);
        for (let i = 1; i < subPts.length; i++) {
          const mi = rot({ x: 2 * center.x - subPts[i].x, y: subPts[i].y });
          ctx.lineTo(mi.x, mi.y);
        }
        ctx.stroke();
      }
    }
  } else if (op.kind === 'bezier') {
    // True de Casteljau left sub-curve [0, tt] gives exact smooth Bezier growth!
    const sub = deCasteljauSubdivision(op.p0, op.p1, op.p2, op.p3, tt);
    const q0 = op.p0;
    const q1 = sub.q0;
    const q2 = sub.r0;
    const q3 = sub.point;

    const n = Math.max(1, Math.round(op.symmetry.sectors));
    for (let k = 0; k < n; k++) {
      const th = (2 * Math.PI * k) / n;
      const cosT = Math.cos(th);
      const sinT = Math.sin(th);
      const rot = (p: Point2D): Point2D => {
        const dx = p.x - center.x;
        const dy = p.y - center.y;
        return xf({
          x: center.x + dx * cosT - dy * sinT,
          y: center.y + dx * sinT + dy * cosT,
        });
      };

      const b0 = rot(q0);
      const b1 = rot(q1);
      const b2 = rot(q2);
      const b3 = rot(q3);
      ctx.beginPath();
      ctx.moveTo(b0.x, b0.y);
      ctx.bezierCurveTo(b1.x, b1.y, b2.x, b2.y, b3.x, b3.y);
      ctx.stroke();

      if (op.symmetry.reflect) {
        const mir = (p: Point2D): Point2D =>
          rot({ x: 2 * center.x - p.x, y: p.y });
        const m0 = mir(q0);
        const m1 = mir(q1);
        const m2 = mir(q2);
        const m3 = mir(q3);
        ctx.beginPath();
        ctx.moveTo(m0.x, m0.y);
        ctx.bezierCurveTo(m1.x, m1.y, m2.x, m2.y, m3.x, m3.y);
        ctx.stroke();
      }
    }
  }
}

/**
 * Records a smooth 1080x1080 HD Timelapse Reel (.webm) directly in the browser
 * using parametric stroke interpolation & MediaRecorder (zero UI clutter).
 */
export async function exportAlponaTimelapseReel(
  operations: DrawOperation[],
  surface: CanvasSurface,
  logicalSize: number,
  renderOptions: RenderOptions = {},
  options: ReelExportOptions = {}
): Promise<{ blob: Blob; filename: string; width: number; height: number }> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser.');
  }

  const size = options.size ?? 1080;
  const fps = options.fps ?? 30;
  const drawDurationSec = options.durationSec ?? 5.0;
  const holdDurationSec = 1.2;
  const totalDrawFrames = Math.max(24, Math.round(drawDurationSec * fps));
  const totalHoldFrames = Math.max(12, Math.round(holdDurationSec * fps));
  const totalFrames = totalDrawFrames + totalHoldFrames;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize HD video canvas context.');

  const scale = size / Math.max(1, logicalSize);
  const scaledOps = scaleOperations(operations, scale);
  const scaledOpts = scaleRenderOptions(renderOptions, scale);
  const center: Point2D = { x: size / 2, y: size / 2 };
  const transform2D = scaledOpts.transform2D ?? DEFAULT_TRANSFORM_2D;
  const mat3 = isIdentityTransform2D(transform2D)
    ? null
    : buildHomogeneousTransform2D(transform2D, center);
  const xf = (pt: Point2D): Point2D => (mat3 ? applyMat3(mat3, pt) : pt);
  const avgScale =
    (Math.abs(transform2D.scaleX) + Math.abs(transform2D.scaleY)) / 2;

  // Pre-render exact fill snapshots for each fill operation so fills fade in cleanly at 30fps
  const fillSnapshots = new Map<number, HTMLCanvasElement>();
  for (let i = 0; i < operations.length; i++) {
    if (operations[i].kind !== 'fill') continue;
    const fillDim = 540;
    const fScale = fillDim / logicalSize;
    const buf: PixelSurface = {
      width: fillDim,
      height: fillDim,
      data: new Uint8ClampedArray(fillDim * fillDim * 4),
    };
    renderScene(
      buf,
      surface.hex,
      scaleOperations(operations.slice(0, i + 1), fScale),
      null,
      scaleRenderOptions(renderOptions, fScale)
    );
    const snap = document.createElement('canvas');
    snap.width = fillDim;
    snap.height = fillDim;
    const sCtx = snap.getContext('2d');
    if (sCtx) {
      const img = sCtx.createImageData(fillDim, fillDim);
      img.data.set(buf.data);
      sCtx.putImageData(img, 0, 0);
      fillSnapshots.set(i, snap);
    }
  }

  const mimeCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const mimeType =
    mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType, videoBitsPerSecond: 6_500_000 } : undefined
  );
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  const stopPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
    };
  });

  recorder.start();

  const frameDelayMs = Math.round(1000 / fps);
  const titleText = options.titleText?.trim() || 'Alpona Studio · Bengali Symmetry Art';

  for (let f = 0; f < totalFrames; f++) {
    const u = f < totalDrawFrames ? f / Math.max(1, totalDrawFrames - 1) : 1;
    const prog = computeReelOpProgress(scaledOps.length, u);

    // Background
    ctx.fillStyle = surface.hex;
    ctx.fillRect(0, 0, size, size);

    // Draw latest completed fill snapshot underneath vector strokes
    let latestFillIdx = -1;
    for (let i = 0; i < prog.completedCount; i++) {
      if (fillSnapshots.has(i)) latestFillIdx = i;
    }
    if (latestFillIdx >= 0) {
      const snap = fillSnapshots.get(latestFillIdx)!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(snap, 0, 0, size, size);
    }
    // Fade in active fill smoothly
    if (prog.activeIndex >= 0 && fillSnapshots.has(prog.activeIndex)) {
      const snap = fillSnapshots.get(prog.activeIndex)!;
      ctx.save();
      ctx.globalAlpha = prog.activeT;
      ctx.drawImage(snap, 0, 0, size, size);
      ctx.restore();
    }

    // Optional clipping window
    ctx.save();
    if (scaledOpts.clippingWindow?.enabled) {
      const b = getActiveClipBounds(size, size, scaledOpts.clippingWindow);
      ctx.beginPath();
      ctx.rect(b.xmin, b.ymin, b.xmax - b.xmin, b.ymax - b.ymin);
      ctx.clip();
    }

    // Draw all completed vector operations at 100%
    for (let i = 0; i < prog.completedCount; i++) {
      drawPartialOperation2D(ctx, scaledOps[i], 1, center, xf, avgScale);
    }
    // Draw currently animating vector operation at parametric progress activeT
    if (prog.activeIndex >= 0) {
      drawPartialOperation2D(
        ctx,
        scaledOps[prog.activeIndex],
        prog.activeT,
        center,
        xf,
        avgScale
      );
    }
    ctx.restore();

    // Clean subtle editorial watermark footer
    ctx.save();
    ctx.fillStyle = surface.isDark
      ? 'rgba(250, 248, 242, 0.72)'
      : 'rgba(24, 24, 27, 0.72)';
    ctx.font = `600 ${Math.round(size * 0.024)}px "Fraunces", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText(titleText, size / 2, size - Math.round(size * 0.032));
    ctx.restore();

    if (options.onProgress) {
      options.onProgress(Math.round(((f + 1) / totalFrames) * 100));
    }

    await new Promise((r) => setTimeout(r, frameDelayMs));
  }

  recorder.stop();
  const blob = await stopPromise;
  const filename = 'alpona-studio-timelapse-1080p.webm';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return { blob, filename, width: size, height: size };
}
