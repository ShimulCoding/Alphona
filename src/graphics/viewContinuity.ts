import type { StudioView } from '../components/HeaderBar';

export interface CanvasContinuityTransition {
  fromView: StudioView;
  toView: StudioView;
  direction: -1 | 0 | 1;
  offsetX: number;
  offsetY: number;
  initialScale: number;
  initialRotateXDeg: number;
  durationSec: number;
  continuityLabel: string;
}

const VIEW_PIPELINE_ORDER: Record<StudioView, number> = {
  studio: 0,
  'image-lab': 1,
  '3d-view': 2,
  'floor-print': 3,
  algorithms: 4,
  cpp: 5,
};

const CORE_CANVAS_VIEWS = new Set<StudioView>([
  'studio',
  'image-lab',
  '3d-view',
]);

/**
 * Computes deterministic spatial continuity parameters when switching between
 * 'studio', 'image-lab', and '3d-view' (as well as auxiliary views) so the
 * user perceives the 2D drafting canvas, image processing lab, and 3D courtyard
 * projection as one continuous physical artwork.
 */
export function getCanvasContinuityTransition(
  fromView: StudioView,
  toView: StudioView
): CanvasContinuityTransition {
  const fromIdx = VIEW_PIPELINE_ORDER[fromView] ?? 0;
  const toIdx = VIEW_PIPELINE_ORDER[toView] ?? 0;
  const direction: -1 | 0 | 1 =
    toIdx > fromIdx ? 1 : toIdx < fromIdx ? -1 : 0;

  const isCoreCanvasSwitch =
    CORE_CANVAS_VIEWS.has(fromView) && CORE_CANVAS_VIEWS.has(toView);

  const offsetX = direction * (isCoreCanvasSwitch ? 14 : 8);
  const offsetY = toView === '3d-view' ? 10 : 6;
  const initialScale =
    toView === '3d-view' ? 0.978 : isCoreCanvasSwitch ? 0.986 : 0.992;
  const initialRotateXDeg =
    toView === '3d-view' ? 5 : fromView === '3d-view' ? -4 : 0;

  let continuityLabel = 'Studio workspace stage';
  if (fromView === 'studio' && toView === 'image-lab') {
    continuityLabel = '2D Alpona Canvas → Image Processing Lab';
  } else if (fromView === 'image-lab' && toView === '3d-view') {
    continuityLabel = 'Image Processing Lab → 3D Courtyard Projection';
  } else if (fromView === 'studio' && toView === '3d-view') {
    continuityLabel = '2D Alpona Canvas → 3D Courtyard Projection';
  } else if (fromView === '3d-view' && toView === 'studio') {
    continuityLabel = '3D Courtyard Projection → 2D Alpona Canvas';
  } else if (fromView === 'image-lab' && toView === 'studio') {
    continuityLabel = 'Image Processing Lab → 2D Alpona Canvas';
  } else if (fromView === '3d-view' && toView === 'image-lab') {
    continuityLabel = '3D Courtyard Projection → Image Processing Lab';
  }

  return {
    fromView,
    toView,
    direction,
    offsetX,
    offsetY,
    initialScale,
    initialRotateXDeg,
    durationSec: 0.24,
    continuityLabel,
  };
}
