import React, { useRef, useState } from 'react';
import {
  snapPointToSymmetryGuides,
  type SnapConfig,
} from '../graphics/canvasAssist';
import type { BezierHandleKey } from '../graphics/layerStack';
import {
  screenToCanvasWithViewport,
  type CanvasViewport,
} from '../graphics/viewportCamera';
import type { DrawOperation, Point2D, SymmetryConfig } from '../graphics/types';

type BezierOp = Extract<DrawOperation, { kind: 'bezier' }>;

interface BezierHandleOverlayProps {
  bezierOp: BezierOp;
  canvasSize: number;
  viewport: CanvasViewport;
  stageRef: React.RefObject<HTMLDivElement | null>;
  symmetry: SymmetryConfig;
  snapConfig: SnapConfig;
  onPreviewHandle: (id: string, handle: BezierHandleKey, nextPoint: Point2D) => void;
  onCommitHandle: (id: string, handle: BezierHandleKey, nextPoint: Point2D) => void;
  onCancelPreview: () => void;
}

const HANDLE_META: Array<{
  key: BezierHandleKey;
  label: string;
  isAnchor: boolean;
}> = [
  { key: 'p0', label: 'P0', isAnchor: true },
  { key: 'p1', label: 'P1', isAnchor: false },
  { key: 'p2', label: 'P2', isAnchor: false },
  { key: 'p3', label: 'P3', isAnchor: true },
];

export function BezierHandleOverlay({
  bezierOp,
  canvasSize,
  viewport,
  stageRef,
  symmetry,
  snapConfig,
  onPreviewHandle,
  onCommitHandle,
  onCancelPreview,
}: BezierHandleOverlayProps) {
  const draggingKeyRef = useRef<BezierHandleKey | null>(null);
  const latestPointRef = useRef<Point2D | null>(null);
  const [activeDragKey, setActiveDragKey] = useState<BezierHandleKey | null>(null);
  const [livePoints, setLivePoints] = useState<{
    p0: Point2D;
    p1: Point2D;
    p2: Point2D;
    p3: Point2D;
  } | null>(null);

  const pts = livePoints ?? {
    p0: bezierOp.p0,
    p1: bezierOp.p1,
    p2: bezierOp.p2,
    p3: bezierOp.p3,
  };

  const toCanvasPoint = (e: React.PointerEvent<SVGGElement>): Point2D => {
    const stageEl = stageRef.current;
    if (!stageEl) return { x: canvasSize / 2, y: canvasSize / 2 };
    const rect = stageEl.getBoundingClientRect();
    const raw = screenToCanvasWithViewport(
      e.clientX,
      e.clientY,
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      viewport,
      canvasSize
    );
    const snapped = snapPointToSymmetryGuides(raw, canvasSize, symmetry, snapConfig, null);
    return {
      x: Math.max(4, Math.min(canvasSize - 4, snapped.point.x)),
      y: Math.max(4, Math.min(canvasSize - 4, snapped.point.y)),
    };
  };

  const handlePointerDown = (
    key: BezierHandleKey,
    e: React.PointerEvent<SVGGElement>
  ) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingKeyRef.current = key;
    setActiveDragKey(key);
    const nextPt = toCanvasPoint(e);
    latestPointRef.current = nextPt;
    const nextAll = {
      p0: bezierOp.p0,
      p1: bezierOp.p1,
      p2: bezierOp.p2,
      p3: bezierOp.p3,
      [key]: nextPt,
    };
    setLivePoints(nextAll);
    onPreviewHandle(bezierOp.id, key, nextPt);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    const key = draggingKeyRef.current;
    if (!key) return;
    e.stopPropagation();
    const nextPt = toCanvasPoint(e);
    latestPointRef.current = nextPt;
    setLivePoints((prev) => ({
      p0: prev?.p0 ?? bezierOp.p0,
      p1: prev?.p1 ?? bezierOp.p1,
      p2: prev?.p2 ?? bezierOp.p2,
      p3: prev?.p3 ?? bezierOp.p3,
      [key]: nextPt,
    }));
    onPreviewHandle(bezierOp.id, key, nextPt);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGGElement>) => {
    const key = draggingKeyRef.current;
    if (!key) return;
    e.stopPropagation();
    const finalPt = latestPointRef.current ?? toCanvasPoint(e);
    draggingKeyRef.current = null;
    latestPointRef.current = null;
    setActiveDragKey(null);
    setLivePoints(null);
    onCommitHandle(bezierOp.id, key, finalPt);
  };

  const handlePointerCancel = () => {
    draggingKeyRef.current = null;
    latestPointRef.current = null;
    setActiveDragKey(null);
    setLivePoints(null);
    onCancelPreview();
  };

  const invScale = 1 / Math.max(1, viewport.zoom);

  return (
    <svg
      viewBox={`0 0 ${canvasSize} ${canvasSize}`}
      data-testid="bezier-handle-overlay"
      data-bezier-id={bezierOp.id}
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {/* Tangent control arms P0->P1 and P3->P2 */}
      <line
        x1={pts.p0.x}
        y1={pts.p0.y}
        x2={pts.p1.x}
        y2={pts.p1.y}
        stroke="#F59E0B"
        strokeWidth={1.6 * invScale}
        strokeDasharray={`${5 * invScale} ${4 * invScale}`}
      />
      <line
        x1={pts.p3.x}
        y1={pts.p3.y}
        x2={pts.p2.x}
        y2={pts.p2.y}
        stroke="#F59E0B"
        strokeWidth={1.6 * invScale}
        strokeDasharray={`${5 * invScale} ${4 * invScale}`}
      />
      <line
        x1={pts.p1.x}
        y1={pts.p1.y}
        x2={pts.p2.x}
        y2={pts.p2.y}
        stroke="#38BDF8"
        strokeOpacity="0.55"
        strokeWidth={1.1 * invScale}
        strokeDasharray={`${3 * invScale} ${4 * invScale}`}
      />

      {HANDLE_META.map(({ key, label, isAnchor }) => {
        const pt = pts[key];
        const isDragging = activeDragKey === key;
        const size = (isAnchor ? 11 : 10) * invScale;
        const hitR = 16 * invScale;

        return (
          <g
            key={key}
            data-testid={`bezier-handle-${key}`}
            data-x={Math.round(pt.x)}
            data-y={Math.round(pt.y)}
            className="pointer-events-auto cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => handlePointerDown(key, e)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            {/* Generous invisible hit area for effortless grabbing */}
            <circle cx={pt.x} cy={pt.y} r={hitR} fill="transparent" />

            {isAnchor ? (
              <rect
                x={pt.x - size / 2}
                y={pt.y - size / 2}
                width={size}
                height={size}
                rx={1.5 * invScale}
                fill={isDragging ? '#B91C1C' : '#FAF8F2'}
                stroke="#18181B"
                strokeWidth={1.8 * invScale}
              />
            ) : (
              <circle
                cx={pt.x}
                cy={pt.y}
                r={size * 0.55}
                fill={isDragging ? '#B91C1C' : '#F59E0B'}
                stroke="#18181B"
                strokeWidth={1.8 * invScale}
              />
            )}

            <text
              x={pt.x + 9 * invScale}
              y={pt.y - 8 * invScale}
              fontSize={11 * invScale}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fontWeight="700"
              fill="#FAF8F2"
              stroke="#18181B"
              strokeWidth={2.5 * invScale}
              paintOrder="stroke"
              className="pointer-events-none select-none"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
