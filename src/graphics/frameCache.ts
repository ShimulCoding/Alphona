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
  incrementalAppends: number;
  snapshotRestores: number;
  /** Recent committed frames (newest last) so Undo can restore a picture instead of redrawing. */
  snapshots: FrameSnapshot[];
  snapshotKey: string;
}

export interface FrameSnapshot {
  operations: DrawOperation[];
  pixels: Uint8ClampedArray;
  metrics: PipelineMetrics;
}

/** Memory kept for Undo snapshots: ~40 frames at 720 px, ~15 at 2x HD (1440 px). */
export const FRAME_SNAPSHOT_BUDGET_BYTES = 128 * 1024 * 1024;
const MAX_FRAME_SNAPSHOTS = 40;

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
    incrementalAppends: 0,
    snapshotRestores: 0,
    snapshots: [],
    snapshotKey: '',
  };
}

export function invalidateFrameCache(cache: CommittedFrameCache): void {
  cache.operationsRef = null;
  cache.basePixels = null;
  cache.baseMetrics = null;
  cache.snapshots = [];
}

function sameOperations(a: DrawOperation[], b: DrawOperation[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Remember the frame just committed (after a full rebuild or an append).
function storeSnapshot(cache: CommittedFrameCache, operations: DrawOperation[]): void {
  if (!cache.basePixels || !cache.baseMetrics) return;
  const max = Math.min(
    MAX_FRAME_SNAPSHOTS,
    Math.max(2, Math.floor(FRAME_SNAPSHOT_BUDGET_BYTES / cache.basePixels.length))
  );
  const kept = cache.snapshots.filter((snap) => !sameOperations(snap.operations, operations));
  kept.push({
    operations,
    pixels: new Uint8ClampedArray(cache.basePixels),
    metrics: { ...cache.baseMetrics },
  });
  cache.snapshots = kept.slice(-max);
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

  // Committing a stroke only appends to the history: when every cached operation is still
  // the same object at the same index, draw just the new operations on the cached frame
  // instead of re-rasterizing the whole scene (O(new strokes) instead of O(all strokes)).
  const cachedOps = cache.operationsRef;
  let appendOnly =
    !cacheValid &&
    cache.basePixels !== null &&
    cache.baseMetrics !== null &&
    cachedOps !== null &&
    cache.width === surface.width &&
    cache.height === surface.height &&
    cache.backgroundHex === backgroundHex &&
    cache.optionsKey === optionsKey &&
    cache.excludeOpId === excludeOpId &&
    operations.length > cache.operationsLength &&
    cachedOps.length === cache.operationsLength;
  for (let i = 0; appendOnly && i < cache.operationsLength; i++) {
    if (operations[i] !== cachedOps![i]) appendOnly = false;
  }

  // Snapshots belong to one background / options / size / exclusion combination.
  const snapshotKey = `${surface.width}x${surface.height}|${backgroundHex}|${optionsKey}|${excludeOpId ?? ''}`;
  if (cache.snapshotKey !== snapshotKey) {
    cache.snapshots = [];
    cache.snapshotKey = snapshotKey;
  }
  // A stored frame is the cheapest path (one copy), so it wins over drawing appended strokes.
  const snapshot = !cacheValid
    ? cache.snapshots.find((snap) => sameOperations(snap.operations, operations))
    : undefined;

  let metrics: PipelineMetrics;

  if (snapshot) {
    // Undo / redo to a recent state: copy its frame back instead of redrawing every stroke.
    surface.data.set(snapshot.pixels);
    metrics = { ...snapshot.metrics };
    if (!cache.basePixels || cache.basePixels.length !== surface.data.length) {
      cache.basePixels = new Uint8ClampedArray(surface.data.length);
    }
    cache.basePixels.set(snapshot.pixels);
    cache.baseMetrics = { ...snapshot.metrics };
    cache.width = surface.width;
    cache.height = surface.height;
    cache.backgroundHex = backgroundHex;
    cache.optionsKey = optionsKey;
    cache.excludeOpId = excludeOpId;
    cache.operationsRef = operations;
    cache.operationsLength = operations.length;
    cache.snapshotRestores++;
  } else if (appendOnly && cache.basePixels && cache.baseMetrics) {
    surface.data.set(cache.basePixels);
    metrics = { ...cache.baseMetrics };
    for (let i = cache.operationsLength; i < operations.length; i++) {
      const op = operations[i];
      if (op.hidden) continue;
      metrics.operationsCount++;
      if (excludeOpId && op.id === excludeOpId) continue;
      executeOperation(surface, op, metrics, options);
    }
    cache.basePixels.set(surface.data);
    cache.baseMetrics = { ...metrics };
    cache.operationsRef = operations;
    cache.operationsLength = operations.length;
    cache.incrementalAppends++;
    storeSnapshot(cache, operations);
  } else if (cacheValid && cache.basePixels && cache.baseMetrics) {
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
    storeSnapshot(cache, operations);
  }

  if (previewOp && !previewOp.hidden) {
    executeOperation(surface, previewOp, metrics, options);
  }

  const end =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  metrics.lastRenderMs = Math.max(0.01, Number((end - start).toFixed(2)));

  return { metrics };
}
