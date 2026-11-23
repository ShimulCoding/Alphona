import {
  clearSurface,
  executeOperation,
  type RenderOptions,
  type RenderResult,
} from './engine';
import type { PixelSurface } from './rasterizer';
import type { DrawOperation, PipelineMetrics } from './types';

export interface CommittedFrameCache {
  width: number;
  height: number;
  backgroundHex: string;
  optionsKey: string;
  excludeOpId: string | null;
  operationsRef: DrawOperation[] | null;
  operationsLength: number;
  basePixels: Uint8ClampedArray | null;
  baseMetrics: PipelineMetrics | null;
  cacheHits: number;
  fullRebuilds: number;
}

export function createCommittedFrameCache(): CommittedFrameCache {
  return {
    width: 0,
    height: 0,
    backgroundHex: '',
    optionsKey: '',
    excludeOpId: null,
    operationsRef: null,
    operationsLength: -1,
    basePixels: null,
    baseMetrics: null,
    cacheHits: 0,
    fullRebuilds: 0,
  };
}

export function invalidateFrameCache(cache: CommittedFrameCache): void {
  cache.operationsRef = null;
  cache.basePixels = null;
  cache.baseMetrics = null;
}

function buildOptionsSignature(options: RenderOptions): string {
  const la = options.lineAlgorithm ?? 'bresenham';
  const cw = options.clippingWindow;
  const cwKey = cw
    ? `${cw.enabled ? 1 : 0}:${cw.inset}:${cw.algorithm}:${cw.polygonAlgorithm ?? 'sh'}`
    : '0';
  const tr = options.transform2D;
  const trKey = tr
    ? `${tr.translateX},${tr.translateY},${tr.scaleX},${tr.scaleY},${tr.rotateDeg},${tr.shearX},${tr.shearY},${tr.flipX ? 1 : 0},${tr.flipY ? 1 : 0}`
    : 'id';
  return `${la}|${cwKey}|${trKey}`;
}

function createZeroMetrics(visibleCount: number): PipelineMetrics {
  return {
    operationsCount: visibleCount,
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
}

/**
 * Renders the scene using a Committed Framebuffer Cache:
 * - When `operations`, `backgroundHex`, `options`, dimensions, and `excludeOpId`
 *   match the cached committed base, copies `basePixels` in O(W*H) typed-array memcpy
 *   and rasterizes ONLY `previewOp` on top (60fps even with 100+ strokes).
 * - Whenever committed history or pipeline options change, rebuilds the base cache once.
 */
export function renderWithFrameCache(
  cache: CommittedFrameCache,
  surface: PixelSurface,
  backgroundHex: string,
  operations: DrawOperation[],
  previewOp?: DrawOperation | null,
  options: RenderOptions = {},
  excludeOpId: string | null = null
): RenderResult {
  const start =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const optionsKey = buildOptionsSignature(options);

  const cacheValid =
    cache.basePixels !== null &&
    cache.baseMetrics !== null &&
    cache.width === surface.width &&
    cache.height === surface.height &&
    cache.backgroundHex === backgroundHex &&
    cache.optionsKey === optionsKey &&
    cache.excludeOpId === excludeOpId &&
    cache.operationsRef === operations &&
    cache.operationsLength === operations.length;

  let metrics: PipelineMetrics;

  if (cacheValid && cache.basePixels && cache.baseMetrics) {
    surface.data.set(cache.basePixels);
    metrics = { ...cache.baseMetrics };
    cache.cacheHits++;
  } else {
    clearSurface(surface, backgroundHex);
    const visibleCount = operations.reduce(
      (acc, op) => acc + (op.hidden ? 0 : 1),
      0
    );
    metrics = createZeroMetrics(visibleCount);

    for (const op of operations) {
      if (op.hidden) continue;
      if (excludeOpId && op.id === excludeOpId) continue;
      executeOperation(surface, op, metrics, options);
    }

    if (
      !cache.basePixels ||
      cache.basePixels.length !== surface.data.length
    ) {
      cache.basePixels = new Uint8ClampedArray(surface.data.length);
    }
    cache.basePixels.set(surface.data);
    cache.baseMetrics = { ...metrics };
    cache.width = surface.width;
    cache.height = surface.height;
    cache.backgroundHex = backgroundHex;
    cache.optionsKey = optionsKey;
    cache.excludeOpId = excludeOpId;
    cache.operationsRef = operations;
    cache.operationsLength = operations.length;
    cache.fullRebuilds++;
  }

  if (previewOp && !previewOp.hidden) {
    executeOperation(surface, previewOp, metrics, options);
  }

  const end =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  metrics.lastRenderMs = Math.max(0.01, Number((end - start).toFixed(2)));

  return { metrics };
}
