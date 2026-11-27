import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Layers, Sparkles } from 'lucide-react';
import type { RenderOptions } from '../graphics/engine';
import {
  buildFriezeBorderStudio,
  FRIEZE_GROUPS,
  type FriezeGroupId,
} from '../graphics/friezeBorder';
import { renderUltraHdAlponaSurface } from '../graphics/highResExport';
import type { PixelSurface } from '../graphics/rasterizer';
import type { CanvasSurface, DrawOperation } from '../graphics/types';
import { CANVAS_SIZE } from './AlponaCanvas';

interface FriezeBorderPanelProps {
  studioSurface: PixelSurface;
  operations: DrawOperation[];
  surface: CanvasSurface;
  renderOptions: RenderOptions;
  sectors: number;
}

const SAREE_FABRICS = [
  { id: 'terracotta', name: 'Red Clay', hex: '#8C3B2B' },
  { id: 'indigo', name: 'Jamdani Indigo', hex: '#1D3557' },
  { id: 'halud', name: 'Halud Gold', hex: '#A16207' },
  { id: 'slate', name: 'Courtyard Slate', hex: '#262628' },
  { id: 'ivory', name: 'Handloom Ivory', hex: '#EDE7DA' },
];

function paintPixelSurface(
  canvas: HTMLCanvasElement | null,
  surface: PixelSurface
) {
  if (!canvas) return;
  if (canvas.width !== surface.width || canvas.height !== surface.height) {
    canvas.width = surface.width;
    canvas.height = surface.height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(surface.width, surface.height);
  img.data.set(surface.data);
  ctx.putImageData(img, 0, 0);
}

function downloadPixelSurfacePng(surface: PixelSurface, filename: string) {
  const off = document.createElement('canvas');
  off.width = surface.width;
  off.height = surface.height;
  const ctx = off.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(surface.width, surface.height);
  img.data.set(surface.data);
  ctx.putImageData(img, 0, 0);

  const link = document.createElement('a');
  link.href = off.toDataURL('image/png');
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function FriezeBorderPanel({
  studioSurface,
  operations,
  surface,
  renderOptions,
  sectors,
}: FriezeBorderPanelProps) {
  const stripCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cornerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [group, setGroup] = useState<FriezeGroupId>('p2mg');
  const [innerRadiusFrac, setInnerRadiusFrac] = useState(0.26);
  const [outerRadiusFrac, setOuterRadiusFrac] = useState(0.9);
  const [repeatCount, setRepeatCount] = useState(4);
  const [trimLines, setTrimLines] = useState(true);
  const [fabricHex, setFabricHex] = useState(SAREE_FABRICS[0].hex);
  const [exportNote, setExportNote] = useState<string | null>(null);

  const trimColorHex = surface.id === 'paper' ? '#B91C1C' : '#FAF8F2';

  const result = useMemo(
    () =>
      buildFriezeBorderStudio(
        studioSurface,
        {
          group,
          innerRadiusFrac,
          outerRadiusFrac,
          repeatCount,
          trimLines,
          trimColorHex,
          fabricHex,
          sectors,
        },
        140,
        112,
        420
      ),
    [
      studioSurface,
      group,
      innerRadiusFrac,
      outerRadiusFrac,
      repeatCount,
      trimLines,
      trimColorHex,
      fabricHex,
      sectors,
    ]
  );

  useEffect(() => {
    paintPixelSurface(stripCanvasRef.current, result.strip);
    paintPixelSurface(cornerCanvasRef.current, result.corner90);
  }, [result]);

  const activeGroupSpec =
    FRIEZE_GROUPS.find((g) => g.id === group) ?? FRIEZE_GROUPS[0];

  const handleDownloadStripHd = () => {
    const hiAlpona = renderUltraHdAlponaSurface(
      operations,
      surface,
      CANVAS_SIZE,
      renderOptions,
      1440,
      false
    );
    const hd = buildFriezeBorderStudio(
      hiAlpona,
      {
        group,
        innerRadiusFrac,
        outerRadiusFrac,
        repeatCount,
        trimLines,
        trimColorHex,
        fabricHex,
        sectors,
      },
      360,
      280,
      960
    );
    downloadPixelSurfacePng(
      hd.strip,
      `alpona-saree-paar-${group}-${repeatCount}x-hd.png`
    );
    setExportNote(
      `Exported HD Saree Paar Strip (${hd.strip.width} × ${hd.strip.height} px).`
    );
    setTimeout(() => setExportNote(null), 2800);
  };

  const handleDownloadCornerHd = () => {
    const hiAlpona = renderUltraHdAlponaSurface(
      operations,
      surface,
      CANVAS_SIZE,
      renderOptions,
      1440,
      false
    );
    const hd = buildFriezeBorderStudio(
      hiAlpona,
      {
        group,
        innerRadiusFrac,
        outerRadiusFrac,
        repeatCount,
        trimLines,
        trimColorHex,
        fabricHex,
        sectors,
      },
      320,
      240,
      1440
    );
    downloadPixelSurfacePng(
      hd.corner90,
      `alpona-anchal-corner90-${group}-hd.png`
    );
    setExportNote(
      `Exported HD 90° Mitered Corner (${hd.corner90.width} × ${hd.corner90.height} px).`
    );
    setTimeout(() => setExportNote(null), 2800);
  };

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Left Visual Outputs: Seamless Repeating Strip + 90 deg Mitered Anchal Corner */}
      <div className="space-y-5">
        {/* Seamless Saree Paar / Street Runner Strip */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-xs">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Seamless Saree Paar &amp; Street Runner Strip
              </h2>
              <p className="text-xs text-zinc-500">
                Polar-to-Cartesian unwrapped ring mapped with 1D Frieze group{' '}
                <span className="font-mono font-semibold text-zinc-800">
                  {activeGroupSpec.notation}
                </span>{' '}
                ({activeGroupSpec.name}).
              </p>
            </div>
            <span className="font-mono text-[11px] tabular-nums text-zinc-500">
              {result.strip.width} × {result.strip.height} px · {repeatCount}× repeat
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-950 p-2">
            <canvas
              ref={stripCanvasRef}
              data-testid="frieze-strip-canvas"
              data-frieze-group={group}
              data-repeats={repeatCount}
              className="mx-auto block max-h-[210px] w-full object-contain"
            />
          </div>
        </div>

        {/* 90-Degree Mitered Anchal / Doorframe L-Corner */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-xs">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                90° Mitered Anchal &amp; Doorframe Corner
              </h2>
              <p className="text-xs text-zinc-500">
                Mirrors the border cleanly across the exact 45° diagonal (x = y) so
                handloom saree corners, invites, and wedding walkways lock seamlessly.
              </p>
            </div>
            <span className="font-mono text-[11px] tabular-nums text-zinc-500">
              45° Miter Fold · {result.corner90.width} × {result.corner90.height} px
            </span>
          </div>

          <div className="flex justify-center rounded-lg border border-zinc-200 bg-zinc-100/80 p-3">
            <canvas
              ref={cornerCanvasRef}
              data-testid="frieze-corner-canvas"
              className="w-full max-w-[420px] rounded border border-zinc-300 shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Right Control Rail */}
      <aside className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200/90">
        {/* 7 Mathematical 1D Frieze Groups */}
        <section className="space-y-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              7 Frieze Symmetry Groups
            </h2>
            <span className="font-mono text-[11px] text-zinc-500">1D Symmetry</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {FRIEZE_GROUPS.map((fg) => {
              const active = group === fg.id;
              return (
                <button
                  key={fg.id}
                  type="button"
                  onClick={() => setGroup(fg.id)}
                  aria-pressed={active}
                  className={`rounded-md border px-2.5 py-2 text-left transition-colors ${
                    active
                      ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                      : 'border-zinc-200 bg-zinc-50/70 text-zinc-800 hover:border-zinc-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-semibold">
                      {fg.notation}
                    </span>
                    <Layers
                      className={`h-3 w-3 ${active ? 'text-red-100' : 'text-zinc-400'}`}
                      aria-hidden="true"
                    />
                  </div>
                  <div
                    className={`mt-0.5 truncate text-[11px] ${
                      active ? 'text-red-50' : 'text-zinc-500'
                    }`}
                  >
                    {fg.name}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-600">
            <strong className="font-semibold text-zinc-800">
              {activeGroupSpec.notation}:
            </strong>{' '}
            {activeGroupSpec.symmetryDesc}.
          </p>
        </section>

        {/* Polar Ring Slice & Repeat Controls */}
        <section className="space-y-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Polar Ring Unwrap
            </h2>
            <span className="font-mono text-[11px] text-zinc-500">
              {sectors} sectors
            </span>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="frieze-inner-r">Inner ring radius</label>
              <span className="font-mono font-medium tabular-nums text-zinc-900">
                {Math.round(innerRadiusFrac * 100)}%
              </span>
            </div>
            <input
              id="frieze-inner-r"
              type="range"
              min={12}
              max={62}
              step={2}
              value={Math.round(innerRadiusFrac * 100)}
              onChange={(e) => {
                const next = Number(e.target.value) / 100;
                setInnerRadiusFrac(next);
                if (next + 0.16 > outerRadiusFrac) {
                  setOuterRadiusFrac(Math.min(0.98, next + 0.16));
                }
              }}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="frieze-outer-r">Outer ring radius</label>
              <span className="font-mono font-medium tabular-nums text-zinc-900">
                {Math.round(outerRadiusFrac * 100)}%
              </span>
            </div>
            <input
              id="frieze-outer-r"
              type="range"
              min={44}
              max={98}
              step={2}
              value={Math.round(outerRadiusFrac * 100)}
              onChange={(e) => {
                const next = Number(e.target.value) / 100;
                setOuterRadiusFrac(next);
                if (next - 0.16 < innerRadiusFrac) {
                  setInnerRadiusFrac(Math.max(0.12, next - 0.16));
                }
              }}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="frieze-repeats">Horizontal repeats</label>
              <span className="font-mono font-medium tabular-nums text-zinc-900">
                {repeatCount}×
              </span>
            </div>
            <input
              id="frieze-repeats"
              type="range"
              min={2}
              max={8}
              step={1}
              value={repeatCount}
              onChange={(e) => setRepeatCount(Number(e.target.value))}
              className="studio-slider w-full"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-xs font-medium text-zinc-800">
            <input
              type="checkbox"
              checked={trimLines}
              onChange={(e) => setTrimLines(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-[#B91C1C]"
            />
            <span>Traditional double saree-paar trim lines</span>
          </label>
        </section>

        {/* Saree Fabric Ground */}
        <section className="space-y-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Corner Fabric Ground
            </h2>
            <span className="font-mono text-[11px] text-zinc-500">Anchal</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {SAREE_FABRICS.map((fab) => {
              const active = fabricHex === fab.hex;
              return (
                <button
                  key={fab.id}
                  type="button"
                  onClick={() => setFabricHex(fab.hex)}
                  aria-label={`Select ${fab.name} fabric`}
                  aria-pressed={active}
                  title={fab.name}
                  className={`flex flex-col items-center gap-1 rounded-md border p-1.5 text-[10px] font-medium transition-colors ${
                    active
                      ? 'border-[#B91C1C] bg-red-50/50 text-zinc-950'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                  }`}
                >
                  <span
                    className="h-5 w-full rounded-sm border border-black/15"
                    style={{ backgroundColor: fab.hex }}
                  />
                  <span className="w-full truncate text-center">
                    {fab.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* HD Export Actions */}
        <section className="space-y-2 p-4">
          <button
            type="button"
            onClick={handleDownloadStripHd}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#B91C1C] px-3 text-xs font-medium text-white transition-colors hover:bg-[#991B1B]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download HD Border Strip PNG</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadCornerHd}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#B91C1C]" aria-hidden="true" />
            <span>Download HD 90° Mitered Corner PNG</span>
          </button>
          {exportNote && (
            <p role="status" className="pt-1 text-xs font-medium text-emerald-700">
              {exportNote}
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
