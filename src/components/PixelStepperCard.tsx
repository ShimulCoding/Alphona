import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import {
  traceBresenhamLineSteps,
  traceDdaLineSteps,
  traceMidpointCircleSteps,
  type RasterStep,
} from '../graphics/rasterizer';

type StepperAlgo = 'bresenham' | 'dda' | 'midpoint-circle';

const GRID_SIZE = 16;

export function PixelStepperCard() {
  const [algo, setAlgo] = useState<StepperAlgo>('bresenham');
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const steps = useMemo<RasterStep[]>(() => {
    if (algo === 'bresenham') return traceBresenhamLineSteps(1, 2, 14, 11);
    if (algo === 'dda') return traceDdaLineSteps(1, 2, 14, 11);
    return traceMidpointCircleSteps(8, 8, 6);
  }, [algo]);

  // Reset stepper when algorithm changes
  useEffect(() => {
    setStepIdx(0);
    setPlaying(false);
  }, [algo]);

  // Auto-advance timer when Play is active
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setStepIdx((prev) => {
        if (prev >= steps.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 520);
    return () => window.clearInterval(timer);
  }, [playing, steps.length]);

  const safeIdx = Math.min(stepIdx, Math.max(0, steps.length - 1));
  const currentStep = steps[safeIdx];

  // Collect previously plotted pixels vs. current step pixels
  const prevPixels = new Set<string>();
  for (let i = 0; i < safeIdx; i++) {
    for (const pt of steps[i].points) {
      prevPixels.add(`${pt.x},${pt.y}`);
    }
  }
  const activePixels = new Set<string>();
  if (currentStep) {
    for (const pt of currentStep.points) {
      activePixels.add(`${pt.x},${pt.y}`);
    }
  }

  return (
    <section
      aria-label="16x zoomed pixel-grid algorithm stepper"
      className="rounded-lg border border-zinc-200 bg-white p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-zinc-200/80 pb-3.5">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            16× Zoomed Pixel-Grid Algorithm Stepper (Raster Kernel Inspector)
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            Step through exact pixel coordinates and integer/floating-point decision
            parameters for Bresenham Line, DDA Line, and 8-Octant Midpoint Circle.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'bresenham', label: 'Bresenham Line' },
              { id: 'dda', label: 'DDA Line' },
              { id: 'midpoint-circle', label: 'Midpoint Circle' },
            ] as const
          ).map((item) => {
            const active = algo === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setAlgo(item.id)}
                aria-pressed={active}
                className={`h-8 rounded-md border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Crisp 16x16 SVG Pixel Grid */}
        <div className="mx-auto w-full max-w-[320px]">
          <svg
            viewBox="0 0 320 320"
            role="img"
            aria-label={`16 by 16 raster pixel grid for ${algo}`}
            data-testid="pixel-stepper-grid"
            className="block aspect-square w-full rounded-md border border-zinc-300 bg-[#18181D]"
          >
            {/* Grid cells */}
            {Array.from({ length: GRID_SIZE }).map((_, y) =>
              Array.from({ length: GRID_SIZE }).map((__, x) => {
                const key = `${x},${y}`;
                const isActive = activePixels.has(key);
                const isPrev = prevPixels.has(key);
                const fill = isActive
                  ? '#EF4444'
                  : isPrev
                    ? '#FAF8F2'
                    : '#18181D';
                return (
                  <rect
                    key={key}
                    x={x * 20}
                    y={y * 20}
                    width="20"
                    height="20"
                    fill={fill}
                    stroke="#2E2E38"
                    strokeWidth="0.75"
                  />
                );
              })
            )}

            {/* Ideal geometric guide overlay */}
            {algo !== 'midpoint-circle' ? (
              <line
                x1={1 * 20 + 10}
                y1={2 * 20 + 10}
                x2={14 * 20 + 10}
                y2={11 * 20 + 10}
                stroke="#F59E0B"
                strokeWidth="1.4"
                strokeDasharray="4 3"
              />
            ) : (
              <circle
                cx={8 * 20 + 10}
                cy={8 * 20 + 10}
                r={6 * 20}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="1.4"
                strokeDasharray="4 3"
              />
            )}
          </svg>
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 bg-[#EF4444]" />
              Current Step
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 border border-zinc-400 bg-[#FAF8F2]" />
              Plotted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3 bg-[#F59E0B]" />
              Ideal Path
            </span>
          </div>
        </div>

        {/* Step Controls + Live Decision Parameter Readout */}
        <div className="space-y-4">
          {/* Playback Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setStepIdx((p) => Math.max(0, p - 1));
              }}
              disabled={safeIdx === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
            >
              <SkipBack className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (safeIdx >= steps.length - 1) setStepIdx(0);
                setPlaying((p) => !p);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 text-xs font-medium text-white hover:bg-zinc-800"
            >
              {playing ? (
                <>
                  <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Play Trace</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setStepIdx((p) => Math.min(steps.length - 1, p + 1));
              }}
              disabled={safeIdx >= steps.length - 1}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
            >
              <span>Step</span>
              <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setStepIdx(0);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
            <span className="ml-auto font-mono text-xs font-semibold tabular-nums text-zinc-700">
              Iteration {safeIdx + 1} / {steps.length}
            </span>
          </div>

          {/* Decision Parameter Inspector */}
          {currentStep && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-700">
                  Decision Parameter
                </span>
                <span
                  data-testid="stepper-decision-param"
                  className="font-mono text-xs font-semibold text-[#B91C1C]"
                >
                  {currentStep.decisionParam}
                </span>
              </div>
              <div className="font-mono text-xs text-zinc-800">
                {currentStep.formulaNote}
              </div>
              <div className="border-t border-zinc-200/80 pt-2 text-xs text-zinc-600">
                <span className="font-medium text-zinc-800">
                  Pixels written this step ({currentStep.points.length}):
                </span>{' '}
                <span className="font-mono text-zinc-700">
                  {currentStep.points
                    .map((p) => `(${p.x},${p.y})`)
                    .join('  ')}
                </span>
              </div>
            </div>
          )}

          {/* Iteration Table Preview */}
          <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-200">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-3 py-1.5 font-semibold">k</th>
                  <th className="px-3 py-1.5 font-semibold">State / Decision</th>
                  <th className="px-3 py-1.5 font-semibold">Primary Pixel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {steps.map((s, idx) => {
                  const selected = idx === safeIdx;
                  return (
                    <tr
                      key={s.step}
                      onClick={() => {
                        setPlaying(false);
                        setStepIdx(idx);
                      }}
                      className={`cursor-pointer transition-colors ${
                        selected
                          ? 'bg-red-50/90 font-semibold text-zinc-950'
                          : 'hover:bg-zinc-50 text-zinc-600'
                      }`}
                    >
                      <td className="px-3 py-1.5 tabular-nums">{s.step}</td>
                      <td className="px-3 py-1.5">{s.decisionParam}</td>
                      <td className="px-3 py-1.5 tabular-nums">
                        ({s.points[0].x}, {s.points[0].y})
                        {s.points.length > 1 ? ` ×${s.points.length}` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
