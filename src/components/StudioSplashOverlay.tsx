import { useEffect, useState } from 'react';
import {
  computeSplashProgress,
  DEFAULT_SPLASH_DURATION_MS,
  shouldSkipSplashFromSearch,
  type SplashProgressState,
} from '../graphics/splashTransition';

interface StudioSplashOverlayProps {
  durationMs?: number;
  forceSkip?: boolean;
  onComplete?: () => void;
}

const PETAL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function StudioSplashOverlay({
  durationMs = DEFAULT_SPLASH_DURATION_MS,
  forceSkip = false,
  onComplete,
}: StudioSplashOverlayProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (forceSkip) return true;
    if (typeof window !== 'undefined') {
      return shouldSkipSplashFromSearch(window.location.search);
    }
    return false;
  });

  const [elapsedMs, setElapsedMs] = useState<number>(0);

  useEffect(() => {
    if (dismissed) {
      onComplete?.();
      return;
    }

    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      setElapsedMs(elapsed);
      if (elapsed < durationMs) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setDismissed(true);
        onComplete?.();
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [dismissed, durationMs, onComplete]);

  const state: SplashProgressState = computeSplashProgress(
    elapsedMs,
    durationMs,
    dismissed
  );

  if (state.isComplete || state.overlayOpacity <= 0.005) {
    return null;
  }

  const isFadingOut = state.phase === 'reveal-fade';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Alpona Studio initializing"
      data-testid="studio-splash-overlay"
      data-splash-phase={state.phase}
      data-splash-progress={state.progressPct}
      style={{ opacity: state.overlayOpacity }}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#F6F5F1]/96 backdrop-blur-xs transition-opacity duration-150 ${
        isFadingOut ? 'pointer-events-none' : ''
      }`}
    >
      <div
        style={{
          transform: `scale(${state.cardScale})`,
        }}
        className="mx-4 w-full max-w-[440px] rounded-lg border border-zinc-300/90 bg-white p-7 text-center shadow-sm transition-transform duration-150"
      >
        {/* 8-Fold Padma Lotus Branded Medallion */}
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-zinc-900/15 bg-[#16161B] shadow-2xs">
          <svg
            viewBox="0 0 100 100"
            aria-hidden="true"
            className="h-16 w-16"
            style={{
              transform: `rotate(${state.lotusRotationDeg}deg)`,
            }}
          >
            <circle
              cx="50"
              cy="50"
              r="43"
              fill="none"
              stroke="#FAF8F2"
              strokeWidth="1.2"
              strokeDasharray="2 2.5"
              opacity="0.7"
            />
            <circle
              cx="50"
              cy="50"
              r="36"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="1.2"
              opacity="0.85"
            />
            {PETAL_ANGLES.map((deg) => (
              <g key={deg} transform={`rotate(${deg} 50 50)`}>
                <path
                  d="M 50 38 Q 56 24 50 14 Q 44 24 50 38 Z"
                  fill="#B91C1C"
                  stroke="#FAF8F2"
                  strokeWidth="1.35"
                />
                <circle cx="50" cy="10" r="1.4" fill="#F59E0B" />
              </g>
            ))}
            <circle
              cx="50"
              cy="50"
              r="11"
              fill="#B91C1C"
              stroke="#FAF8F2"
              strokeWidth="1.6"
            />
            <circle cx="50" cy="50" r="4.5" fill="#F59E0B" />
          </svg>
        </div>

        {/* Brand Wordmark & Product Descriptor */}
        <div className="font-display text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
          Alpona Studio
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
          Commercial 2D/3D Vector, Multi-Layer Compositing &amp; Spatial
          Projection Suite
        </p>

        {/* Progress Bar Track & Status Readout */}
        <div className="mt-6 space-y-2 text-left">
          <div className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums text-zinc-600">
            <span className="truncate">{state.statusLabel}</span>
            <span className="font-semibold text-zinc-900">
              {state.progressPct}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-xs bg-zinc-200">
            <div
              className="h-full bg-[#B91C1C] transition-all duration-75"
              style={{ width: `${state.progressPct}%` }}
            />
          </div>
        </div>

        {/* Instant Skip / Enter Action + Artisan Credit */}
        <div className="mt-5 flex items-center justify-between border-t border-zinc-200/80 pt-3.5 text-[11px] text-zinc-500">
          <span>8-Fold Dihedral · 4K PNG · Vector SVG · 3D STL</span>
          <button
            type="button"
            data-testid="splash-enter-studio-btn"
            onClick={() => {
              setDismissed(true);
              onComplete?.();
            }}
            className="rounded border border-zinc-300 bg-[#FAF9F5] px-2.5 py-1 text-[11px] font-medium text-zinc-800 transition-colors hover:border-zinc-400 hover:bg-white hover:text-zinc-950 whitespace-nowrap shrink-0"
          >
            Enter Studio
          </button>
        </div>
      </div>
    </div>
  );
}
