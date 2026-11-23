import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  FileCode2,
  FlipHorizontal2,
  FolderOpen,
  Frame,
  Pause,
  Play,
  Printer,
  Redo2,
  Save,
  Trash2,
  Undo2,
  Video,
} from 'lucide-react';
import {
  buildArchBezierFromEndpoints,
  deCasteljauSubdivision,
} from '../graphics/bezier';
import { getActiveClipBounds } from '../graphics/engine';
import {
  createCommittedFrameCache,
  renderWithFrameCache,
  type CommittedFrameCache,
} from '../graphics/frameCache';
import {
  FESTIVAL_GREETING_PRESETS,
  type GreetingCardOptions,
} from '../graphics/exportCard';
import {
  buildConcaveStarPetalPolygon,
  buildDiamondPetalPolygon,
} from '../graphics/rasterizer';
import {
  snapPointToSymmetryGuides,
  type SnapConfig,
  type SnapResult,
} from '../graphics/canvasAssist';
import {
  findNearestBezierOp,
  hitTestOperationAtPoint,
  type BezierHandleKey,
  type ReferenceUnderlayConfig,
} from '../graphics/layerStack';
import { computeOperationBounds } from '../graphics/layerTransform';
import {
  resamplePressuresForStabilized,
  stabilizeStrokePoints,
} from '../graphics/strokeCraft';
import {
  buildHomogeneousTransform2D,
  computeSymmetryReflectionAxes,
  generateSymmetricPoints,
  isIdentityTransform2D,
} from '../graphics/transforms';
import {
  scaleOperations,
  scaleRenderOptions,
} from '../graphics/highResExport';
import {
  computePinchGesture,
  isTwoFingerQuickTap,
} from '../graphics/touchGestures';
import {
  DEFAULT_CANVAS_VIEWPORT,
  panCanvasViewportByScreenDelta,
  screenToCanvasWithViewport,
  zoomCanvasViewportAtPoint,
  type CanvasViewport,
} from '../graphics/viewportCamera';
import { BezierHandleOverlay } from './BezierHandleOverlay';
import { CanvasViewportBar } from './CanvasViewportBar';
import { LayerTransformOverlay } from './LayerTransformOverlay';
import type {
  CanvasSurface,
  ClippingWindowConfig,
  DrawingTool,
  DrawOperation,
  LineAlgorithm,
  PipelineMetrics,
  Point2D,
  PolygonShapeMode,
  SymmetryConfig,
  Transform2DConfig,
} from '../graphics/types';

export const CANVAS_SIZE = 720;

interface AlponaCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  surface: CanvasSurface;
  tool: DrawingTool;
  polygonShape: PolygonShapeMode;
  bezierCurvature: number;
  showDeCasteljau: boolean;
  color: string;
  thickness: number;
  stabilizerLevel: number;
  taperedBrush: boolean;
  symmetry: SymmetryConfig;
  symmetricFill: boolean;
  showGuides: boolean;
  showSymmetryAxes: boolean;
  snapConfig: SnapConfig;
  referenceUnderlay: ReferenceUnderlayConfig;
  lineAlgorithm: LineAlgorithm;
  clippingWindow: ClippingWindowConfig;
  transform2D: Transform2DConfig;
  operations: DrawOperation[];
  totalOperationsCount: number;
  isReplaying: boolean;
  canUndo: boolean;
  canRedo: boolean;
  greetingCard: GreetingCardOptions;
  projectError: string | null;
  selectedLayerId: string | null;
  hdPreview: boolean;
  onToggleHdPreview: () => void;
  onSelectLayer: (id: string | null) => void;
  onCommitBezierHandle: (
    id: string,
    handle: BezierHandleKey,
    nextPoint: Point2D
  ) => void;
  onCommitLayerTransform: (nextOp: DrawOperation) => void;
  onCommitOperation: (op: DrawOperation) => void;
  onDeleteOperation: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onToggleGuides: () => void;
  onToggleSymmetryAxes: () => void;
  onChangeSnapConfig: (next: SnapConfig) => void;
  onToggleReplay: () => void;
  onSaveProject: () => void;
  onLoadProjectFile: (file: File) => void;
  onExportStencil: () => void;
  onExportSvg: () => void;
  onExportReel: () => void;
  reelProgress: number | null;
  onChangeGreetingCard: (next: GreetingCardOptions) => void;
  onMetricsUpdate: (metrics: PipelineMetrics) => void;
}

export function AlponaCanvas({
  canvasRef,
  surface,
  tool,
  polygonShape,
  bezierCurvature,
  showDeCasteljau,
  color,
  thickness,
  stabilizerLevel,
  taperedBrush,
  symmetry,
  symmetricFill,
  showGuides,
  showSymmetryAxes,
  snapConfig,
  referenceUnderlay,
  lineAlgorithm,
  clippingWindow,
  transform2D,
  operations,
  totalOperationsCount,
  isReplaying,
  canUndo,
  canRedo,
  greetingCard,
  projectError,
  selectedLayerId,
  hdPreview,
  onToggleHdPreview,
  onSelectLayer,
  onCommitBezierHandle,
  onCommitLayerTransform,
  onCommitOperation,
  onDeleteOperation,
  onUndo,
  onRedo,
  onClear,
  onToggleGuides,
  onToggleSymmetryAxes,
  onChangeSnapConfig,
  onToggleReplay,
  onSaveProject,
  onLoadProjectFile,
  onExportStencil,
  onExportSvg,
  onExportReel,
  reelProgress,
  onChangeGreetingCard,
  onMetricsUpdate,
}: AlponaCanvasProps) {
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const frameCacheRef = useRef<CommittedFrameCache>(createCommittedFrameCache());
  const loadInputRef = useRef<HTMLInputElement | null>(null);
  const activeOpRef = useRef<DrawOperation | null>(null);
  const rawFreehandPointsRef = useRef<Point2D[]>([]);
  const rawFreehandPressuresRef = useRef<number[]>([]);
  const polygonAnchorRef = useRef<Point2D | null>(null);
  const compassLockRadiusRef = useRef<number | null>(null);
  const isPointerDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanClientRef = useRef<{ x: number; y: number } | null>(null);
  const activeTouchesRef = useRef<
    Map<number, { x: number; y: number; startX: number; startY: number }>
  >(new Map());
  const twoFingerStartMsRef = useRef<number>(0);
  const twoFingerMaxTravelRef = useRef<number>(0);
  const isPinchingRef = useRef(false);

  const [viewport, setViewport] = useState<CanvasViewport>(DEFAULT_CANVAS_VIEWPORT);
  const [panMode, setPanMode] = useState(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [cursorCoord, setCursorCoord] = useState<Point2D | null>(null);
  const [activeSnap, setActiveSnap] = useState<SnapResult | null>(null);
  const [isDrawingVisual, setIsDrawingVisual] = useState(false);

  const rasterScale = hdPreview ? 2 : 1;
  const renderPixelSize = CANVAS_SIZE * rasterScale;

  const scaledOperations = useMemo(
    () => (rasterScale === 1 ? operations : scaleOperations(operations, rasterScale)),
    [operations, rasterScale]
  );

  const scaledRenderOptions = useMemo(() => {
    const baseOpts = { lineAlgorithm, clippingWindow, transform2D };
    return rasterScale === 1
      ? baseOpts
      : scaleRenderOptions(baseOpts, rasterScale);
  }, [lineAlgorithm, clippingWindow, transform2D, rasterScale]);

  // Spacebar temporary pan + keyboard zoom (+ / - / 0)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.code === 'Space') {
        setIsSpaceHeld(true);
      } else if (e.key === '+' || e.key === '=') {
        setViewport((vp) =>
          zoomCanvasViewportAtPoint(
            vp,
            vp.zoom + 0.5,
            { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 },
            CANVAS_SIZE
          )
        );
      } else if (e.key === '-') {
        setViewport((vp) =>
          zoomCanvasViewportAtPoint(
            vp,
            vp.zoom - 0.5,
            { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 },
            CANVAS_SIZE
          )
        );
      } else if (e.key === '0') {
        setViewport(DEFAULT_CANVAS_VIEWPORT);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Sync pixel raster buffer using CommittedFrameCache (720px native or 1440px 2x HD)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (
      !imageDataRef.current ||
      imageDataRef.current.width !== renderPixelSize ||
      imageDataRef.current.height !== renderPixelSize
    ) {
      imageDataRef.current = ctx.createImageData(renderPixelSize, renderPixelSize);
    }

    const previewScaled =
      activeOpRef.current && rasterScale !== 1
        ? scaleOperations([activeOpRef.current], rasterScale)[0]
        : activeOpRef.current;

    const { metrics } = renderWithFrameCache(
      frameCacheRef.current,
      {
        width: renderPixelSize,
        height: renderPixelSize,
        data: imageDataRef.current.data,
      },
      surface.hex,
      scaledOperations,
      previewScaled,
      scaledRenderOptions
    );

    ctx.putImageData(imageDataRef.current, 0, 0);
    onMetricsUpdate(metrics);
  }, [
    scaledOperations,
    scaledRenderOptions,
    renderPixelSize,
    rasterScale,
    surface.hex,
    canvasRef,
    onMetricsUpdate,
  ]);

  const flushPreview = (
    previewOp: DrawOperation | null,
    excludeOpId: string | null = null
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (
      !imageDataRef.current ||
      imageDataRef.current.width !== renderPixelSize ||
      imageDataRef.current.height !== renderPixelSize
    ) {
      imageDataRef.current = ctx.createImageData(renderPixelSize, renderPixelSize);
    }

    const previewScaled =
      previewOp && rasterScale !== 1
        ? scaleOperations([previewOp], rasterScale)[0]
        : previewOp;

    const { metrics } = renderWithFrameCache(
      frameCacheRef.current,
      {
        width: renderPixelSize,
        height: renderPixelSize,
        data: imageDataRef.current.data,
      },
      surface.hex,
      scaledOperations,
      previewScaled,
      scaledRenderOptions,
      excludeOpId
    );
    ctx.putImageData(imageDataRef.current, 0, 0);
    onMetricsUpdate(metrics);
  };

  const pointerToCanvas = (e: React.PointerEvent<HTMLCanvasElement>): Point2D => {
    const stageEl = stageContainerRef.current ?? canvasRef.current!;
    const rect = stageEl.getBoundingClientRect();
    return screenToCanvasWithViewport(
      e.clientX,
      e.clientY,
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      viewport,
      CANVAS_SIZE
    );
  };

  const resolveDrawingPoint = (
    rawPt: Point2D,
    shiftHeld: boolean,
    lockRadius: number | null
  ): SnapResult => {
    if (tool === 'eraser' || tool === 'fill') {
      return {
        point: rawPt,
        snappedAxisAngleDeg: null,
        snappedRingRadius: null,
        lockedRadius: null,
        wasSnapped: false,
      };
    }
    const effectiveLock =
      lockRadius !== null
        ? lockRadius
        : snapConfig.compassArcLock || shiftHeld
          ? Math.hypot(rawPt.x - CANVAS_SIZE / 2, rawPt.y - CANVAS_SIZE / 2)
          : null;
    return snapPointToSymmetryGuides(
      rawPt,
      CANVAS_SIZE,
      symmetry,
      snapConfig,
      effectiveLock
    );
  };

  const isPanningActive = panMode || isSpaceHeld;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') {
      activeTouchesRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
      });
      if (activeTouchesRef.current.size === 2) {
        // Cancel any in-progress single-finger stroke so pinch/2-finger tap stays clean
        if (isPointerDownRef.current) {
          isPointerDownRef.current = false;
          activeOpRef.current = null;
          setIsDrawingVisual(false);
          flushPreview(null);
        }
        isPinchingRef.current = true;
        twoFingerStartMsRef.current = Date.now();
        twoFingerMaxTravelRef.current = 0;
        return;
      }
    }

    if (e.button !== 0 && e.button !== 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    // Panning via Hand mode, Spacebar, or middle mouse button
    if (isPanningActive || e.button === 1) {
      isPanningRef.current = true;
      lastPanClientRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const rawPt = pointerToCanvas(e);

    if (tool === 'edit') {
      setCursorCoord(rawPt);
      setActiveSnap(null);
      const hitBez = findNearestBezierOp(operations, rawPt, CANVAS_SIZE, 22);
      if (hitBez) {
        onSelectLayer(hitBez.id);
        return;
      }
      const hitAny = hitTestOperationAtPoint(operations, rawPt, CANVAS_SIZE, 18, false);
      if (hitAny) {
        onSelectLayer(hitAny.id);
      }
      return;
    }

    if (tool === 'eraser') {
      setCursorCoord(rawPt);
      setActiveSnap(null);
      const hit = hitTestOperationAtPoint(operations, rawPt, CANVAS_SIZE, 16, true);
      if (hit) {
        onDeleteOperation(hit.id);
      }
      return;
    }

    if (tool === 'fill') {
      setCursorCoord(rawPt);
      setActiveSnap(null);
      const fillOp: DrawOperation = {
        id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'fill',
        seed: rawPt,
        color,
        symmetric: symmetricFill,
        symmetry: { ...symmetry },
        group: 'Motifs',
      };
      onCommitOperation(fillOp);
      return;
    }

    const initialLock =
      snapConfig.compassArcLock || e.shiftKey
        ? Math.hypot(rawPt.x - CANVAS_SIZE / 2, rawPt.y - CANVAS_SIZE / 2)
        : null;
    compassLockRadiusRef.current = initialLock;
    const snapped = resolveDrawingPoint(rawPt, e.shiftKey, initialLock);
    const pt = snapped.point;
    setCursorCoord(pt);
    setActiveSnap(snapped.wasSnapped ? snapped : null);

    isPointerDownRef.current = true;
    setIsDrawingVisual(true);
    const id = `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (tool === 'freehand') {
      const pressureVal =
        e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
      rawFreehandPointsRef.current = [pt];
      rawFreehandPressuresRef.current = [pressureVal];
      activeOpRef.current = {
        id,
        kind: 'freehand',
        points: [pt],
        pressures: e.pointerType === 'pen' ? [pressureVal] : undefined,
        color,
        thickness,
        tapered: taperedBrush,
        symmetry: { ...symmetry },
        group: 'Motifs',
      };
    } else if (tool === 'line') {
      activeOpRef.current = {
        id,
        kind: 'line',
        p0: pt,
        p1: pt,
        color,
        thickness,
        symmetry: { ...symmetry },
      };
    } else if (tool === 'circle') {
      activeOpRef.current = {
        id,
        kind: 'circle',
        center: pt,
        radius: 0,
        color,
        thickness,
        symmetry: { ...symmetry },
      };
    } else if (tool === 'polygon') {
      polygonAnchorRef.current = pt;
      const tip = { x: pt.x + 10, y: pt.y + 10 };
      activeOpRef.current = {
        id,
        kind: 'polygon',
        vertices:
          polygonShape === 'concave-star'
            ? buildConcaveStarPetalPolygon(pt, tip)
            : buildDiamondPetalPolygon(pt, tip),
        color,
        thickness,
        symmetry: { ...symmetry },
      };
    } else if (tool === 'bezier') {
      const arch = buildArchBezierFromEndpoints(
        pt,
        { x: pt.x + 8, y: pt.y + 8 },
        bezierCurvature
      );
      activeOpRef.current = {
        id,
        kind: 'bezier',
        p0: arch.p0,
        p1: arch.p1,
        p2: arch.p2,
        p3: arch.p3,
        color,
        thickness,
        symmetry: { ...symmetry },
        showDeCasteljau,
      };
    }

    flushPreview(activeOpRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch' && activeTouchesRef.current.has(e.pointerId)) {
      const prevEntry = activeTouchesRef.current.get(e.pointerId)!;
      const travel = Math.hypot(
        e.clientX - prevEntry.startX,
        e.clientY - prevEntry.startY
      );
      if (travel > twoFingerMaxTravelRef.current) {
        twoFingerMaxTravelRef.current = travel;
      }

      if (isPinchingRef.current && activeTouchesRef.current.size === 2) {
        const entries = Array.from(activeTouchesRef.current.entries());
        const other = entries.find(([pid]) => pid !== e.pointerId);
        if (other) {
          const p1Prev = { x: prevEntry.x, y: prevEntry.y };
          const p2Prev = { x: other[1].x, y: other[1].y };
          const p1Curr = { x: e.clientX, y: e.clientY };
          const p2Curr = { x: other[1].x, y: other[1].y };
          const gesture = computePinchGesture(p1Prev, p2Prev, p1Curr, p2Curr);

          const stageEl = stageContainerRef.current ?? canvasRef.current!;
          const rect = stageEl.getBoundingClientRect();
          const anchor = screenToCanvasWithViewport(
            gesture.midpoint.x,
            gesture.midpoint.y,
            rect,
            viewport,
            CANVAS_SIZE
          );
          setViewport((vp) => {
            const zoomed = zoomCanvasViewportAtPoint(
              vp,
              vp.zoom * gesture.scaleRatio,
              anchor,
              CANVAS_SIZE
            );
            return panCanvasViewportByScreenDelta(
              zoomed,
              gesture.midpointDeltaX,
              gesture.midpointDeltaY,
              rect.width,
              CANVAS_SIZE
            );
          });
        }
        activeTouchesRef.current.set(e.pointerId, {
          ...prevEntry,
          x: e.clientX,
          y: e.clientY,
        });
        return;
      }

      activeTouchesRef.current.set(e.pointerId, {
        ...prevEntry,
        x: e.clientX,
        y: e.clientY,
      });
    }

    if (isPanningRef.current && lastPanClientRef.current) {
      const stageEl = stageContainerRef.current ?? canvasRef.current!;
      const rect = stageEl.getBoundingClientRect();
      const dx = e.clientX - lastPanClientRef.current.x;
      const dy = e.clientY - lastPanClientRef.current.y;
      lastPanClientRef.current = { x: e.clientX, y: e.clientY };
      setViewport((vp) =>
        panCanvasViewportByScreenDelta(vp, dx, dy, rect.width, CANVAS_SIZE)
      );
      return;
    }

    const rawPt = pointerToCanvas(e);
    const snapped = resolveDrawingPoint(
      rawPt,
      e.shiftKey,
      isPointerDownRef.current ? compassLockRadiusRef.current : null
    );
    const pt = snapped.point;
    setCursorCoord(pt);
    setActiveSnap(snapped.wasSnapped ? snapped : null);

    if (!isPointerDownRef.current || !activeOpRef.current) return;

    const current = activeOpRef.current;
    if (current.kind === 'freehand') {
      const raw = rawFreehandPointsRef.current;
      const last = raw[raw.length - 1] ?? current.points[current.points.length - 1];
      const distSq = (pt.x - last.x) ** 2 + (pt.y - last.y) ** 2;
      if (distSq < 4) return;
      const pressureVal =
        e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
      raw.push(pt);
      rawFreehandPressuresRef.current.push(pressureVal);
      const nextPts =
        stabilizerLevel > 0 ? stabilizeStrokePoints(raw, stabilizerLevel) : [...raw];
      current.points = nextPts;
      if (e.pointerType === 'pen' || current.pressures) {
        current.pressures = resamplePressuresForStabilized(
          rawFreehandPressuresRef.current,
          nextPts.length
        );
      }
    } else if (current.kind === 'line') {
      current.p1 = pt;
    } else if (current.kind === 'circle') {
      const dx = pt.x - current.center.x;
      const dy = pt.y - current.center.y;
      current.radius = Math.round(Math.hypot(dx, dy));
    } else if (current.kind === 'polygon' && polygonAnchorRef.current) {
      current.vertices =
        polygonShape === 'concave-star'
          ? buildConcaveStarPetalPolygon(polygonAnchorRef.current, pt)
          : buildDiamondPetalPolygon(polygonAnchorRef.current, pt);
    } else if (current.kind === 'bezier') {
      const arch = buildArchBezierFromEndpoints(current.p0, pt, bezierCurvature);
      current.p1 = arch.p1;
      current.p2 = arch.p2;
      current.p3 = arch.p3;
    }

    flushPreview(current);
  };

  const finalizeStroke = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e && e.pointerType === 'touch') {
      activeTouchesRef.current.delete(e.pointerId);
      if (isPinchingRef.current && activeTouchesRef.current.size === 0) {
        const duration = Date.now() - twoFingerStartMsRef.current;
        isPinchingRef.current = false;
        if (isTwoFingerQuickTap(duration, twoFingerMaxTravelRef.current)) {
          onUndo();
        }
        return;
      }
      if (isPinchingRef.current) {
        return;
      }
    }
    if (isPanningRef.current) {
      isPanningRef.current = false;
      lastPanClientRef.current = null;
      return;
    }
    compassLockRadiusRef.current = null;
    if (!isPointerDownRef.current || !activeOpRef.current) return;
    let finished = activeOpRef.current;
    if (finished.kind === 'freehand' && rawFreehandPointsRef.current.length >= 2) {
      const stabilized = stabilizeStrokePoints(
        rawFreehandPointsRef.current,
        stabilizerLevel
      );
      const hasPenPressure = rawFreehandPressuresRef.current.some(
        (p) => Math.abs(p - 0.5) > 0.02
      );
      finished = {
        ...finished,
        points: stabilized,
        pressures: hasPenPressure
          ? resamplePressuresForStabilized(
              rawFreehandPressuresRef.current,
              stabilized.length
            )
          : undefined,
        tapered: taperedBrush,
      };
    }
    activeOpRef.current = null;
    rawFreehandPointsRef.current = [];
    rawFreehandPressuresRef.current = [];
    polygonAnchorRef.current = null;
    isPointerDownRef.current = false;
    setIsDrawingVisual(false);
    onCommitOperation(finished);
  };

  const handleStageWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey && !e.altKey) return;
    e.preventDefault();
    const stageEl = stageContainerRef.current;
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    const anchor = screenToCanvasWithViewport(
      e.clientX,
      e.clientY,
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      viewport,
      CANVAS_SIZE
    );
    const step = e.deltaY < 0 ? 0.35 : -0.35;
    setViewport((vp) =>
      zoomCanvasViewportAtPoint(vp, vp.zoom + step, anchor, CANVAS_SIZE)
    );
  };

  const wedgeDeg = (360 / symmetry.sectors).toFixed(1);
  const totalCopies = symmetry.reflect ? symmetry.sectors * 2 : symmetry.sectors;
  const groupNotation = symmetry.reflect
    ? `Dihedral D${symmetry.sectors}`
    : `Cyclic C${symmetry.sectors}`;

  const clipBounds = getActiveClipBounds(CANVAS_SIZE, CANVAS_SIZE, clippingWindow);

  // Symmetry guide radial rays computed for the SVG overlay (when Mirror Axes is off)
  const guideLines: Array<{ x2: number; y2: number; isPrimary: boolean }> = [];
  if (showGuides && !showSymmetryAxes) {
    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const r = CANVAS_SIZE * 0.49;
    const rayCount = symmetry.reflect ? symmetry.sectors * 2 : symmetry.sectors;
    for (let k = 0; k < rayCount; k++) {
      const angle = (2 * Math.PI * k) / rayCount;
      guideLines.push({
        x2: cx + Math.cos(angle) * r,
        y2: cy + Math.sin(angle) * r,
        isPrimary: k % (symmetry.reflect ? 2 : 1) === 0,
      });
    }
  }

  const reflectionAxes = useMemo(
    () =>
      showSymmetryAxes
        ? computeSymmetryReflectionAxes(CANVAS_SIZE, symmetry)
        : [],
    [showSymmetryAxes, symmetry]
  );

  const mirroredCursorPoints = useMemo(() => {
    if (!showSymmetryAxes || !cursorCoord) return [];
    const center = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };
    return generateSymmetricPoints(cursorCoord, center, symmetry);
  }, [showSymmetryAxes, cursorCoord, symmetry]);

  return (
    <section
      aria-label="Alpona drawing canvas"
      className="flex flex-col gap-3"
    >
      {/* Precision Zoom, Pan, Hi-DPI & Magnetic Snap Bar */}
      <CanvasViewportBar
        viewport={viewport}
        panMode={panMode}
        hdPreview={hdPreview}
        snapConfig={snapConfig}
        onZoomStep={(delta) =>
          setViewport((vp) =>
            zoomCanvasViewportAtPoint(
              vp,
              vp.zoom + delta,
              { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 },
              CANVAS_SIZE
            )
          )
        }
        onResetViewport={() => setViewport(DEFAULT_CANVAS_VIEWPORT)}
        onTogglePanMode={() => setPanMode((p) => !p)}
        onToggleHdPreview={onToggleHdPreview}
        onChangeSnapConfig={onChangeSnapConfig}
      />

      {/* Interactive Stage Container */}
      <div
        className={`relative mx-auto w-full max-w-[680px] ${
          greetingCard.enabled
            ? 'rounded-lg border-2 border-[#B91C1C]/35 bg-[#FAF8F3] p-5 sm:p-7 shadow-sm'
            : 'rounded-lg border border-zinc-300/90 bg-white p-2 sm:p-3 shadow-sm'
        }`}
      >
        <div
          ref={stageContainerRef}
          onWheel={handleStageWheel}
          data-testid="alpona-stage-viewport"
          data-zoom={viewport.zoom.toFixed(2)}
          className={`relative aspect-square w-full overflow-hidden rounded-[4px] ${
            greetingCard.enabled
              ? 'ring-1 ring-[#B91C1C]/25'
              : 'ring-1 ring-zinc-900/10'
          }`}
        >
          <div
            className="relative h-full w-full origin-center will-change-transform"
            style={{
              transform: `scale(${viewport.zoom}) translate(${(viewport.panX / CANVAS_SIZE) * 100}%, ${(viewport.panY / CANVAS_SIZE) * 100}%)`,
            }}
          >
            <canvas
              ref={canvasRef}
              width={renderPixelSize}
              height={renderPixelSize}
              data-testid="alpona-canvas"
              data-resolution={renderPixelSize}
              data-operations={operations.length}
              data-sectors={symmetry.sectors}
              data-reflect={symmetry.reflect ? 'true' : 'false'}
              data-tool={tool}
              data-line-algo={lineAlgorithm}
              data-clip-enabled={clippingWindow.enabled ? 'true' : 'false'}
              data-clip-algo={clippingWindow.algorithm}
              data-show-axes={showSymmetryAxes ? 'true' : 'false'}
              data-snap-axis={snapConfig.snapToAxis ? 'true' : 'false'}
              data-snap-ring={snapConfig.snapToRing ? 'true' : 'false'}
              data-compass-lock={snapConfig.compassArcLock ? 'true' : 'false'}
              data-zoom={viewport.zoom.toFixed(2)}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => finalizeStroke(e)}
              onPointerCancel={(e) => finalizeStroke(e)}
              onPointerLeave={() => {
                setCursorCoord(null);
                setActiveSnap(null);
              }}
              className={`block h-full w-full touch-none select-none ${
                isPanningActive
                  ? 'cursor-grab active:cursor-grabbing'
                  : tool === 'fill'
                    ? 'cursor-cell'
                    : tool === 'eraser'
                      ? 'cursor-pointer'
                      : 'cursor-crosshair'
              }`}
            />

            {/* Optional Reference Photo Tracing Underlay (excluded from exports) */}
            {referenceUnderlay.dataUrl && referenceUnderlay.visible && (
              <img
                src={referenceUnderlay.dataUrl}
                alt="Tracing reference underlay"
                data-testid="reference-underlay-image"
                className="pointer-events-none absolute inset-0 h-full w-full object-contain select-none"
                style={{
                  opacity: referenceUnderlay.opacity,
                  mixBlendMode: surface.isDark ? 'screen' : 'multiply',
                  transform: `scale(${referenceUnderlay.scale}) rotate(${referenceUnderlay.rotateDeg}deg)`,
                }}
              />
            )}

            {/* Non-interactive SVG symmetry reflection axes, guides, snap halo, de Casteljau hull, group selection & Clipping Window overlay */}
            {(showGuides ||
              showSymmetryAxes ||
              clippingWindow.enabled ||
              (showDeCasteljau && tool === 'bezier') ||
              Boolean(activeSnap) ||
              (tool === 'eraser' && Boolean(cursorCoord))) && (
              <svg
                aria-hidden="true"
                viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
              {showGuides && (
                <>
                  {[120, 240, 330].map((radius) => (
                    <circle
                      key={radius}
                      cx={CANVAS_SIZE / 2}
                      cy={CANVAS_SIZE / 2}
                      r={radius}
                      fill="none"
                      stroke={surface.guideHex}
                      strokeWidth="1"
                      strokeDasharray="4 6"
                    />
                  ))}
                  {guideLines.map((line, idx) => (
                    <line
                      key={idx}
                      x1={CANVAS_SIZE / 2}
                      y1={CANVAS_SIZE / 2}
                      x2={line.x2}
                      y2={line.y2}
                      stroke={surface.guideHex}
                      strokeWidth={line.isPrimary ? '1.1' : '0.8'}
                      strokeDasharray={line.isPrimary ? undefined : '3 5'}
                    />
                  ))}
                  <circle
                    cx={CANVAS_SIZE / 2}
                    cy={CANVAS_SIZE / 2}
                    r="4"
                    fill="none"
                    stroke={surface.accentHex}
                    strokeWidth="1.5"
                  />
                </>
              )}

              {/* Real-time Dashed Symmetry Reflection Axes Overlay */}
              {showSymmetryAxes && (
                <g
                  data-testid="symmetry-axes-overlay"
                  data-axes-mode={symmetry.reflect ? 'dihedral' : 'cyclic'}
                  data-axes-count={reflectionAxes.length}
                >
                  {reflectionAxes.map((axis, idx) => (
                    <line
                      key={idx}
                      data-axis-type={
                        axis.isReflectionMirror ? 'reflection' : 'rotational'
                      }
                      x1={axis.x1}
                      y1={axis.y1}
                      x2={axis.x2}
                      y2={axis.y2}
                      stroke={surface.accentHex}
                      strokeWidth={
                        axis.isReflectionMirror
                          ? axis.isPrimary
                            ? '1.5'
                            : '1.1'
                          : axis.isPrimary
                            ? '1.4'
                            : '1.05'
                      }
                      strokeOpacity={
                        axis.isReflectionMirror
                          ? axis.isPrimary
                            ? '0.82'
                            : '0.52'
                          : axis.isPrimary
                            ? '0.78'
                            : '0.5'
                      }
                      strokeDasharray={
                        axis.isReflectionMirror
                          ? axis.isPrimary
                            ? '9 6'
                            : '4 6'
                          : '6 6'
                      }
                      strokeLinecap="round"
                    />
                  ))}

                  {/* Center symmetry origin reticle */}
                  <circle
                    cx={CANVAS_SIZE / 2}
                    cy={CANVAS_SIZE / 2}
                    r="6"
                    fill="none"
                    stroke={surface.accentHex}
                    strokeWidth="1.4"
                    strokeOpacity="0.9"
                  />
                  <circle
                    cx={CANVAS_SIZE / 2}
                    cy={CANVAS_SIZE / 2}
                    r="2"
                    fill={surface.accentHex}
                    fillOpacity="0.9"
                  />

                  {/* Fundamental alignment wedge angle markers (0 deg and first mirror/sector ray) */}
                  {reflectionAxes.slice(0, 2).map((axis, idx) => {
                    const rad = (axis.angleDeg * Math.PI) / 180;
                    const labelR = CANVAS_SIZE * 0.455;
                    const lx = CANVAS_SIZE / 2 + Math.cos(rad) * labelR;
                    const ly = CANVAS_SIZE / 2 + Math.sin(rad) * labelR;
                    const angleText = `${Number(axis.angleDeg.toFixed(1))}°`;
                    return (
                      <text
                        key={`lbl-${idx}`}
                        x={lx}
                        y={ly - 6}
                        textAnchor="middle"
                        fontSize="11"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                        fontWeight="600"
                        fill={surface.accentHex}
                        fillOpacity="0.88"
                      >
                        {angleText}
                      </text>
                    );
                  })}

                  {/* Live symmetric cursor alignment indicators while hovering */}
                  {mirroredCursorPoints.map((pt, idx) => (
                    <circle
                      key={`cur-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={idx === 0 ? '4' : '2.8'}
                      fill="none"
                      stroke={surface.accentHex}
                      strokeWidth={idx === 0 ? '1.4' : '1.1'}
                      strokeOpacity={idx === 0 ? '0.9' : '0.62'}
                    />
                  ))}
                </g>
              )}

              {/* Magnetic Snap & Compass Lock Live Visual Feedback */}
              {activeSnap && activeSnap.wasSnapped && (
                <g data-testid="magnetic-snap-indicator">
                  {activeSnap.snappedRingRadius !== null && (
                    <circle
                      cx={CANVAS_SIZE / 2}
                      cy={CANVAS_SIZE / 2}
                      r={activeSnap.snappedRingRadius}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="1.6"
                      strokeOpacity="0.82"
                      strokeDasharray="6 5"
                    />
                  )}
                  <circle
                    cx={activeSnap.point.x}
                    cy={activeSnap.point.y}
                    r="8"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2"
                  />
                  <circle
                    cx={activeSnap.point.x}
                    cy={activeSnap.point.y}
                    r="2.5"
                    fill="#10B981"
                  />
                </g>
              )}

              {/* Hit-Test Eraser Reticle */}
              {tool === 'eraser' && cursorCoord && (
                <circle
                  cx={cursorCoord.x}
                  cy={cursorCoord.y}
                  r="12"
                  fill="rgba(220, 38, 38, 0.12)"
                  stroke="#DC2626"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              )}

              {/* Educational de Casteljau control polygon & tangent at t = 0.5 for latest Bezier */}
              {showDeCasteljau &&
                tool === 'bezier' &&
                (() => {
                  const lastBez = [...operations]
                    .reverse()
                    .find((op) => op.kind === 'bezier');
                  if (!lastBez || lastBez.kind !== 'bezier') return null;
                  const dc = deCasteljauSubdivision(
                    lastBez.p0,
                    lastBez.p1,
                    lastBez.p2,
                    lastBez.p3,
                    0.5
                  );
                  return (
                    <g>
                      <polyline
                        points={`${lastBez.p0.x},${lastBez.p0.y} ${lastBez.p1.x},${lastBez.p1.y} ${lastBez.p2.x},${lastBez.p2.y} ${lastBez.p3.x},${lastBez.p3.y}`}
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="1.4"
                        strokeDasharray="5 4"
                      />
                      <polyline
                        points={`${dc.q0.x},${dc.q0.y} ${dc.q1.x},${dc.q1.y} ${dc.q2.x},${dc.q2.y}`}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="1.2"
                      />
                      <line
                        x1={dc.r0.x}
                        y1={dc.r0.y}
                        x2={dc.r1.x}
                        y2={dc.r1.y}
                        stroke="#DC2626"
                        strokeWidth="1.8"
                      />
                      {[lastBez.p0, lastBez.p1, lastBez.p2, lastBez.p3].map((p, i) => (
                        <circle
                          key={i}
                          cx={p.x}
                          cy={p.y}
                          r={4}
                          fill={i === 0 || i === 3 ? '#FAF8F2' : '#F59E0B'}
                          stroke="#18181B"
                          strokeWidth="1.2"
                        />
                      ))}
                      <circle cx={dc.point.x} cy={dc.point.y} r={4.5} fill="#DC2626" />
                    </g>
                  );
                })()}

              {/* Active Clipping Window (Cohen-Sutherland / Liang-Barsky / Sutherland-Hodgman / Weiler-Atherton) */}
              {clippingWindow.enabled && (
                <g>
                  <rect
                    x={clipBounds.xmin}
                    y={clipBounds.ymin}
                    width={clipBounds.xmax - clipBounds.xmin}
                    height={clipBounds.ymax - clipBounds.ymin}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2"
                    strokeDasharray="8 5"
                  />
                  {/* Corner registration brackets */}
                  <path
                    d={`M ${clipBounds.xmin} ${clipBounds.ymin + 14} V ${clipBounds.ymin} H ${clipBounds.xmin + 14}`}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="3"
                  />
                  <path
                    d={`M ${clipBounds.xmax - 14} ${clipBounds.ymin} H ${clipBounds.xmax} V ${clipBounds.ymin + 14}`}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="3"
                  />
                  <path
                    d={`M ${clipBounds.xmin} ${clipBounds.ymax - 14} V ${clipBounds.ymax} H ${clipBounds.xmin + 14}`}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="3"
                  />
                  <path
                    d={`M ${clipBounds.xmax - 14} ${clipBounds.ymax} H ${clipBounds.xmax} V ${clipBounds.ymax - 14}`}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="3"
                  />
                </g>
              )}
            </svg>
            )}

            {/* Interactive Post-Placement Editor: Cubic Bézier P0–P3 Handles OR Universal Move/Scale/Rotate Transform Box */}
            {tool === 'edit' &&
              (() => {
                const targetOp =
                  operations.find(
                    (op) => !op.hidden && op.id === selectedLayerId
                  ) ??
                  [...operations]
                    .reverse()
                    .find((op) => !op.hidden && op.kind === 'bezier') ??
                  [...operations].reverse().find((op) => !op.hidden);

                if (!targetOp) return null;

                if (targetOp.kind === 'bezier' && !targetOp.locked) {
                  return (
                    <BezierHandleOverlay
                      bezierOp={targetOp}
                      canvasSize={CANVAS_SIZE}
                      viewport={viewport}
                      stageRef={stageContainerRef}
                      symmetry={symmetry}
                      snapConfig={snapConfig}
                      onPreviewHandle={(id, handle, nextPt) => {
                        const previewBez: DrawOperation = {
                          ...targetOp,
                          [handle]: nextPt,
                        };
                        flushPreview(previewBez, id);
                      }}
                      onCommitHandle={(id, handle, nextPt) => {
                        onCommitBezierHandle(id, handle, nextPt);
                      }}
                      onCancelPreview={() => flushPreview(null, null)}
                    />
                  );
                }

                return (
                  <LayerTransformOverlay
                    op={targetOp}
                    canvasSize={CANVAS_SIZE}
                    viewport={viewport}
                    stageRef={stageContainerRef}
                    onPreviewOp={(nextOp) => {
                      flushPreview(nextOp, nextOp ? targetOp.id : null);
                    }}
                    onCommitOp={(nextOp) => {
                      onCommitLayerTransform(nextOp);
                    }}
                  />
                );
              })()}
          </div>
        </div>

        {/* Festive Greeting Card Footer Caption */}
        {greetingCard.enabled && (
          <div className="mt-5 space-y-2.5 border-t border-[#B91C1C]/15 pt-5 text-center">
            <input
              type="text"
              aria-label="Greeting card headline"
              value={greetingCard.headline}
              onChange={(e) =>
                onChangeGreetingCard({
                  ...greetingCard,
                  headline: e.target.value,
                })
              }
              className="w-full bg-transparent text-center font-display text-2xl font-semibold tracking-tight text-zinc-950 focus:outline-none focus-visible:underline sm:text-3xl"
            />
            <input
              type="text"
              aria-label="Greeting card subtitle"
              value={greetingCard.subtitle}
              onChange={(e) =>
                onChangeGreetingCard({
                  ...greetingCard,
                  subtitle: e.target.value,
                })
              }
              className="w-full bg-transparent text-center text-sm text-zinc-600 focus:outline-none focus-visible:underline"
            />
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1.5">
              {FESTIVAL_GREETING_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    onChangeGreetingCard({
                      ...greetingCard,
                      headline: preset.headline,
                      subtitle: preset.subtitle,
                    })
                  }
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    greetingCard.headline === preset.headline
                      ? 'bg-[#B91C1C] text-white'
                      : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stage Action Toolbar + Quiet Unboxed Telemetry */}
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Redo2 className="h-4 w-4" aria-hidden="true" />
              <span>Redo</span>
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={totalOperationsCount === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Clear</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleSymmetryAxes}
              aria-pressed={showSymmetryAxes}
              title="Toggle real-time dashed symmetry reflection axes (Shortcut: X)"
              className={`inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                showSymmetryAxes
                  ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                  : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <FlipHorizontal2 className="h-4 w-4" aria-hidden="true" />
              <span>Mirror Axes</span>
            </button>
            <button
              type="button"
              onClick={onToggleGuides}
              aria-pressed={showGuides}
              className={`inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                showGuides
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <Compass className="h-4 w-4" aria-hidden="true" />
              <span>Guides</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onChangeGreetingCard({
                  ...greetingCard,
                  enabled: !greetingCard.enabled,
                })
              }
              aria-pressed={greetingCard.enabled}
              className={`inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                greetingCard.enabled
                  ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                  : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <Frame className="h-4 w-4" aria-hidden="true" />
              <span>Greeting Card</span>
            </button>
          </div>
        </div>

        {/* Utility Row: Timelapse Replay, Printable Stencil & Project Save/Load */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/70 pt-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleReplay}
              disabled={totalOperationsCount === 0}
              aria-pressed={isReplaying}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 ${
                isReplaying
                  ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                  : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {isReplaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    Stop Replay ({operations.length}/{totalOperationsCount})
                  </span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Replay Timelapse</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onExportReel}
              disabled={totalOperationsCount === 0 || reelProgress !== null}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Video className="h-3.5 w-3.5 text-[#B91C1C]" aria-hidden="true" />
              <span>
                {reelProgress !== null ? `Reel ${reelProgress}%` : 'Export Reel'}
              </span>
            </button>
            <button
              type="button"
              onClick={onExportStencil}
              disabled={totalOperationsCount === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Print Stencil</span>
            </button>
            <button
              type="button"
              onClick={onExportSvg}
              disabled={totalOperationsCount === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export SVG</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onSaveProject}
              disabled={totalOperationsCount === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Save .alpona</span>
            </button>
            <button
              type="button"
              onClick={() => loadInputRef.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0"
            >
              <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Load .alpona</span>
            </button>
            <input
              ref={loadInputRef}
              type="file"
              accept=".json,.alpona.json,application/json"
              aria-label="Load Alpona JSON project file"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onLoadProjectFile(file);
                }
                e.currentTarget.value = '';
              }}
            />
          </div>
        </div>

        {projectError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            {projectError}
          </div>
        )}

        {/* Clean Unboxed Readout (Zero Pills) */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-zinc-200/80 pt-2.5 text-xs text-zinc-600">
          <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
            <span className="font-medium text-zinc-900">{groupNotation}</span>
            <span aria-hidden="true">·</span>
            <span>{totalCopies} copies</span>
            <span aria-hidden="true">·</span>
            <span>{wedgeDeg}°</span>
            <span aria-hidden="true">·</span>
            <span>{lineAlgorithm === 'dda' ? 'DDA' : 'Bresenham'}</span>
            {clippingWindow.enabled && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-amber-700">
                  Clip:{' '}
                  {clippingWindow.algorithm === 'liang-barsky'
                    ? 'Liang-Barsky'
                    : 'Cohen-Sutherland'}{' '}
                  /{' '}
                  {clippingWindow.polygonAlgorithm === 'weiler-atherton'
                    ? 'Weiler-Atherton'
                    : 'Sutherland-Hodgman'}
                </span>
              </>
            )}
          </div>
          <div className="font-mono tabular-nums text-zinc-500">
            {isReplaying
              ? `Replaying stroke ${operations.length}/${totalOperationsCount}`
              : activeSnap && activeSnap.wasSnapped
                ? `Snap${
                    activeSnap.snappedAxisAngleDeg !== null
                      ? ` ${activeSnap.snappedAxisAngleDeg}°`
                      : ''
                  }${
                    activeSnap.snappedRingRadius !== null
                      ? ` r=${activeSnap.snappedRingRadius}`
                      : ''
                  }`
                : isDrawingVisual
                  ? 'Rasterizing…'
                  : cursorCoord
                    ? `(${cursorCoord.x}, ${cursorCoord.y}) px`
                    : `${operations.length} ${operations.length === 1 ? 'stroke' : 'strokes'}`}
          </div>
        </div>
      </div>
    </section>
  );
}
