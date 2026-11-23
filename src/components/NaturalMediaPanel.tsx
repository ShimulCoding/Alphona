import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import type { RenderOptions } from '../graphics/engine';
import { renderUltraHdAlponaSurface } from '../graphics/highResExport';
import {
  DEFAULT_NATURAL_MEDIA_OPTIONS,
  NATURAL_SUBSTRATES,
  renderNaturalMediaAlpona,
  type NaturalMediaOptions,
} from '../graphics/naturalMedia';
import type { PixelSurface } from '../graphics/rasterizer';
import type { CanvasSurface, DrawOperation } from '../graphics/types';
import { CANVAS_SIZE } from './AlponaCanvas';

interface NaturalMediaPanelProps {
  studioSurface: PixelSurface;
  operations: DrawOperation[];
  surface: CanvasSurface;
  renderOptions: RenderOptions;
}

export function NaturalMediaPanel({
  studioSurface,
  operations,
  surface,
  renderOptions,
}: NaturalMediaPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [options, setOptions] = useState<NaturalMediaOptions>(
    DEFAULT_NATURAL_MEDIA_OPTIONS
  );
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Downsample to 540px for fluid interactive NPR rendering
  const previewInput = useMemo<PixelSurface>(() => {
    const dim = 540;
    const out = new Uint8ClampedArray(dim * dim * 4);
    for (let y = 0; y < dim; y++) {
      const sy = Math.min(
        studioSurface.height - 1,
        Math.floor((y / dim) * studioSurface.height)
      );
      for (let x = 0; x < dim; x++) {
        const sx = Math.min(
          studioSurface.width - 1,
          Math.floor((x / dim) * studioSurface.width)
        );
        const sOff = (sy * studioSurface.width + sx) * 4;
        const dOff = (y * dim + x) * 4;
        out[dOff] = studioSurface.data[sOff];
        out[dOff + 1] = studioSurface.data[sOff + 1];
        out[dOff + 2] = studioSurface.data[sOff + 2];
        out[dOff + 3] = 255;
      }
    }
    return { width: dim, height: dim, data: out };
  }, [studioSurface]);

  const rendered = useMemo(
    () => renderNaturalMediaAlpona(previewInput, surface.hex, options),
    [previewInput, surface.hex, options]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = rendered.width;
    canvas.height = rendered.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = new ImageData(
      new Uint8ClampedArray(rendered.data),
      rendered.width,
      rendered.height
    );
    ctx.putImageData(imgData, 0, 0);
  }, [rendered]);

  const handleDownloadHd = () => {
    const hiRes = renderUltraHdAlponaSurface(
      operations,
      surface,
      CANVAS_SIZE,
      renderOptions,
      1440,
      false
    );
    const nprHiRes = renderNaturalMediaAlpona(hiRes, surface.hex, options);
    const off = document.createElement('canvas');
    off.width = nprHiRes.width;
    off.height = nprHiRes.height;
    const ctx = off.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(
      new ImageData(
        new Uint8ClampedArray(nprHiRes.data),
        nprHiRes.width,
        nprHiRes.height
      ),
      0,
      0
    );
    const a = document.createElement('a');
    a.href = off.toDataURL('image/png');
    a.download = `alpona-natural-${options.substrate}-1440px.png`;
    a.click();
    setExportNotice(
      `Exported 1440×1440 HD Natural Media PNG (${options.substrate}).`
    );
  };

  const activeSubstrate =
    NATURAL_SUBSTRATES.find((s) => s.id === options.substrate) ??
    NATURAL_SUBSTRATES[0];

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Left: Tactile NPR Canvas */}
      <div className="space-y-4">
        <div className="mx-auto max-w-[620px] rounded-lg border border-zinc-300/90 bg-white p-3 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-zinc-900">
              {activeSubstrate.name}{' '}
              <span className="font-normal text-zinc-500">
                ({activeSubstrate.bengali})
              </span>
            </span>
            <span className="font-mono tabular-nums text-zinc-500">
              3-Octave fBm + Sobel Impasto NPR
            </span>
          </div>
          <div className="aspect-square w-full overflow-hidden rounded border border-zinc-900/15 bg-zinc-900">
            <canvas
              ref={canvasRef}
              data-testid="natural-media-canvas"
              data-substrate={options.substrate}
              className="block h-full w-full"
            />
          </div>
        </div>

        {exportNotice && (
          <div className="mx-auto max-w-[620px] rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900">
            {exportNotice}
          </div>
        )}

        <div className="mx-auto max-w-[620px] rounded-lg border border-zinc-200 bg-white p-4 text-xs leading-relaxed text-zinc-600">
          <strong className="font-semibold text-zinc-900">
            Procedural Chaler Guro (Wet Rice-Paste) NPR:
          </strong>{' '}
          Synthesizes 3-octave Fractional Brownian Motion (fBm) substrate grain,
          Sobel stroke-edge impasto ridges, dry-brush bristle breakup, and fine
          chalk powder scatter—100% deterministic with zero external image assets.
          Matching C++11 module:{' '}
          <code className="font-mono text-zinc-900">natural_media.cpp</code>.
        </div>
      </div>

      {/* Right: Substrate Cards & Tactile Media Sliders */}
      <aside className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Bengali Physical Substrate
            </h2>
            <button
              type="button"
              onClick={() => setOptions(DEFAULT_NATURAL_MEDIA_OPTIONS)}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
          <div className="space-y-2">
            {NATURAL_SUBSTRATES.map((sub) => {
              const active = options.substrate === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() =>
                    setOptions((prev) => ({ ...prev, substrate: sub.id }))
                  }
                  aria-pressed={active}
                  className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-[#B91C1C] bg-red-50/70'
                      : 'border-zinc-200 bg-white hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-900">
                      {sub.name}
                    </span>
                    <span className="text-[11px] text-zinc-500">{sub.bengali}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-zinc-600">
                    {sub.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Rice-Paste &amp; Surface Controls
          </h2>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="npr-grain-slider">Dry-Brush Grain</label>
              <span className="font-mono tabular-nums text-zinc-900">
                {Math.round(options.brushGrain * 100)}%
              </span>
            </div>
            <input
              id="npr-grain-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={options.brushGrain}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  brushGrain: Number(e.target.value),
                }))
              }
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="npr-impasto-slider">Rice-Paste Impasto</label>
              <span className="font-mono tabular-nums text-zinc-900">
                {Math.round(options.pasteImpasto * 100)}%
              </span>
            </div>
            <input
              id="npr-impasto-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={options.pasteImpasto}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  pasteImpasto: Number(e.target.value),
                }))
              }
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="npr-speckle-slider">Chalk Speckle</label>
              <span className="font-mono tabular-nums text-zinc-900">
                {Math.round(options.speckleIntensity * 100)}%
              </span>
            </div>
            <input
              id="npr-speckle-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={options.speckleIntensity}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  speckleIntensity: Number(e.target.value),
                }))
              }
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="npr-warmth-slider">Daylight Warmth</label>
              <span className="font-mono tabular-nums text-zinc-900">
                {Math.round(options.warmth * 100)}%
              </span>
            </div>
            <input
              id="npr-warmth-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={options.warmth}
              onChange={(e) =>
                setOptions((prev) => ({
                  ...prev,
                  warmth: Number(e.target.value),
                }))
              }
              className="studio-slider w-full"
            />
          </div>
        </div>

        <div className="p-5">
          <button
            type="button"
            onClick={handleDownloadHd}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#B91C1C] px-4 text-sm font-medium text-white transition-colors hover:bg-[#991B1B]"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download HD Natural Media PNG</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
