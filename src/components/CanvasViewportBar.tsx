import {
  Compass,
  Hand,
  Magnet,
  RotateCcw,
  Target,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { SnapConfig } from '../graphics/canvasAssist';
import {
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  type CanvasViewport,
} from '../graphics/viewportCamera';

interface CanvasViewportBarProps {
  viewport: CanvasViewport;
  panMode: boolean;
  hdPreview: boolean;
  snapConfig: SnapConfig;
  onZoomStep: (delta: number) => void;
  onResetViewport: () => void;
  onTogglePanMode: () => void;
  onToggleHdPreview: () => void;
  onChangeSnapConfig: (next: SnapConfig) => void;
}

export function CanvasViewportBar({
  viewport,
  panMode,
  hdPreview,
  snapConfig,
  onZoomStep,
  onResetViewport,
  onTogglePanMode,
  onToggleHdPreview,
  onChangeSnapConfig,
}: CanvasViewportBarProps) {
  const zoomPct = Math.round(viewport.zoom * 100);
  const isZoomed = viewport.zoom > MIN_CANVAS_ZOOM + 0.01;

  return (
    <div
      aria-label="Canvas zoom and magnetic snap controls"
      className="mx-auto flex w-full max-w-[680px] flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200/90 bg-white px-2.5 py-2 shadow-xs"
    >
      {/* Zoom, Pan & Hi-DPI Resolution Controls */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onZoomStep(-0.5)}
          disabled={viewport.zoom <= MIN_CANVAS_ZOOM + 0.01}
          aria-label="Zoom out canvas"
          title="Zoom out (−)"
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-200 bg-zinc-50 text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40"
        >
          <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onResetViewport}
          aria-label="Reset canvas zoom to 100%"
          data-testid="zoom-level-readout"
          title="Click to reset zoom & pan (0)"
          className="inline-flex h-8 min-w-[50px] items-center justify-center rounded border border-zinc-200 bg-white px-2 font-mono text-xs font-medium tabular-nums text-zinc-900 transition-colors hover:bg-zinc-50"
        >
          {zoomPct}%
        </button>

        <button
          type="button"
          onClick={() => onZoomStep(0.5)}
          disabled={viewport.zoom >= MAX_CANVAS_ZOOM - 0.01}
          aria-label="Zoom in canvas"
          title="Zoom in (+)"
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-200 bg-zinc-50 text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40"
        >
          <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onTogglePanMode}
          aria-pressed={panMode}
          title="Drag to pan canvas when zoomed (or hold Space)"
          className={`inline-flex h-8 items-center gap-1 rounded border px-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            panMode
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          <Hand className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Pan</span>
        </button>

        <button
          type="button"
          onClick={onToggleHdPreview}
          data-testid="toggle-hd-preview"
          aria-pressed={hdPreview}
          title={
            hdPreview
              ? '2× Retina Hi-DPI (1440×1440) software rasterizer active — click for native 720px'
              : 'Switch from native 720px raster to crisp 2× Retina (1440×1440) preview'
          }
          className={`inline-flex h-8 items-center rounded border px-2 font-mono text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
            hdPreview
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          {hdPreview ? '2× HD' : '1× 720'}
        </button>

        {isZoomed && (
          <button
            type="button"
            onClick={onResetViewport}
            aria-label="Reset pan and zoom"
            className="inline-flex h-8 items-center gap-1 rounded border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-600 transition-colors hover:text-[#B91C1C] whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Magnetic Axis Snap, Ring Snap & Compass Arc Lock */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() =>
            onChangeSnapConfig({
              ...snapConfig,
              snapToAxis: !snapConfig.snapToAxis,
            })
          }
          aria-pressed={snapConfig.snapToAxis}
          title="Magnetically snap strokes onto symmetry reflection axes (Shortcut: S)"
          className={`inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            snapConfig.snapToAxis
              ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
              : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          <Magnet className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Axis Snap</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onChangeSnapConfig({
              ...snapConfig,
              snapToRing: !snapConfig.snapToRing,
            })
          }
          aria-pressed={snapConfig.snapToRing}
          title="Magnetically snap strokes onto concentric guide rings (r = 120, 240, 330)"
          className={`inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            snapConfig.snapToRing
              ? 'border-zinc-900 bg-zinc-900 text-white'
              : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          <Target className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Ring Snap</span>
        </button>

        <button
          type="button"
          onClick={() =>
            onChangeSnapConfig({
              ...snapConfig,
              compassArcLock: !snapConfig.compassArcLock,
            })
          }
          aria-pressed={snapConfig.compassArcLock}
          title="Lock freehand drag radius from center (or hold Shift while drawing)"
          className={`inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            snapConfig.compassArcLock
              ? 'border-amber-600 bg-amber-600 text-white'
              : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
          }`}
        >
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Compass Lock</span>
        </button>
      </div>
    </div>
  );
}
