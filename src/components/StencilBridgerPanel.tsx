import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, Layers, Link2, ShieldAlert } from 'lucide-react';
import type { RenderOptions } from '../graphics/engine';
import { renderUltraHdAlponaSurface } from '../graphics/highResExport';
import type { PixelSurface } from '../graphics/rasterizer';
import { analyzeAndBridgeStencil } from '../graphics/stencilBridger';
import type { CanvasSurface, DrawOperation } from '../graphics/types';
import { CANVAS_SIZE } from './AlponaCanvas';

interface StencilBridgerPanelProps {
  studioSurface: PixelSurface;
  operations: DrawOperation[];
  surface: CanvasSurface;
  renderOptions: RenderOptions;
}

type BridgerViewMode = 'diagnostic' | 'bridged' | 'two-layer';

function paintSurface(canvas: HTMLCanvasElement | null, surf: PixelSurface) {
  if (!canvas) return;
  if (canvas.width !== surf.width || canvas.height !== surf.height) {
    canvas.width = surf.width;
    canvas.height = surf.height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(surf.width, surf.height);
  img.data.set(surf.data);
  ctx.putImageData(img, 0, 0);
}

function downloadSurfacePng(surf: PixelSurface, filename: string) {
  const off = document.createElement('canvas');
  off.width = surf.width;
  off.height = surf.height;
  const ctx = off.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(surf.width, surf.height);
  img.data.set(surf.data);
  ctx.putImageData(img, 0, 0);

  const link = document.createElement('a');
  link.href = off.toDataURL('image/png');
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function StencilBridgerPanel({
  studioSurface,
  operations,
  surface,
  renderOptions,
}: StencilBridgerPanelProps) {
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerACanvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerBCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [viewMode, setViewMode] = useState<BridgerViewMode>('diagnostic');
  const [bridgeWidth, setBridgeWidth] = useState(6);
  const [symmetricDual, setSymmetricDual] = useState(true);
  const [threshold, setThreshold] = useState(44);
  const [exportNote, setExportNote] = useState<string | null>(null);

  // Clean 2x2 box-filtered 360x360 live preview buffer for crisp 8-connected BFS island analysis
  const preview360 = useMemo<PixelSurface>(() => {
    const dim = 360;
    const data = new Uint8ClampedArray(dim * dim * 4);
    const sw = studioSurface.width;
    const sh = studioSurface.height;
    const src = studioSurface.data;
    for (let y = 0; y < dim; y++) {
      const sy0 = Math.min(sh - 1, y * 2);
      const sy1 = Math.min(sh - 1, sy0 + 1);
      for (let x = 0; x < dim; x++) {
        const sx0 = Math.min(sw - 1, x * 2);
        const sx1 = Math.min(sw - 1, sx0 + 1);
        const o00 = (sy0 * sw + sx0) * 4;
        const o10 = (sy0 * sw + sx1) * 4;
        const o01 = (sy1 * sw + sx0) * 4;
        const o11 = (sy1 * sw + sx1) * 4;
        const dOff = (y * dim + x) * 4;
        data[dOff] = (src[o00] + src[o10] + src[o01] + src[o11]) >> 2;
        data[dOff + 1] =
          (src[o00 + 1] + src[o10 + 1] + src[o01 + 1] + src[o11 + 1]) >> 2;
        data[dOff + 2] =
          (src[o00 + 2] + src[o10 + 2] + src[o01 + 2] + src[o11 + 2]) >> 2;
        data[dOff + 3] = 255;
      }
    }
    return { width: dim, height: dim, data };
  }, [studioSurface]);

  const analysis = useMemo(
    () => analyzeAndBridgeStencil(preview360, bridgeWidth, symmetricDual, threshold),
    [preview360, bridgeWidth, symmetricDual, threshold]
  );

  useEffect(() => {
    if (viewMode === 'two-layer') {
      paintSurface(layerACanvasRef.current, analysis.layerA);
      paintSurface(layerBCanvasRef.current, analysis.layerB);
    } else if (viewMode === 'bridged') {
      paintSurface(mainCanvasRef.current, analysis.bridgedStencil);
    } else {
      paintSurface(mainCanvasRef.current, analysis.diagnosticView);
    }
  }, [viewMode, analysis]);

  const computeHdAnalysis = () => {
    const hiSurf = renderUltraHdAlponaSurface(
      operations,
      surface,
      CANVAS_SIZE,
      renderOptions,
      720,
      false
    );
    return analyzeAndBridgeStencil(
      hiSurf,
      Math.min(16, bridgeWidth * 2),
      symmetricDual,
      threshold
    );
  };

  const handleDownloadBridged = () => {
    const hd = computeHdAnalysis();
    downloadSurfacePng(hd.bridgedStencil, 'alpona-laser-bridged-stencil-hd.png');
    setExportNote(
      `Exported Cut-Ready Bridged Stencil (${hd.bridgedStencil.width} × ${hd.bridgedStencil.height} px, ${hd.remainingIslandCount} islands remaining).`
    );
    setTimeout(() => setExportNote(null), 3000);
  };

  const handleDownloadTwoLayers = () => {
    const hd = computeHdAnalysis();
    downloadSurfacePng(hd.layerA, 'alpona-zero-bridge-layer-A.png');
    downloadSurfacePng(hd.layerB, 'alpona-zero-bridge-layer-B.png');
    setExportNote(
      'Exported 2-Layer Zero-Bridge Stencil Set (Layer A & Layer B with red + registration marks).'
    );
    setTimeout(() => setExportNote(null), 3000);
  };

  const allSafe = analysis.remainingIslandCount === 0;

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Left: Diagnostic / Cut-Ready / 2-Layer Stencil Stage */}
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Laser / Cricut Stencil Island Detector &amp; Auto-Bridger
              </h2>
              <p className="text-xs text-zinc-500">
                8-connected BFS detects disconnected floating islands inside closed
                Alpona rings and adds shortest Euclidean (Dₑ) material bridges.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-1">
              {(
                [
                  { id: 'diagnostic', label: 'Diagnostic View' },
                  { id: 'bridged', label: 'Cut-Ready Bridged' },
                  { id: 'two-layer', label: '2-Layer Split' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setViewMode(tab.id)}
                  aria-pressed={viewMode === tab.id}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    viewMode === tab.id
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {viewMode === 'two-layer' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 bg-zinc-100/80 p-3 text-center">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-900">
                    Layer A (Outer &amp; Even Rings)
                  </span>
                  <span className="font-mono text-[11px] text-[#B91C1C]">
                    Red + Align
                  </span>
                </div>
                <canvas
                  ref={layerACanvasRef}
                  data-testid="stencil-layer-a-canvas"
                  className="mx-auto block w-full max-w-[320px] rounded border border-zinc-300 bg-white"
                />
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-100/80 p-3 text-center">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-900">
                    Layer B (Inner &amp; Odd Rings)
                  </span>
                  <span className="font-mono text-[11px] text-[#B91C1C]">
                    Red + Align
                  </span>
                </div>
                <canvas
                  ref={layerBCanvasRef}
                  data-testid="stencil-layer-b-canvas"
                  className="mx-auto block w-full max-w-[320px] rounded border border-zinc-300 bg-white"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-lg border border-zinc-200 bg-zinc-100/80 p-4">
              <canvas
                ref={mainCanvasRef}
                data-testid="stencil-bridger-canvas"
                data-initial-islands={analysis.initialIslandCount}
                data-remaining-islands={analysis.remainingIslandCount}
                data-bridges={analysis.bridges.length}
                className="w-full max-w-[460px] rounded border border-zinc-300 bg-white shadow-xs"
              />

              {/* Clean Unboxed Legend */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-zinc-700">
                {viewMode === 'diagnostic' ? (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-xs bg-[#DC2626]" />
                      <span>Floating Islands ({analysis.initialIslandCount})</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-xs bg-[#10B981]" />
                      <span>Auto-Bridges Added ({analysis.bridges.length})</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-xs border border-zinc-300 bg-[#F8F7F3]" />
                      <span>Anchored Sheet</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-xs bg-zinc-900" />
                      <span>Laser Cut Opening</span>
                    </span>
                  </>
                ) : (
                  <span>
                    Pure B&amp;W Cut-Ready Sheet: Dark regions are laser/Cricut
                    cutouts; white bridges hold every interior piece intact.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Control & BFS Connectivity Rail */}
      <aside className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200/90">
        {/* BFS Connectivity Audit */}
        <section className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              BFS Connectivity Audit
            </h2>
            <span className="font-mono text-[11px] text-zinc-500">
              BFS · 8-Adj
            </span>
          </div>

          <div
            className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
              allSafe
                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                : 'border-amber-200 bg-amber-50/70 text-amber-950'
            }`}
          >
            {allSafe ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
            ) : (
              <ShieldAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                aria-hidden="true"
              />
            )}
            <div>
              <div className="font-semibold">
                {allSafe
                  ? 'Zero Floating Islands — Cut-Ready!'
                  : `${analysis.remainingIslandCount} Islands Still Unanchored`}
              </div>
              <div className="mt-0.5 text-[11px] opacity-85">
                {analysis.initialIslandCount === 0
                  ? 'No enclosed cutouts detected in this Alpona.'
                  : `Anchored all ${analysis.initialIslandCount} floating stencil islands using ${analysis.bridges.length} shortest-Dₑ bridges.`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono text-center">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
              <div className="text-[10px] uppercase text-zinc-500">Initial</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums text-[#B91C1C]">
                {analysis.initialIslandCount}
              </div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
              <div className="text-[10px] uppercase text-zinc-500">Bridges</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900">
                {analysis.bridges.length}
              </div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2">
              <div className="text-[10px] uppercase text-zinc-500">Remaining</div>
              <div
                className={`mt-0.5 text-base font-semibold tabular-nums ${
                  allSafe ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {analysis.remainingIslandCount}
              </div>
            </div>
          </div>
        </section>

        {/* Bridge Parameters */}
        <section className="space-y-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Bridge Geometry
            </h2>
            <span className="font-mono text-[11px] text-zinc-500">
              Multi-Source BFS
            </span>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="stencil-bridge-width">Bridge width</label>
              <span className="font-mono font-medium tabular-nums text-zinc-900">
                {bridgeWidth} px
              </span>
            </div>
            <input
              id="stencil-bridge-width"
              type="range"
              min={3}
              max={14}
              step={1}
              value={bridgeWidth}
              onChange={(e) => setBridgeWidth(Number(e.target.value))}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="stencil-cut-threshold">Cut sensitivity</label>
              <span className="font-mono font-medium tabular-nums text-zinc-900">
                {threshold}
              </span>
            </div>
            <input
              id="stencil-cut-threshold"
              type="range"
              min={24}
              max={84}
              step={2}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="studio-slider w-full"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-xs font-medium text-zinc-800">
            <input
              type="checkbox"
              checked={symmetricDual}
              onChange={(e) => setSymmetricDual(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-[#B91C1C]"
            />
            <span>Symmetric twin bridges (balanced rigidity)</span>
          </label>
        </section>

        {/* Export Cut-Ready Files */}
        <section className="space-y-2 p-4">
          <button
            type="button"
            onClick={handleDownloadBridged}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#B91C1C] px-3 text-xs font-medium text-white transition-colors hover:bg-[#991B1B]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download Bridged Stencil PNG (HD)</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTwoLayers}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            <Layers className="h-3.5 w-3.5 text-zinc-700" aria-hidden="true" />
            <span>Download 2-Layer Zero-Bridge Set</span>
          </button>
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-zinc-500">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
            <span>
              Prevents inner lotus rings from falling out on Cricut, Mylar &amp;
              CO₂ laser cutters.
            </span>
          </div>
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
