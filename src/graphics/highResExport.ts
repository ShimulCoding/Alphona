import { getActiveClipBounds, renderScene, type RenderOptions } from './engine';
import type { PixelSurface } from './rasterizer';
import {
  computePolylineArcParameters,
  computePressureTaperThickness,
} from './strokeCraft';
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

export const ULTRA_HD_EXPORT_SIZE = 2880; // 4x native 720px -> 2880x2880 (8.3 MP 4K UHD)
export const PRINT_STENCIL_EXPORT_SIZE = 2400; // 300 DPI @ 8"x8" print stencil

/**
 * Pure helper: uniformly scales all vector & seed-fill DrawOperation coordinates
 * and stroke weights from logical canvas space (e.g. 720) to high-res target space.
 */
export function scaleOperations(
  operations: DrawOperation[],
  scale: number
): DrawOperation[] {
  const s = Math.max(0.25, scale);
  const sp = (p: Point2D): Point2D => ({ x: p.x * s, y: p.y * s });

  return operations.map((op) => {
    if (op.kind === 'line') {
      return {
        ...op,
        p0: sp(op.p0),
        p1: sp(op.p1),
        thickness: Math.max(1, op.thickness * s),
      };
    }
    if (op.kind === 'circle') {
      return {
        ...op,
        center: sp(op.center),
        radius: op.radius * s,
        thickness: Math.max(1, op.thickness * s),
      };
    }
    if (op.kind === 'polygon') {
      return {
        ...op,
        vertices: op.vertices.map(sp),
        thickness: Math.max(1, op.thickness * s),
      };
    }
    if (op.kind === 'freehand') {
      return {
        ...op,
        points: op.points.map(sp),
        thickness: Math.max(1, op.thickness * s),
      };
    }
    if (op.kind === 'bezier') {
      return {
        ...op,
        p0: sp(op.p0),
        p1: sp(op.p1),
        p2: sp(op.p2),
        p3: sp(op.p3),
        thickness: Math.max(1, op.thickness * s),
      };
    }
    // Seed fill
    return {
      ...op,
      seed: sp(op.seed),
    };
  });
}

/**
 * Pure helper: scales RenderOptions (translation offsets & clipping window inset)
 * proportionally to match a high-resolution export buffer.
 */
export function scaleRenderOptions(
  options: RenderOptions,
  scale: number
): RenderOptions {
  const s = Math.max(0.25, scale);
  return {
    ...options,
    clippingWindow: options.clippingWindow
      ? {
          ...options.clippingWindow,
          inset: Math.round(options.clippingWindow.inset * s),
        }
      : undefined,
    transform2D: options.transform2D
      ? {
          ...options.transform2D,
          translateX: options.transform2D.translateX * s,
          translateY: options.transform2D.translateY * s,
        }
      : undefined,
  };
}

function buildScaledClipVertices(
  targetSize: number,
  options: RenderOptions
): Point2D[] | null {
  const cw = options.clippingWindow;
  if (!cw || !cw.enabled) return null;
  const b = getActiveClipBounds(targetSize, targetSize, cw);
  return [
    { x: b.xmin, y: b.ymin },
    { x: b.xmax, y: b.ymin },
    { x: b.xmax, y: b.ymax },
    { x: b.xmin, y: b.ymax },
  ];
}

/**
 * Renders a top-class 4K Ultra-HD (default 2880x2880) anti-aliased Alpona canvas:
 *   1. Exact 2x supersampled raster seed-fill layer (for any filled petals/regions),
 *      composited smoothly onto the target 4K surface.
 *   2. Sub-pixel anti-aliased 4K vector stroke overpass (native bezierCurveTo, arcs,
 *      crisp round-capped lines/polylines & exact Mat3 transform/clipping) so every
 *      curve and boundary has zero pixelation or staircase aliasing.
 *
 * When `monochromeStencil` is true, renders razor-sharp pure black ink (#111111)
 * vector outlines on pure white (#FFFFFF) for 300 DPI printable floor stencils.
 */
export function renderUltraHdAlponaCanvas(
  operations: DrawOperation[],
  surface: CanvasSurface,
  logicalSize: number,
  renderOptions: RenderOptions = {},
  targetSize = ULTRA_HD_EXPORT_SIZE,
  monochromeStencil = false
): HTMLCanvasElement {
  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetSize;
  outCanvas.height = targetSize;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) return outCanvas;

  const scale = targetSize / Math.max(1, logicalSize);
  const scaledOps = scaleOperations(operations, scale);
  const scaledOpts = scaleRenderOptions(renderOptions, scale);

  // Layer 1: Clean background
  ctx.fillStyle = monochromeStencil ? '#FFFFFF' : surface.hex;
  ctx.fillRect(0, 0, targetSize, targetSize);

  // Layer 1b: If the artwork contains flood-fill operations (and we're not exporting a monochrome line stencil),
  // run our exact rasterizer + iterative seed fill at 2x resolution (1440x1440) so every filled petal matches 1:1.
  const hasFills =
    !monochromeStencil && operations.some((op) => !op.hidden && op.kind === 'fill');
  if (hasFills) {
    const fillScale = Math.min(2, scale);
    const fillSize = Math.round(logicalSize * fillScale);
    const fillBuf: PixelSurface = {
      width: fillSize,
      height: fillSize,
      data: new Uint8ClampedArray(fillSize * fillSize * 4),
    };
    renderScene(
      fillBuf,
      surface.hex,
      scaleOperations(operations, fillScale),
      null,
      scaleRenderOptions(renderOptions, fillScale)
    );

    const fillCanvas = document.createElement('canvas');
    fillCanvas.width = fillSize;
    fillCanvas.height = fillSize;
    const fCtx = fillCanvas.getContext('2d');
    if (fCtx) {
      const img = fCtx.createImageData(fillSize, fillSize);
      img.data.set(fillBuf.data);
      fCtx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(fillCanvas, 0, 0, targetSize, targetSize);
    }
  }

  // Layer 2: Razor-sharp sub-pixel anti-aliased vector stroke pass at full targetSize
  ctx.save();
  const clipPoly = buildScaledClipVertices(targetSize, scaledOpts);
  if (clipPoly && clipPoly.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(clipPoly[0].x, clipPoly[0].y);
    for (let i = 1; i < clipPoly.length; i++) {
      ctx.lineTo(clipPoly[i].x, clipPoly[i].y);
    }
    ctx.closePath();
    ctx.clip();
  }

  const center: Point2D = { x: targetSize / 2, y: targetSize / 2 };
  const transform2D = scaledOpts.transform2D ?? DEFAULT_TRANSFORM_2D;
  const mat3 = isIdentityTransform2D(transform2D)
    ? null
    : buildHomogeneousTransform2D(transform2D, center);
  const xf = (pt: Point2D): Point2D => (mat3 ? applyMat3(mat3, pt) : pt);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const op of scaledOps) {
    if (op.hidden || op.kind === 'fill') continue;

    ctx.strokeStyle = monochromeStencil ? '#111111' : op.color;
    // Slight subtle boost in stencil mode so fine lines remain dark & traceable on A4 printers
    ctx.lineWidth = Math.max(
      monochromeStencil ? 2.4 : 1.5,
      op.thickness * (monochromeStencil ? 1.15 : 1.0)
    );

    if (op.kind === 'line') {
      const copies = generateSymmetricSegments(op.p0, op.p1, center, op.symmetry);
      ctx.beginPath();
      for (const seg of copies) {
        const a = xf(seg.p0);
        const b = xf(seg.p1);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    } else if (op.kind === 'circle') {
      const centers = generateSymmetricPoints(op.center, center, op.symmetry);
      const seen = new Set<string>();
      const avgScale =
        (Math.abs(transform2D.scaleX) + Math.abs(transform2D.scaleY)) / 2;
      const r = Math.max(0.5, op.radius * avgScale);
      for (const cPt of centers) {
        const key = `${Math.round(cPt.x)},${Math.round(cPt.y)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const tc = xf(cPt);
        ctx.beginPath();
        ctx.arc(tc.x, tc.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (op.kind === 'polygon') {
      const polys = generateSymmetricPolygons(op.vertices, center, op.symmetry);
      for (const poly of polys) {
        if (poly.length < 2) continue;
        ctx.beginPath();
        const first = xf(poly[0]);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < poly.length; i++) {
          const tp = xf(poly[i]);
          ctx.lineTo(tp.x, tp.y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    } else if (op.kind === 'freehand') {
      if (op.points.length < 2) continue;
      const n = Math.max(1, Math.round(op.symmetry.sectors));
      const hasPressure =
        Array.isArray(op.pressures) && op.pressures.length === op.points.length;
      const arcU =
        op.tapered || hasPressure ? computePolylineArcParameters(op.points) : null;
      const baseLineW = Math.max(
        monochromeStencil ? 2.4 : 1.5,
        op.thickness * (monochromeStencil ? 1.15 : 1.0)
      );

      for (let k = 0; k < n; k++) {
        const theta = (2 * Math.PI * k) / n;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const rot = (p: Point2D): Point2D => {
          const dx = p.x - center.x;
          const dy = p.y - center.y;
          return xf({
            x: center.x + dx * cosT - dy * sinT,
            y: center.y + dx * sinT + dy * cosT,
          });
        };

        if (arcU) {
          for (let i = 1; i < op.points.length; i++) {
            const uMid = (arcU[i - 1] + arcU[i]) * 0.5;
            const pMid =
              hasPressure && op.pressures
                ? (op.pressures[i - 1] + op.pressures[i]) * 0.5
                : 0.5;
            ctx.lineWidth = Math.max(
              1.2,
              computePressureTaperThickness(
                baseLineW,
                uMid,
                pMid,
                Boolean(op.tapered)
              )
            );
            const a = rot(op.points[i - 1]);
            const b = rot(op.points[i]);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();

            if (op.symmetry.reflect) {
              const ma = rot({
                x: 2 * center.x - op.points[i - 1].x,
                y: op.points[i - 1].y,
              });
              const mb = rot({
                x: 2 * center.x - op.points[i].x,
                y: op.points[i].y,
              });
              ctx.beginPath();
              ctx.moveTo(ma.x, ma.y);
              ctx.lineTo(mb.x, mb.y);
              ctx.stroke();
            }
          }
        } else {
          ctx.lineWidth = baseLineW;
          ctx.beginPath();
          const p0 = rot(op.points[0]);
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < op.points.length; i++) {
            const pi = rot(op.points[i]);
            ctx.lineTo(pi.x, pi.y);
          }
          ctx.stroke();

          if (op.symmetry.reflect) {
            ctx.beginPath();
            const m0 = rot({ x: 2 * center.x - op.points[0].x, y: op.points[0].y });
            ctx.moveTo(m0.x, m0.y);
            for (let i = 1; i < op.points.length; i++) {
              const mi = rot({
                x: 2 * center.x - op.points[i].x,
                y: op.points[i].y,
              });
              ctx.lineTo(mi.x, mi.y);
            }
            ctx.stroke();
          }
        }
      }
    } else if (op.kind === 'bezier') {
      const n = Math.max(1, Math.round(op.symmetry.sectors));
      for (let k = 0; k < n; k++) {
        const theta = (2 * Math.PI * k) / n;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const rot = (p: Point2D): Point2D => {
          const dx = p.x - center.x;
          const dy = p.y - center.y;
          return xf({
            x: center.x + dx * cosT - dy * sinT,
            y: center.y + dx * sinT + dy * cosT,
          });
        };

        const b0 = rot(op.p0);
        const b1 = rot(op.p1);
        const b2 = rot(op.p2);
        const b3 = rot(op.p3);
        ctx.beginPath();
        ctx.moveTo(b0.x, b0.y);
        ctx.bezierCurveTo(b1.x, b1.y, b2.x, b2.y, b3.x, b3.y);
        ctx.stroke();

        if (op.symmetry.reflect) {
          const mir = (p: Point2D): Point2D =>
            rot({ x: 2 * center.x - p.x, y: p.y });
          const m0 = mir(op.p0);
          const m1 = mir(op.p1);
          const m2 = mir(op.p2);
          const m3 = mir(op.p3);
          ctx.beginPath();
          ctx.moveTo(m0.x, m0.y);
          ctx.bezierCurveTo(m1.x, m1.y, m2.x, m2.y, m3.x, m3.y);
          ctx.stroke();
        }
      }
    }
  }

  ctx.restore();
  return outCanvas;
}

/**
 * Convenience helper returning a PixelSurface from the Ultra-HD renderer
 * (used by Full-HD Virtual Floor Try-On & 300 DPI A4 Floor Stencil exports).
 */
export function renderUltraHdAlponaSurface(
  operations: DrawOperation[],
  surface: CanvasSurface,
  logicalSize: number,
  renderOptions: RenderOptions = {},
  targetSize = 1440,
  monochromeStencil = false
): PixelSurface {
  const canvas = renderUltraHdAlponaCanvas(
    operations,
    surface,
    logicalSize,
    renderOptions,
    targetSize,
    monochromeStencil
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      width: targetSize,
      height: targetSize,
      data: new Uint8ClampedArray(targetSize * targetSize * 4),
    };
  }
  const img = ctx.getImageData(0, 0, targetSize, targetSize);
  return {
    width: targetSize,
    height: targetSize,
    data: new Uint8ClampedArray(img.data),
  };
}
