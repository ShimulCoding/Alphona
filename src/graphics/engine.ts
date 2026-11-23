import { sampleCubicBezier } from './bezier';
import { iterativeSeedFill } from './floodfill';
import {
  drawBresenhamCircle,
  drawBresenhamLine,
  drawDdaLine,
  drawPolygonOutline,
  type PixelSurface,
} from './rasterizer';
import {
  computePolylineArcParameters,
  computePressureTaperThickness,
} from './strokeCraft';
import {
  applyMat3,
  buildHomogeneousTransform2D,
  clipLineSegment,
  clipPolygon,
  generateSymmetricPoints,
  generateSymmetricPolygons,
  generateSymmetricSegments,
  isIdentityTransform2D,
} from './transforms';
import {
  DEFAULT_TRANSFORM_2D,
  hexToRgba,
  type ClipBounds,
  type ClippingWindowConfig,
  type DrawOperation,
  type LineAlgorithm,
  type PipelineMetrics,
  type Point2D,
  type Transform2DConfig,
} from './types';

export interface RenderOptions {
  lineAlgorithm?: LineAlgorithm;
  clippingWindow?: ClippingWindowConfig;
  transform2D?: Transform2DConfig;
}

export interface RenderResult {
  metrics: PipelineMetrics;
}

/**
 * Clears the entire RGBA raster buffer to the selected background color.
 */
export function clearSurface(surface: PixelSurface, backgroundHex: string): void {
  const bg = hexToRgba(backgroundHex);
  const { data } = surface;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bg.r;
    data[i + 1] = bg.g;
    data[i + 2] = bg.b;
    data[i + 3] = 255;
  }
}

export function getActiveClipBounds(
  width: number,
  height: number,
  clippingWindow?: ClippingWindowConfig
): ClipBounds {
  if (!clippingWindow || !clippingWindow.enabled) {
    return { xmin: 0, ymin: 0, xmax: width - 1, ymax: height - 1 };
  }
  const maxInset = Math.floor(Math.min(width, height) / 2) - 24;
  const inset = Math.max(0, Math.min(maxInset, Math.round(clippingWindow.inset)));
  return {
    xmin: inset,
    ymin: inset,
    xmax: width - 1 - inset,
    ymax: height - 1 - inset,
  };
}

/**
 * Executes a single DrawOperation through the full CSE 401/402 graphics pipeline:
 *   1. 2D Rotation & Reflection (C_n / D_n symmetry)
 *   2. Global 3x3 Homogeneous 2D Transformation (Translate, Rotate, Scale, Shear)
 *   3. Cohen-Sutherland or Liang-Barsky Line Clipping / Sutherland-Hodgman Polygon Clipping
 *   4. Bresenham or DDA Line, Midpoint Circle, or Iterative Scanline Seed Fill
 */
export function executeOperation(
  surface: PixelSurface,
  op: DrawOperation,
  metrics: PipelineMetrics,
  options: RenderOptions = {}
): void {
  const layerOpacity =
    typeof op.opacity === 'number' && Number.isFinite(op.opacity)
      ? Math.max(0.1, Math.min(1, op.opacity))
      : 1;

  if (layerOpacity < 0.995) {
    if (op.kind === 'fill') {
      // Snapshot before fill so seedFill reads real boundaries, then alpha-blend filled pixels
      const before = new Uint8ClampedArray(surface.data);
      executeOperationOpaque(surface, op, metrics, options);
      const inv = 1 - layerOpacity;
      const dst = surface.data;
      for (let i = 0; i < dst.length; i += 4) {
        if (
          dst[i] !== before[i] ||
          dst[i + 1] !== before[i + 1] ||
          dst[i + 2] !== before[i + 2]
        ) {
          dst[i] = Math.round(dst[i] * layerOpacity + before[i] * inv);
          dst[i + 1] = Math.round(dst[i + 1] * layerOpacity + before[i + 1] * inv);
          dst[i + 2] = Math.round(dst[i + 2] * layerOpacity + before[i + 2] * inv);
          dst[i + 3] = 255;
        }
      }
      return;
    }

    // Rasterize stroke onto transparent scratch surface so overlapping brush disks
    // never double-darken, then Porter-Duff Source-Over composite onto destination.
    const scratch: PixelSurface = {
      width: surface.width,
      height: surface.height,
      data: new Uint8ClampedArray(surface.width * surface.height * 4),
    };
    executeOperationOpaque(scratch, op, metrics, options);
    const inv = 1 - layerOpacity;
    const src = scratch.data;
    const dst = surface.data;
    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] > 0) {
        dst[i] = Math.round(src[i] * layerOpacity + dst[i] * inv);
        dst[i + 1] = Math.round(src[i + 1] * layerOpacity + dst[i + 1] * inv);
        dst[i + 2] = Math.round(src[i + 2] * layerOpacity + dst[i + 2] * inv);
        dst[i + 3] = 255;
      }
    }
    return;
  }

  executeOperationOpaque(surface, op, metrics, options);
}

function executeOperationOpaque(
  surface: PixelSurface,
  op: DrawOperation,
  metrics: PipelineMetrics,
  options: RenderOptions = {}
): void {
  const lineAlgorithm: LineAlgorithm = options.lineAlgorithm ?? 'bresenham';
  const clipAlgorithm = options.clippingWindow?.algorithm ?? 'cohen-sutherland';
  const transform2D = options.transform2D ?? DEFAULT_TRANSFORM_2D;

  const center: Point2D = {
    x: surface.width / 2,
    y: surface.height / 2,
  };
  const bounds = getActiveClipBounds(
    surface.width,
    surface.height,
    options.clippingWindow
  );
  const useMat3 = !isIdentityTransform2D(transform2D);
  const mat3 = useMat3 ? buildHomogeneousTransform2D(transform2D, center) : null;

  const xform = (pt: Point2D): Point2D => (mat3 ? applyMat3(mat3, pt) : pt);
  const rgba = hexToRgba(op.color);

  const rasterLine = (a: Point2D, b: Point2D, thickness: number) => {
    if (lineAlgorithm === 'dda') {
      metrics.ddaLinePixels += drawDdaLine(surface, a.x, a.y, b.x, b.y, rgba, thickness);
    } else {
      metrics.bresenhamLinePixels += drawBresenhamLine(
        surface,
        a.x,
        a.y,
        b.x,
        b.y,
        rgba,
        thickness
      );
    }
  };

  if (op.kind === 'line') {
    const copies = generateSymmetricSegments(op.p0, op.p1, center, op.symmetry);
    for (const seg of copies) {
      metrics.segmentsSubmitted++;
      const t0 = xform(seg.p0);
      const t1 = xform(seg.p1);
      const clipped = clipLineSegment(t0, t1, bounds, clipAlgorithm);
      if (!clipped) {
        metrics.segmentsRejected++;
        continue;
      }
      if (clipped.wasClipped) {
        metrics.segmentsClipped++;
      }
      rasterLine(clipped.p0, clipped.p1, op.thickness);
    }
    return;
  }

  if (op.kind === 'freehand') {
    if (op.points.length === 0) return;
    if (op.points.length === 1) {
      const pts = generateSymmetricPoints(op.points[0], center, op.symmetry);
      for (const pt of pts) {
        metrics.segmentsSubmitted++;
        const tp = xform(pt);
        const clipped = clipLineSegment(tp, tp, bounds, clipAlgorithm);
        if (!clipped) {
          metrics.segmentsRejected++;
          continue;
        }
        rasterLine(clipped.p0, clipped.p1, op.thickness);
      }
      return;
    }

    const hasPressure =
      Array.isArray(op.pressures) && op.pressures.length === op.points.length;
    const arcParams =
      op.tapered || hasPressure ? computePolylineArcParameters(op.points) : null;
    for (let i = 1; i < op.points.length; i++) {
      let segThickness = op.thickness;
      if (op.tapered || hasPressure) {
        const uMid = arcParams ? 0.5 * (arcParams[i - 1] + arcParams[i]) : 0.5;
        const pMid = hasPressure && op.pressures
          ? 0.5 * (op.pressures[i - 1] + op.pressures[i])
          : 0.5;
        segThickness = computePressureTaperThickness(
          op.thickness,
          uMid,
          pMid,
          Boolean(op.tapered)
        );
      }
      const copies = generateSymmetricSegments(
        op.points[i - 1],
        op.points[i],
        center,
        op.symmetry
      );
      for (const seg of copies) {
        metrics.segmentsSubmitted++;
        const t0 = xform(seg.p0);
        const t1 = xform(seg.p1);
        const clipped = clipLineSegment(t0, t1, bounds, clipAlgorithm);
        if (!clipped) {
          metrics.segmentsRejected++;
          continue;
        }
        if (clipped.wasClipped) {
          metrics.segmentsClipped++;
        }
        rasterLine(clipped.p0, clipped.p1, segThickness);
      }
    }
    return;
  }

  if (op.kind === 'polygon') {
    if (op.vertices.length < 3) return;
    const polyAlgo = options.clippingWindow?.polygonAlgorithm ?? 'sutherland-hodgman';
    const copies = generateSymmetricPolygons(op.vertices, center, op.symmetry);
    for (const poly of copies) {
      const transformed = poly.map(xform);
      const clippedPolys = clipPolygon(transformed, bounds, polyAlgo);
      if (clippedPolys.length === 0) {
        metrics.segmentsRejected += poly.length;
        continue;
      }
      if (
        clippedPolys.length > 1 ||
        clippedPolys[0].length !== transformed.length ||
        clippedPolys[0].some(
          (v, idx) =>
            Math.abs(v.x - transformed[idx].x) > 1e-4 ||
            Math.abs(v.y - transformed[idx].y) > 1e-4
        )
      ) {
        metrics.polygonsClipped++;
      }
      for (const clipped of clippedPolys) {
        metrics.segmentsSubmitted += clipped.length;
        const px = drawPolygonOutline(
          surface,
          clipped,
          rgba,
          op.thickness,
          lineAlgorithm
        );
        if (lineAlgorithm === 'dda') {
          metrics.ddaLinePixels += px;
        } else {
          metrics.bresenhamLinePixels += px;
        }
      }
    }
    return;
  }

  if (op.kind === 'circle') {
    const centers = generateSymmetricPoints(op.center, center, op.symmetry);
    const seen = new Set<string>();
    const hasNonUniformOrShear =
      Math.abs(transform2D.scaleX - transform2D.scaleY) > 1e-3 ||
      Math.abs(transform2D.shearX) > 1e-3 ||
      Math.abs(transform2D.shearY) > 1e-3;
    const clipActive = Boolean(options.clippingWindow?.enabled);

    for (const cPt of centers) {
      const key = `${Math.round(cPt.x)},${Math.round(cPt.y)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // When non-uniform scale, shear, or inner clipping window is active,
      // approximate the circle as a closed 48-gon so it transforms & clips accurately!
      if (hasNonUniformOrShear || clipActive) {
        const segs = 48;
        const poly: Point2D[] = [];
        for (let k = 0; k < segs; k++) {
          const ang = (2 * Math.PI * k) / segs;
          poly.push(
            xform({
              x: cPt.x + Math.cos(ang) * op.radius,
              y: cPt.y + Math.sin(ang) * op.radius,
            })
          );
        }
        for (let k = 0; k < segs; k++) {
          const a = poly[k];
          const b = poly[(k + 1) % segs];
          metrics.segmentsSubmitted++;
          const clipped = clipLineSegment(a, b, bounds, clipAlgorithm);
          if (!clipped) {
            metrics.segmentsRejected++;
            continue;
          }
          if (clipped.wasClipped) metrics.segmentsClipped++;
          rasterLine(clipped.p0, clipped.p1, op.thickness);
        }
      } else {
        const tc = xform(cPt);
        const scaledRadius = op.radius * Math.abs(transform2D.scaleX);
        metrics.midpointCirclePixels += drawBresenhamCircle(
          surface,
          tc.x,
          tc.y,
          scaledRadius,
          rgba,
          op.thickness
        );
      }
    }
    return;
  }

  if (op.kind === 'bezier') {
    const sampled = sampleCubicBezier(op.p0, op.p1, op.p2, op.p3, 28);
    for (let i = 1; i < sampled.length; i++) {
      const copies = generateSymmetricSegments(
        sampled[i - 1],
        sampled[i],
        center,
        op.symmetry
      );
      for (const seg of copies) {
        metrics.segmentsSubmitted++;
        const t0 = xform(seg.p0);
        const t1 = xform(seg.p1);
        const clipped = clipLineSegment(t0, t1, bounds, clipAlgorithm);
        if (!clipped) {
          metrics.segmentsRejected++;
          continue;
        }
        if (clipped.wasClipped) {
          metrics.segmentsClipped++;
        }
        rasterLine(clipped.p0, clipped.p1, op.thickness);
      }
    }
    return;
  }

  if (op.kind === 'fill') {
    const seeds = op.symmetric
      ? generateSymmetricPoints(op.seed, center, op.symmetry)
      : [op.seed];
    const seen = new Set<string>();
    for (const pt of seeds) {
      const tp = xform(pt);
      if (
        tp.x < bounds.xmin ||
        tp.x > bounds.xmax ||
        tp.y < bounds.ymin ||
        tp.y > bounds.ymax
      ) {
        continue;
      }
      const key = `${Math.round(tp.x)},${Math.round(tp.y)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      metrics.seedFillPixels += iterativeSeedFill(surface, tp.x, tp.y, rgba);
    }
  }
}

/**
 * Replays the full command history onto a PixelSurface from a clean background.
 */
export function renderScene(
  surface: PixelSurface,
  backgroundHex: string,
  operations: DrawOperation[],
  previewOp?: DrawOperation | null,
  options: RenderOptions = {}
): RenderResult {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  clearSurface(surface, backgroundHex);

  const metrics: PipelineMetrics = {
    operationsCount: operations.reduce((acc, op) => acc + (op.hidden ? 0 : 1), 0),
    bresenhamLinePixels: 0,
    ddaLinePixels: 0,
    midpointCirclePixels: 0,
    seedFillPixels: 0,
    segmentsSubmitted: 0,
    segmentsClipped: 0,
    segmentsRejected: 0,
    polygonsClipped: 0,
    lastRenderMs: 0,
  };

  for (const op of operations) {
    if (op.hidden) continue;
    executeOperation(surface, op, metrics, options);
  }

  if (previewOp && !previewOp.hidden) {
    executeOperation(surface, previewOp, metrics, options);
  }

  const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
  metrics.lastRenderMs = Math.max(0.01, Number((end - start).toFixed(2)));

  return { metrics };
}
