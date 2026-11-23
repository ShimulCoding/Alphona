import { extractPrintableStencil } from './imageProcessing';
import type { PixelSurface } from './rasterizer';

export interface StencilBridge {
  islandId: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  distancePx: number;
  widthPx: number;
}

export interface StencilBridgeResult {
  originalStencil: PixelSurface;
  diagnosticView: PixelSurface; // Floating islands tinted crimson, bridges tinted emerald
  bridgedStencil: PixelSurface; // Cut-ready B&W stencil (black = cut out, white = intact sheet)
  layerA: PixelSurface; // Zero-bridge 2-layer split (outer & odd rings)
  layerB: PixelSurface; // Zero-bridge 2-layer split (inner & even rings)
  initialIslandCount: number;
  remainingIslandCount: number;
  bridges: StencilBridge[];
  islandPixelCount: number;
}

/**
 * Helper: classifies stencil pixels into sheet material (1 = white intact material)
 * vs cut-out strokes (0 = black cut-out opening).
 */
function buildMaterialMask(stencil: PixelSurface): Uint8Array {
  const n = stencil.width * stencil.height;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const off = i * 4;
    const lum =
      0.299 * stencil.data[off] +
      0.587 * stencil.data[off + 1] +
      0.114 * stencil.data[off + 2];
    mask[i] = lum >= 145 ? 1 : 0;
  }
  return mask;
}

/**
 * CSE 402 Week 13: 8-Connected Component Labeling (BFS) on stencil sheet material.
 * Any material component touching the outer border is anchored (frame);
 * any interior material component completely surrounded by cut lines is a floating "island"!
 */
export function labelStencilComponents(
  mask: Uint8Array,
  width: number,
  height: number
): {
  labels: Int32Array;
  anchored: Uint8Array;
  componentCount: number;
  islandIds: number[];
  islandPixelCount: number;
} {
  const total = width * height;
  const labels = new Int32Array(total);
  const queue = new Int32Array(total);
  const anchoredList: boolean[] = [false]; // 1-indexed
  let compId = 0;

  const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy = [-1, -1, -1, 0, 0, 1, 1, 1];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 0 || labels[idx] !== 0) continue;

      compId++;
      let touchesBorder = false;
      let head = 0;
      let tail = 0;
      queue[tail++] = idx;
      labels[idx] = compId;

      while (head < tail) {
        const cur = queue[head++];
        const cx = cur % width;
        const cy = (cur - cx) / width;
        if (cx === 0 || cy === 0 || cx === width - 1 || cy === height - 1) {
          touchesBorder = true;
        }
        for (let k = 0; k < 8; k++) {
          const nx = cx + dx[k];
          const ny = cy + dy[k];
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (mask[nIdx] === 1 && labels[nIdx] === 0) {
            labels[nIdx] = compId;
            queue[tail++] = nIdx;
          }
        }
      }

      anchoredList.push(touchesBorder);
    }
  }

  const anchored = new Uint8Array(compId + 1);
  const islandIds: number[] = [];
  for (let id = 1; id <= compId; id++) {
    if (anchoredList[id]) {
      anchored[id] = 1;
    } else {
      islandIds.push(id);
    }
  }

  let islandPixelCount = 0;
  for (let i = 0; i < total; i++) {
    const id = labels[i];
    if (id > 0 && anchored[id] === 0) {
      islandPixelCount++;
    }
  }

  return { labels, anchored, componentCount: compId, islandIds, islandPixelCount };
}

function carveMaterialBridge(
  mask: Uint8Array,
  bridgeMask: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  bridgeWidth: number
): void {
  const half = Math.max(1, Math.floor(bridgeWidth / 2));
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(x0 + (x1 - x0) * t);
    const cy = Math.round(y0 + (y1 - y0) * t);
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        if (dx * dx + dy * dy > half * half + 1) continue;
        const px = cx + dx;
        const py = cy + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = py * width + px;
          mask[idx] = 1;
          bridgeMask[idx] = 1;
        }
      }
    }
  }
}

/**
 * Full Laser / Cricut Stencil Island Detector & Auto-Bridger (CSE 402 CLO-6):
 *  1. Extracts binary stencil (white = physical sheet material, black = laser cut opening).
 *  2. Labels 8-connected components via BFS to find every floating interior island.
 *  3. Iteratively connects each floating island to the nearest anchored component using
 *     shortest Euclidean distance (D_e) bridges (plus optional symmetric opposite bridges)
 *     until remainingIslandCount === 0!
 *  4. Also builds a 2-layer zero-bridge stencil split (Layer A + Layer B) with corner crosshairs.
 */
export function analyzeAndBridgeStencil(
  sourceAlpona: PixelSurface,
  bridgeWidthPx = 6,
  symmetricDualBridge = true,
  threshold = 44
): StencilBridgeResult {
  const originalStencil = extractPrintableStencil(sourceAlpona, threshold);
  const { width, height } = originalStencil;
  const total = width * height;

  const initialMask = buildMaterialMask(originalStencil);

  // Physically accurate laser/Cricut cleanup: tiny disconnected specks (< 10 px)
  // inside cut lines vaporize under a cutter and should not spawn noisy bridges.
  const rawComp = labelStencilComponents(initialMask, width, height);
  if (rawComp.islandIds.length > 0) {
    const areas = new Int32Array(rawComp.componentCount + 1);
    for (let i = 0; i < total; i++) {
      const id = rawComp.labels[i];
      if (id > 0) areas[id]++;
    }
    for (let i = 0; i < total; i++) {
      const id = rawComp.labels[i];
      if (id > 0 && rawComp.anchored[id] === 0 && areas[id] < 10) {
        initialMask[i] = 0;
      }
    }
  }

  const initialComp = labelStencilComponents(initialMask, width, height);

  // Working mask that receives physical material bridges
  const bridgedMask = new Uint8Array(initialMask);
  const bridgePixels = new Uint8Array(total);
  const bridges: StencilBridge[] = [];

  const halfW = width / 2;
  const halfH = height / 2;
  const safeBridgeW = Math.max(3, Math.min(16, Math.round(bridgeWidthPx)));

  // Iteratively anchor islands ring-by-ring via cut-gap-only multi-source BFS
  const maxPasses = 32;
  for (let pass = 0; pass < maxPasses; pass++) {
    const comp = labelStencilComponents(bridgedMask, width, height);
    if (comp.islandIds.length === 0) break;

    // Multi-source BFS from ALL currently anchored pixels to find nearest anchor for every pixel
    const dist = new Int32Array(total);
    dist.fill(-1);
    const nearestAnchor = new Int32Array(total);
    nearestAnchor.fill(-1);
    const q = new Int32Array(total);
    let head = 0;
    let tail = 0;

    for (let i = 0; i < total; i++) {
      const id = comp.labels[i];
      if (id > 0 && comp.anchored[id] === 1) {
        dist[i] = 0;
        nearestAnchor[i] = i;
        q[tail++] = i;
      }
    }

    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ];

    // Best bridge candidate per island component
    const bestIslandIdx = new Int32Array(comp.componentCount + 1);
    const bestAnchorIdx = new Int32Array(comp.componentCount + 1);
    const bestDist = new Int32Array(comp.componentCount + 1);
    bestDist.fill(1e9);

    while (head < tail) {
      const cur = q[head++];
      const curD = dist[cur];
      const cx = cur % width;
      const cy = (cur - cx) / width;
      const anc = nearestAnchor[cur];

      for (let d = 0; d < 8; d++) {
        const nx = cx + dirs[d][0];
        const ny = cy + dirs[d][1];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        const nComp = comp.labels[nIdx];
        if (nComp > 0 && comp.anchored[nComp] === 0) {
          const ax = anc % width;
          const ay = (anc - ax) / width;
          const euclidSq = (nx - ax) * (nx - ax) + (ny - ay) * (ny - ay);
          if (euclidSq < bestDist[nComp]) {
            bestDist[nComp] = euclidSq;
            bestIslandIdx[nComp] = nIdx;
            bestAnchorIdx[nComp] = anc;
          }
          // Do NOT propagate wavefront through an unanchored island — bridge ring-by-ring!
          continue;
        }
        // Propagate BFS only across cut-out pixels (bridgedMask === 0)
        if (bridgedMask[nIdx] === 0 && dist[nIdx] === -1) {
          dist[nIdx] = curD + 1;
          nearestAnchor[nIdx] = anc;
          q[tail++] = nIdx;
        }
      }
    }

    // Carve shortest bridges for all reachable floating islands in this pass
    let carvedAny = false;
    for (const islId of comp.islandIds) {
      if (bestDist[islId] >= 1e9) continue;
      const iIdx = bestIslandIdx[islId];
      const aIdx = bestAnchorIdx[islId];
      const ix = iIdx % width;
      const iy = (iIdx - ix) / width;
      const ax = aIdx % width;
      const ay = (aIdx - ax) / width;
      const dPx = Number(Math.hypot(ix - ax, iy - ay).toFixed(1));

      carveMaterialBridge(bridgedMask, bridgePixels, width, height, ix, iy, ax, ay, safeBridgeW);
      bridges.push({
        islandId: islId,
        fromX: ix,
        fromY: iy,
        toX: ax,
        toY: ay,
        distancePx: dPx,
        widthPx: safeBridgeW,
      });
      carvedAny = true;

      // Optional symmetric twin bridge across center for balanced aesthetic stencil support
      if (symmetricDualBridge) {
        const mx0 = Math.max(0, Math.min(width - 1, Math.round(2 * halfW - ix)));
        const my0 = Math.max(0, Math.min(height - 1, Math.round(2 * halfH - iy)));
        const mx1 = Math.max(0, Math.min(width - 1, Math.round(2 * halfW - ax)));
        const my1 = Math.max(0, Math.min(height - 1, Math.round(2 * halfH - ay)));
        if (Math.hypot(mx0 - ix, my0 - iy) > safeBridgeW * 2) {
          carveMaterialBridge(bridgedMask, bridgePixels, width, height, mx0, my0, mx1, my1, safeBridgeW);
        }
      }
    }

    if (!carvedAny) break;
  }

  const finalComp = labelStencilComponents(bridgedMask, width, height);

  // Build diagnostic view (crimson = original floating islands, emerald = newly added bridges)
  const diagData = new Uint8ClampedArray(total * 4);
  const bridgedData = new Uint8ClampedArray(total * 4);
  for (let i = 0; i < total; i++) {
    const off = i * 4;
    const origId = initialComp.labels[i];
    const wasIsland = origId > 0 && initialComp.anchored[origId] === 0;
    const isBridge = bridgePixels[i] === 1;

    // Cut-ready B&W bridged stencil
    const v = bridgedMask[i] === 1 ? 250 : 20;
    bridgedData[off] = v;
    bridgedData[off + 1] = v;
    bridgedData[off + 2] = v;
    bridgedData[off + 3] = 255;

    // Diagnostic overlay
    if (isBridge) {
      diagData[off] = 16;
      diagData[off + 1] = 185;
      diagData[off + 2] = 129; // Emerald bridge highlight
      diagData[off + 3] = 255;
    } else if (wasIsland) {
      diagData[off] = 220;
      diagData[off + 1] = 38;
      diagData[off + 2] = 38; // Crimson floating island highlight
      diagData[off + 3] = 255;
    } else if (initialMask[i] === 1) {
      diagData[off] = 248;
      diagData[off + 1] = 247;
      diagData[off + 2] = 243;
      diagData[off + 3] = 255;
    } else {
      diagData[off] = 24;
      diagData[off + 1] = 24;
      diagData[off + 2] = 27;
      diagData[off + 3] = 255;
    }
  }

  // Build 2-Layer Zero-Bridge Stencil Split (alternating concentric radial bands + red registration +)
  const layerAData = new Uint8ClampedArray(total * 4);
  const layerBData = new Uint8ClampedArray(total * 4);
  const maxR = Math.min(halfW, halfH);
  const bandW = Math.max(18, maxR / 6);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const off = idx * 4;
      const isCut = initialMask[idx] === 0;
      const r = Math.hypot(x - halfW, y - halfH);
      const band = Math.floor(r / bandW);
      const cutInA = isCut && (band & 1) === 0;
      const cutInB = isCut && (band & 1) === 1;

      const va = cutInA ? 20 : 250;
      layerAData[off] = va;
      layerAData[off + 1] = va;
      layerAData[off + 2] = va;
      layerAData[off + 3] = 255;

      const vb = cutInB ? 20 : 250;
      layerBData[off] = vb;
      layerBData[off + 1] = vb;
      layerBData[off + 2] = vb;
      layerBData[off + 3] = 255;
    }
  }

  // Stamp crimson registration crosshairs on both layers so they align perfectly on the floor/vinyl
  const crossCorners = [
    { x: 18, y: 18 },
    { x: width - 19, y: 18 },
    { x: 18, y: height - 19 },
    { x: width - 19, y: height - 19 },
  ];
  for (const buf of [layerAData, layerBData]) {
    for (const c of crossCorners) {
      for (let d = -8; d <= 8; d++) {
        const hIdx = (c.y * width + (c.x + d)) * 4;
        const vIdx = ((c.y + d) * width + c.x) * 4;
        buf[hIdx] = 185;
        buf[hIdx + 1] = 28;
        buf[hIdx + 2] = 28;
        buf[vIdx] = 185;
        buf[vIdx + 1] = 28;
        buf[vIdx + 2] = 28;
      }
    }
  }

  return {
    originalStencil,
    diagnosticView: { width, height, data: diagData },
    bridgedStencil: { width, height, data: bridgedData },
    layerA: { width, height, data: layerAData },
    layerB: { width, height, data: layerBData },
    initialIslandCount: initialComp.islandIds.length,
    remainingIslandCount: finalComp.islandIds.length,
    bridges,
    islandPixelCount: initialComp.islandPixelCount,
  };
}
