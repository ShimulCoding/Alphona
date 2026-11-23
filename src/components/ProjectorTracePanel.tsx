import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { RenderOptions } from '../graphics/engine';
import {
  partitionTracingStages,
  renderProjectorGuideCanvas,
} from '../graphics/projectorTrace';
import type { CanvasSurface, DrawOperation } from '../graphics/types';
import { CANVAS_SIZE } from './AlponaCanvas';

interface ProjectorTracePanelProps {
  operations: DrawOperation[];
  surface: CanvasSurface;
  renderOptions: RenderOptions;
}

export function ProjectorTracePanel({
  operations,
  surface,
  renderOptions,
}: ProjectorTracePanelProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [activeStage, setActiveStage] = useState<0 | 1 | 2 | 3 | 4>(1);
  const [darkroomMode, setDarkroomMode] = useState(true);
  const [showCompassGuides, setShowCompassGuides] = useState(true);
  const [keystoneDeg, setKeystoneDeg] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const stages = useMemo(
    () => partitionTracingStages(operations),
    [operations]
  );

  // Render preview stage guide
  useEffect(() => {
    const rendered = renderProjectorGuideCanvas(
      operations,
      surface,
      CANVAS_SIZE,
      renderOptions,
      {
        activeStage,
        darkroomMode,
        showCompassGuides,
        keystoneDeg,
      },
      720
    );

    const targets = [previewCanvasRef.current, fullscreenCanvasRef.current];
    for (const target of targets) {
      if (!target) continue;
      target.width = rendered.width;
      target.height = rendered.height;
      const ctx = target.getContext('2d');
      if (ctx) {
        ctx.drawImage(rendered, 0, 0);
      }
    }
  }, [
    operations,
    surface,
    renderOptions,
    activeStage,
    darkroomMode,
    showCompassGuides,
    keystoneDeg,
    isFullscreen,
  ]);

  // Esc key exits in-app fullscreen darkroom projector overlay cleanly
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
      else if (e.key === 'ArrowRight') {
        setActiveStage((s) => (s >= 4 ? 0 : ((s + 1) as 0 | 1 | 2 | 3 | 4)));
      } else if (e.key === 'ArrowLeft') {
        setActiveStage((s) => (s <= 0 ? 4 : ((s - 1) as 0 | 1 | 2 | 3 | 4)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  const handleDownloadStagePng = () => {
    const hiRes = renderProjectorGuideCanvas(
      operations,
      surface,
      CANVAS_SIZE,
      renderOptions,
      {
        activeStage,
        darkroomMode,
        showCompassGuides,
        keystoneDeg,
      },
      2160
    );
    const link = document.createElement('a');
    link.href = hiRes.toDataURL('image/png');
    link.download = `alpona-projector-stage-${activeStage === 0 ? 'all' : activeStage}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeStageMeta = stages.find((s) => s.stageNumber === activeStage);

  return (
    <>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left: Live Projector & Step-by-Step Chalking Canvas */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                {activeStage === 0
                  ? 'Full Pattern — Overhead Projector Output'
                  : `Stage ${activeStage} of 4: ${activeStageMeta?.title ?? ''}`}
              </h2>
              <p className="text-xs text-zinc-500">
                {activeStage === 0
                  ? 'All chalking layers projected simultaneously in high contrast.'
                  : activeStageMeta?.chalkTip}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800 whitespace-nowrap"
            >
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Launch Darkroom Projector</span>
            </button>
          </div>

          <div
            className="mx-auto flex aspect-square max-w-[540px] items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-black p-3"
            style={{ perspective: '900px' }}
          >
            <canvas
              ref={previewCanvasRef}
              data-testid="projector-guide-canvas"
              className="block h-full w-full transition-transform duration-150"
              style={{
                transform:
                  keystoneDeg === 0
                    ? undefined
                    : `rotateX(${keystoneDeg}deg) scale(${
                        1 - Math.abs(keystoneDeg) * 0.004
                      })`,
              }}
            />
          </div>

          {/* Step navigation bar */}
          <div className="flex items-center justify-between border-t border-zinc-200/80 pt-3">
            <button
              type="button"
              onClick={() =>
                setActiveStage((s) => (s <= 1 ? 4 : ((s - 1) as 1 | 2 | 3 | 4)))
              }
              className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Previous Stage</span>
            </button>
            <span className="font-mono text-xs text-zinc-500">
              {activeStage === 0 ? 'All 4 Stages' : `Chalk Step ${activeStage} / 4`}
            </span>
            <button
              type="button"
              onClick={() =>
                setActiveStage((s) => (s >= 4 ? 1 : ((s + 1) as 1 | 2 | 3 | 4)))
              }
              className="inline-flex h-8 items-center gap-1 rounded-md bg-[#B91C1C] px-3 text-xs font-medium text-white hover:bg-[#991B1B]"
            >
              <span>Next Stage</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Right: Chalking Stage Checklist & Projector Settings */}
        <aside className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200/90">
          <section className="space-y-2.5 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Physical Floor Chalking Order
              </h2>
              <span className="font-mono text-[11px] text-zinc-500">4 Stages</span>
            </div>
            <div className="space-y-1.5">
              {stages.map((st) => {
                const active = activeStage === st.stageNumber;
                return (
                  <button
                    key={st.stageNumber}
                    type="button"
                    onClick={() => setActiveStage(st.stageNumber)}
                    aria-pressed={active}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                        : 'border-zinc-200 bg-zinc-50/70 text-zinc-800 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>
                        {st.stageNumber}. {st.title}
                      </span>
                      <span
                        className={`font-mono text-[11px] ${
                          active ? 'text-red-100' : 'text-zinc-500'
                        }`}
                      >
                        {st.operations.length} ops
                      </span>
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setActiveStage(0)}
                aria-pressed={activeStage === 0}
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                  activeStage === 0
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                }`}
              >
                Show Full Pattern Simultaneously
              </button>
            </div>
          </section>

          <section className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              Darkroom Projector Optics
            </h2>
            <label className="flex cursor-pointer items-center justify-between text-xs text-zinc-700">
              <span>Pure Black / Luminous White (Projector)</span>
              <input
                type="checkbox"
                checked={darkroomMode}
                onChange={(e) => setDarkroomMode(e.target.checked)}
                className="h-4 w-4 rounded accent-[#B91C1C]"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between text-xs text-zinc-700">
              <span>Center Nail &amp; Chalk-String Rings</span>
              <input
                type="checkbox"
                checked={showCompassGuides}
                onChange={(e) => setShowCompassGuides(e.target.checked)}
                className="h-4 w-4 rounded accent-[#B91C1C]"
              />
            </label>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <label htmlFor="keystone-slider" className="text-zinc-700">
                  Keystone tilt compensation
                </label>
                <span className="font-mono font-medium tabular-nums text-zinc-900">
                  {keystoneDeg > 0 ? `+${keystoneDeg}°` : `${keystoneDeg}°`}
                </span>
              </div>
              <input
                id="keystone-slider"
                type="range"
                min={-25}
                max={25}
                step={1}
                value={keystoneDeg}
                onChange={(e) => setKeystoneDeg(Number(e.target.value))}
                className="w-full accent-[#B91C1C]"
              />
            </div>

            <button
              type="button"
              onClick={handleDownloadStagePng}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Save High-Contrast Stage PNG (2160 px)</span>
            </button>
          </section>
        </aside>
      </div>

      {/* In-App Pitch-Black Fullscreen Projector Overlay (Zero window.open) */}
      {isFullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Darkroom floor projector view"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-4"
        >
          <div
            className="flex max-h-[82vh] max-w-[82vh] items-center justify-center"
            style={{ perspective: '1000px' }}
          >
            <canvas
              ref={fullscreenCanvasRef}
              className="max-h-[80vh] max-w-[80vh] w-auto h-auto"
              style={{
                transform:
                  keystoneDeg === 0 ? undefined : `rotateX(${keystoneDeg}deg)`,
              }}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/90 px-4 py-2 text-xs text-zinc-200">
            <button
              type="button"
              onClick={() =>
                setActiveStage((s) => (s <= 1 ? 4 : ((s - 1) as 1 | 2 | 3 | 4)))
              }
              className="rounded border border-zinc-700 px-2.5 py-1 hover:bg-zinc-800"
            >
              Prev
            </button>
            <span className="font-mono px-2">
              {activeStage === 0 ? 'All Stages' : `Stage ${activeStage}/4`}
            </span>
            <button
              type="button"
              onClick={() =>
                setActiveStage((s) => (s >= 4 ? 1 : ((s + 1) as 1 | 2 | 3 | 4)))
              }
              className="rounded bg-[#B91C1C] px-2.5 py-1 font-medium text-white hover:bg-[#991B1B]"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="ml-2 inline-flex items-center gap-1 rounded border border-zinc-700 px-2.5 py-1 hover:bg-zinc-800"
            >
              <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Exit (Esc)</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
