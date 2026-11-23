import { useRef, useState, type PointerEvent, type RefObject } from 'react';
import {
  computeOperationBounds,
  rotateOperationAroundPoint,
  scaleOperationAroundPoint,
  translateOperation,
} from '../graphics/layerTransform';
import type { DrawOperation, Point2D } from '../graphics/types';
import {
  screenToCanvasWithViewport,
  type CanvasViewport,
} from '../graphics/viewportCamera';

interface LayerTransformOverlayProps {
  op: DrawOperation;
  canvasSize: number;
  viewport: CanvasViewport;
  stageRef: RefObject<HTMLDivElement | null>;
  onPreviewOp: (nextOp: DrawOperation | null) => void;
  onCommitOp: (nextOp: DrawOperation) => void;
}

type DragMode = 'move' | 'scale' | 'rotate';

export function LayerTransformOverlay({
  op,
  canvasSize,
  viewport,
  stageRef,
  onPreviewOp,
  onCommitOp,
}: LayerTransformOverlayProps) {
  const [liveOp, setLiveOp] = useState<DrawOperation | null>(null);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const dragOriginRef = useRef<{
    mode: DragMode;
    startPt: Point2D;
    baseOp: DrawOperation;
    center: Point2D;
    startDist: number;
    startAngle: number;
  } | null>(null);
  const latestOpRef = useRef<DrawOperation | null>(null);

  const displayedOp = liveOp ?? op;
  const bounds = computeOperationBounds(displayedOp);
  const invZoom = 1 / Math.max(1, viewport.zoom);
  const handleR = 6.5 * invZoom;
  const strokeW = 1.6 * invZoom;
  const rotStemY = bounds.minY - 26 * invZoom;

  const toCanvas = (e: PointerEvent<SVGElement>): Point2D | null => {
    const el = stageRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return screenToCanvasWithViewport(
      e.clientX,
      e.clientY,
      rect,
      viewport,
      canvasSize
    );
  };

  const beginDrag = (mode: DragMode) => (e: PointerEvent<SVGElement>) => {
    if (op.locked) return;
    e.stopPropagation();
    const pt = toCanvas(e);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const center = { x: bounds.cx, y: bounds.cy };
    dragOriginRef.current = {
      mode,
      startPt: pt,
      baseOp: op,
      center,
      startDist: Math.max(8, Math.hypot(pt.x - center.x, pt.y - center.y)),
      startAngle: Math.atan2(pt.y - center.y, pt.x - center.x),
    };
    latestOpRef.current = op;
    setDragMode(mode);
    setLiveOp(op);
  };

  const handleDragMove = (e: PointerEvent<SVGElement>) => {
    const info = dragOriginRef.current;
    if (!info) return;
    e.stopPropagation();
    const pt = toCanvas(e);
    if (!pt) return;

    let next: DrawOperation = info.baseOp;
    if (info.mode === 'move') {
      const dx = pt.x - info.startPt.x;
      const dy = pt.y - info.startPt.y;
      next = translateOperation(info.baseOp, dx, dy, canvasSize);
    } else if (info.mode === 'scale') {
      const dist = Math.max(4, Math.hypot(pt.x - info.center.x, pt.y - info.center.y));
      const ratio = dist / info.startDist;
      next = scaleOperationAroundPoint(info.baseOp, ratio, info.center);
    } else if (info.mode === 'rotate') {
      const angle = Math.atan2(pt.y - info.center.y, pt.x - info.center.x);
      next = rotateOperationAroundPoint(
        info.baseOp,
        angle - info.startAngle,
        info.center
      );
    }

    latestOpRef.current = next;
    setLiveOp(next);
    onPreviewOp(next);
  };

  const endDrag = (e: PointerEvent<SVGElement>) => {
    const info = dragOriginRef.current;
    if (!info) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const finalOp = latestOpRef.current;
    dragOriginRef.current = null;
    latestOpRef.current = null;
    setDragMode(null);
    setLiveOp(null);
    onPreviewOp(null);
    if (finalOp && finalOp !== info.baseOp) {
      onCommitOp(finalOp);
    }
  };

  return (
    <svg
      viewBox={`0 0 ${canvasSize} ${canvasSize}`}
      data-testid="layer-transform-overlay"
      data-layer-id={op.id}
      data-cx={Math.round(bounds.cx)}
      data-cy={Math.round(bounds.cy)}
      data-width={Math.round(bounds.width)}
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {/* Draggable Move Region */}
      <rect
        x={bounds.minX}
        y={bounds.minY}
        width={bounds.width}
        height={bounds.height}
        fill={dragMode === 'move' ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.05)'}
        stroke={op.locked ? '#9CA3AF' : '#F59E0B'}
        strokeWidth={strokeW}
        strokeDasharray={`${5 * invZoom} ${3.5 * invZoom}`}
        data-testid="transform-move-box"
        className={
          op.locked
            ? 'pointer-events-auto cursor-not-allowed'
            : 'pointer-events-auto cursor-move'
        }
        onPointerDown={beginDrag('move')}
        onPointerMove={handleDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />

      {/* Center Crosshair */}
      <circle
        cx={bounds.cx}
        cy={bounds.cy}
        r={3 * invZoom}
        fill="#F59E0B"
        className="pointer-events-none"
      />

      {!op.locked && (
        <>
          {/* Rotation Stem + Handle */}
          <line
            x1={bounds.cx}
            y1={bounds.minY}
            x2={bounds.cx}
            y2={rotStemY}
            stroke="#F59E0B"
            strokeWidth={strokeW}
            className="pointer-events-none"
          />
          <g
            data-testid="transform-rotate-handle"
            className="pointer-events-auto cursor-grab active:cursor-grabbing"
            onPointerDown={beginDrag('rotate')}
            onPointerMove={handleDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <circle
              cx={bounds.cx}
              cy={rotStemY}
              r={handleR * 2.1}
              fill="transparent"
            />
            <circle
              cx={bounds.cx}
              cy={rotStemY}
              r={handleR}
              fill={dragMode === 'rotate' ? '#DC2626' : '#FAF8F2'}
              stroke="#18181B"
              strokeWidth={1.6 * invZoom}
            />
          </g>

          {/* Scale Handle (Bottom-Right Corner) */}
          <g
            data-testid="transform-scale-handle"
            className="pointer-events-auto cursor-nwse-resize"
            onPointerDown={beginDrag('scale')}
            onPointerMove={handleDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <circle
              cx={bounds.maxX}
              cy={bounds.maxY}
              r={handleR * 2.2}
              fill="transparent"
            />
            <rect
              x={bounds.maxX - handleR}
              y={bounds.maxY - handleR}
              width={handleR * 2}
              height={handleR * 2}
              rx={1.5 * invZoom}
              fill={dragMode === 'scale' ? '#DC2626' : '#F59E0B'}
              stroke="#18181B"
              strokeWidth={1.6 * invZoom}
            />
          </g>
        </>
      )}
    </svg>
  );
}
