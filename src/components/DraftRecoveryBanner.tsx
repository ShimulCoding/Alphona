import { RotateCcw, X } from 'lucide-react';

interface DraftRecoveryBannerProps {
  savedAt: number;
  strokesCount: number;
  onResetDefault: () => void;
  onDismiss: () => void;
}

export function DraftRecoveryBanner({
  savedAt,
  strokesCount,
  onResetDefault,
  onDismiss,
}: DraftRecoveryBannerProps) {
  const formattedTime = new Date(savedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      data-testid="draft-recovery-banner"
      role="status"
      className="rounded-lg border border-zinc-300/90 bg-[#FAF8F3] px-4 py-2 text-xs text-zinc-700 shadow-2xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-zinc-900">Draft restored</span>
          <span aria-hidden="true" className="text-zinc-300">
            ·
          </span>
          <span className="font-mono tabular-nums text-zinc-600">
            {strokesCount} {strokesCount === 1 ? 'stroke' : 'strokes'} autosaved
            at {formattedTime}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetDefault}
            data-testid="draft-reset-default"
            className="inline-flex h-7 items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-800 transition-colors hover:border-[#B91C1C] hover:text-[#B91C1C]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>Reset Default</span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss restored draft notice"
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
