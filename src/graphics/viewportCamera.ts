import type { Point2D } from './types';

export const MIN_CANVAS_ZOOM = 1.0;
export const MAX_CANVAS_ZOOM = 4.0;

export interface CanvasViewport {
  zoom: number; // 1.0 .. 4.0
  panX: number; // logical canvas pixels (0 = centered)
  panY: number; // logical canvas pixels (0 = centered)
}

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = {
  zoom: 1.0,
  panX: 0,
  panY: 0,
};

export interface StageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Clamps zoom to [1.0, 4.0] and bounds pan offsets so the canvas frame never
 * pans completely out of the stage viewport.
 */
export function clampCanvasViewport(
  viewport: CanvasViewport,
  canvasSize: number
): CanvasViewport {
  const zoom = Math.max(
    MIN_CANVAS_ZOOM,
    Math.min(MAX_CANVAS_ZOOM, Number(viewport.zoom.toFixed(3)))
  );
  if (zoom <= 1.0001) {
    return { zoom: 1.0, panX: 0, panY: 0 };
  }
  const maxPan = (canvasSize * (zoom - 1)) / (2 * zoom);
  return {
    zoom,
    panX: Math.max(-maxPan, Math.min(maxPan, viewport.panX)),
    panY: Math.max(-maxPan, Math.min(maxPan, viewport.panY)),
  };
}

/**
 * Adjusts zoom to `nextZoom` while keeping `anchorCanvasPt` fixed at the exact
 * same visual position inside the stage container.
 */
export function zoomCanvasViewportAtPoint(
  current: CanvasViewport,
  nextZoom: number,
  anchorCanvasPt: Point2D,
  canvasSize: number
): CanvasViewport {
  const clampedNext = Math.max(
    MIN_CANVAS_ZOOM,
    Math.min(MAX_CANVAS_ZOOM, nextZoom)
  );
  if (clampedNext <= 1.0001) {
    return { zoom: 1.0, panX: 0, panY: 0 };
  }

  const half = canvasSize / 2;
  // Visual offset from stage center before zoom:
  // v = (anchor - half + pan) * zoom
  const vx = (anchorCanvasPt.x - half + current.panX) * current.zoom;
  const vy = (anchorCanvasPt.y - half + current.panY) * current.zoom;

  // Solve for nextPan so (anchor - half + nextPan) * clampedNext === v
  const nextPanX = vx / clampedNext - (anchorCanvasPt.x - half);
  const nextPanY = vy / clampedNext - (anchorCanvasPt.y - half);

  return clampCanvasViewport(
    { zoom: clampedNext, panX: nextPanX, panY: nextPanY },
    canvasSize
  );
}

/**
 * Pans the viewport by a screen-pixel delta `(deltaScreenX, deltaScreenY)`.
 */
export function panCanvasViewportByScreenDelta(
  current: CanvasViewport,
  deltaScreenX: number,
  deltaScreenY: number,
  stageWidth: number,
  canvasSize: number
): CanvasViewport {
  if (current.zoom <= 1.0001 || stageWidth <= 0) {
    return { zoom: 1.0, panX: 0, panY: 0 };
  }
  const cssToCanvas = canvasSize / stageWidth;
  return clampCanvasViewport(
    {
      zoom: current.zoom,
      panX: current.panX + (deltaScreenX * cssToCanvas) / current.zoom,
      panY: current.panY + (deltaScreenY * cssToCanvas) / current.zoom,
    },
    canvasSize
  );
}

/**
 * Exact inverse of the stage CSS transform `scale(zoom) translate(panX, panY)`:
 * maps any pointer `(clientX, clientY)` inside the stage box back to logical
 * `[0..canvasSize)` pixel coordinates.
 */
export function screenToCanvasWithViewport(
  clientX: number,
  clientY: number,
  stageRect: StageRect,
  viewport: CanvasViewport,
  canvasSize: number
): Point2D {
  const w = Math.max(1, stageRect.width);
  const h = Math.max(1, stageRect.height);
  const half = canvasSize / 2;

  const normX = ((clientX - stageRect.left) / w - 0.5) * canvasSize;
  const normY = ((clientY - stageRect.top) / h - 0.5) * canvasSize;

  const zoom = Math.max(MIN_CANVAS_ZOOM, viewport.zoom);
  const canvasX = normX / zoom - viewport.panX + half;
  const canvasY = normY / zoom - viewport.panY + half;

  return {
    x: Math.max(0, Math.min(canvasSize - 1, Math.round(canvasX))),
    y: Math.max(0, Math.min(canvasSize - 1, Math.round(canvasY))),
  };
}

/**
 * Forward projection from logical canvas coordinates to normalized stage
 * percentages [0..100], useful for tests and verification.
 */
export function canvasToStageNormalized(
  canvasPt: Point2D,
  viewport: CanvasViewport,
  canvasSize: number
): Point2D {
  const half = canvasSize / 2;
  const vx = (canvasPt.x - half + viewport.panX) * viewport.zoom + half;
  const vy = (canvasPt.y - half + viewport.panY) * viewport.zoom + half;
  return { x: vx / canvasSize, y: vy / canvasSize };
}
