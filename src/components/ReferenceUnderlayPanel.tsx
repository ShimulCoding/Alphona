import { useRef } from 'react';
import { Eye, EyeOff, Image as ImageIcon, Sparkles, X } from 'lucide-react';
import {
  buildSampleReferenceSketchDataUrl,
  DEFAULT_REFERENCE_UNDERLAY,
  type ReferenceUnderlayConfig,
} from '../graphics/layerStack';

interface ReferenceUnderlayPanelProps {
  underlay: ReferenceUnderlayConfig;
  onChangeUnderlay: (next: ReferenceUnderlayConfig) => void;
}

export function ReferenceUnderlayPanel({
  underlay,
  onChangeUnderlay,
}: ReferenceUnderlayPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      onChangeUnderlay({
        ...underlay,
        dataUrl: String(reader.result),
        name: file.name,
        visible: true,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSample = () => {
    onChangeUnderlay({
      ...DEFAULT_REFERENCE_UNDERLAY,
      dataUrl: buildSampleReferenceSketchDataUrl(),
      name: 'Shantiniketan Lotus Sketch',
      visible: true,
      opacity: 0.48,
    });
  };

  return (
    <div className="p-5" data-testid="reference-underlay-panel">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">
          Tracing Underlay
        </h2>
        <span className="text-[11px] text-zinc-500">Excluded from export</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-800 transition-colors hover:border-zinc-900 hover:bg-zinc-50 whitespace-nowrap"
        >
          <ImageIcon className="h-3.5 w-3.5 text-[#B91C1C]" aria-hidden="true" />
          <span>Upload Photo</span>
        </button>

        <button
          type="button"
          onClick={handleLoadSample}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded border border-zinc-300 bg-zinc-50 px-2 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-100 whitespace-nowrap"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Sample Sketch</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        aria-label="Upload tracing reference photo underlay"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileChange(file);
          e.currentTarget.value = '';
        }}
      />

      {underlay.dataUrl && (
        <div className="mt-3 space-y-2.5 rounded-md border border-zinc-200 bg-zinc-50/70 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-zinc-800">
              {underlay.name || 'Reference Photo'}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  onChangeUnderlay({ ...underlay, visible: !underlay.visible })
                }
                aria-label={
                  underlay.visible
                    ? 'Hide tracing underlay'
                    : 'Show tracing underlay'
                }
                aria-pressed={underlay.visible}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
              >
                {underlay.visible ? (
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onChangeUnderlay({ ...DEFAULT_REFERENCE_UNDERLAY })}
                aria-label="Remove tracing underlay"
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-500 hover:bg-red-50 hover:text-[#B91C1C]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-600">
              <label htmlFor="underlay-opacity">Tracing opacity</label>
              <span className="font-mono tabular-nums text-zinc-900">
                {Math.round(underlay.opacity * 100)}%
              </span>
            </div>
            <input
              id="underlay-opacity"
              type="range"
              min={10}
              max={85}
              step={5}
              value={Math.round(underlay.opacity * 100)}
              onChange={(e) =>
                onChangeUnderlay({
                  ...underlay,
                  opacity: Number(e.target.value) / 100,
                })
              }
              className="studio-slider w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-600">
                <label htmlFor="underlay-scale">Scale</label>
                <span className="font-mono tabular-nums text-zinc-900">
                  {Math.round(underlay.scale * 100)}%
                </span>
              </div>
              <input
                id="underlay-scale"
                type="range"
                min={50}
                max={160}
                step={5}
                value={Math.round(underlay.scale * 100)}
                onChange={(e) =>
                  onChangeUnderlay({
                    ...underlay,
                    scale: Number(e.target.value) / 100,
                  })
                }
                className="studio-slider w-full"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-600">
                <label htmlFor="underlay-rotate">Rotate</label>
                <span className="font-mono tabular-nums text-zinc-900">
                  {underlay.rotateDeg}°
                </span>
              </div>
              <input
                id="underlay-rotate"
                type="range"
                min={-180}
                max={180}
                step={5}
                value={underlay.rotateDeg}
                onChange={(e) =>
                  onChangeUnderlay({
                    ...underlay,
                    rotateDeg: Number(e.target.value),
                  })
                }
                className="studio-slider w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
