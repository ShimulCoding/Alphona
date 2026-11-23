import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import type { PixelSurface } from '../graphics/rasterizer';
import {
  buildWeaveChart,
  exportWeaveChartCsv,
  renderWeaveChartToCanvas,
  type WeaveDitherMode,
  type WeavePalettePreset,
} from '../graphics/weaveChart';

interface WeaveChartPanelProps {
  studioSurface: PixelSurface;
}

const GRID_PRESETS = [32, 48, 64, 80];

const PALETTE_PRESETS: Array<{ id: WeavePalettePreset; label: string }> = [
  { id: 'jamdani-zari', label: 'Jamdani Zari' },
  { id: 'nakshi-kantha', label: 'Nakshi Kantha' },
  { id: 'dmc-heritage', label: 'DMC Heritage' },
  { id: 'alpona-source', label: 'Alpona K-Means' },
];

const DITHER_MODES: Array<{ id: WeaveDitherMode; label: string }> = [
  { id: 'nearest', label: 'Nearest' },
  { id: 'bayer', label: '4×4 Bayer' },
  { id: 'floyd-steinberg', label: 'Floyd-Steinberg' },
];

const CLOTH_COUNTS = [11, 14, 18];

export function WeaveChartPanel({ studioSurface }: WeaveChartPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [gridSize, setGridSize] = useState(48);
  const [maxColors, setMaxColors] = useState(6);
  const [palettePreset, setPalettePreset] =
    useState<WeavePalettePreset>('jamdani-zari');
  const [ditherMode, setDitherMode] = useState<WeaveDitherMode>('bayer');
  const [clothCount, setClothCount] = useState(14);
  const [showSymbols, setShowSymbols] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const chart = useMemo(
    () =>
      buildWeaveChart(studioSurface, {
        gridSize,
        maxColors,
        ditherMode,
        palettePreset,
        clothCountPerInch: clothCount,
      }),
    [studioSurface, gridSize, maxColors, ditherMode, palettePreset, clothCount]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cellPx = gridSize <= 48 ? 11 : gridSize <= 64 ? 9 : 8;
    renderWeaveChartToCanvas(canvas, chart, cellPx, showSymbols);
  }, [chart, gridSize, showSymbols]);

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `alpona-weave-${gridSize}x${gridSize}-${palettePreset}.png`;
    a.click();
    setNotice(`Saved numbered ${gridSize}×${gridSize} Jamdani/Kantha graph PNG.`);
  };

  const handleDownloadCsv = () => {
    const csv = exportWeaveChartCsv(chart);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alpona-weave-${gridSize}x${gridSize}-${palettePreset}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      `Exported ${gridSize}×${gridSize} loom stitch matrix (.CSV) with thread meter totals.`
    );
  };

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Left: Numbered Warp x Weft Graph Canvas + Thread Table */}
      <div className="space-y-4">
        <div className="rounded-lg border border-zinc-300/90 bg-white p-3 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-zinc-900">
              Numbered Warp × Weft Loom Graph ({chart.gridSize}×{chart.gridSize})
            </span>
            <span className="font-mono tabular-nums text-zinc-500">
              {chart.totalStitches.toLocaleString()} stitches · {chart.finishedSizeCm} ×{' '}
              {chart.finishedSizeCm} cm @ {clothCount}ct
            </span>
          </div>
          <div className="overflow-auto rounded border border-zinc-200 bg-[#FAF8F3] p-2">
            <canvas
              ref={canvasRef}
              data-testid="weave-chart-canvas"
              data-grid-size={chart.gridSize}
              data-dither={chart.ditherMode}
              className="mx-auto block h-auto max-w-full"
            />
          </div>
        </div>

        {notice && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900">
            {notice}
          </div>
        )}

        {/* Thread & Yarn Requirement Table */}
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Thread &amp; Zari Yardage Breakdown
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 bg-[#FBF9F5] text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Sym</th>
                  <th className="px-4 py-2 font-medium">Thread Shade</th>
                  <th className="px-4 py-2 font-medium">Hex</th>
                  <th className="px-4 py-2 text-right font-medium">Stitches</th>
                  <th className="px-4 py-2 text-right font-medium">Share</th>
                  <th className="px-4 py-2 text-right font-medium">Est. Thread</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {chart.threads.map((t) => (
                  <tr key={t.index} className="hover:bg-zinc-50/70">
                    <td className="px-4 py-2 font-mono text-sm font-semibold text-zinc-900">
                      {t.symbol}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2 font-medium text-zinc-900">
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-sm border border-zinc-300"
                          style={{ backgroundColor: t.hex }}
                        />
                        {t.name}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-zinc-600">{t.hex}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-zinc-900">
                      {t.stitchCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-zinc-600">
                      {t.percent}%
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums font-medium text-zinc-900">
                      {t.estimatedThreadMeters.toFixed(2)} m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right: Loom & Stitch Chart Controls */}
      <aside className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="space-y-3 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Warp × Weft Resolution
          </h2>
          <div className="grid grid-cols-4 gap-1.5">
            {GRID_PRESETS.map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setGridSize(sz)}
                aria-pressed={gridSize === sz}
                className={`h-8 rounded border font-mono text-xs font-medium transition-colors ${
                  gridSize === sz
                    ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {sz}²
              </button>
            ))}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="weave-colors-slider">Max Thread Colors</label>
              <span className="font-mono tabular-nums text-zinc-900">
                {maxColors} shades
              </span>
            </div>
            <input
              id="weave-colors-slider"
              type="range"
              min={3}
              max={8}
              step={1}
              value={maxColors}
              onChange={(e) => setMaxColors(Number(e.target.value))}
              className="studio-slider w-full"
            />
          </div>
        </div>

        <div className="space-y-3 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Bengali Thread Palette
          </h2>
          <div className="grid grid-cols-2 gap-1.5">
            {PALETTE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPalettePreset(p.id)}
                aria-pressed={palettePreset === p.id}
                className={`rounded border px-2.5 py-2 text-xs font-medium transition-colors ${
                  palettePreset === p.id
                    ? 'border-[#B91C1C] bg-red-50 text-[#991B1B]'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Quantization &amp; Dithering
          </h2>
          <div className="grid grid-cols-3 gap-1.5">
            {DITHER_MODES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDitherMode(d.id)}
                aria-pressed={ditherMode === d.id}
                className={`rounded border px-2 py-2 text-[11px] font-medium transition-colors ${
                  ditherMode === d.id
                    ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div>
            <div className="mb-1.5 text-xs text-zinc-600">Fabric / Loom Count</div>
            <div className="grid grid-cols-3 gap-1.5">
              {CLOTH_COUNTS.map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => setClothCount(ct)}
                  aria-pressed={clothCount === ct}
                  className={`h-8 rounded border font-mono text-xs font-medium transition-colors ${
                    clothCount === ct
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {ct} ct
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={showSymbols}
              onChange={(e) => setShowSymbols(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-[#B91C1C]"
            />
            <span>Show stitch symbols inside cells</span>
          </label>
        </div>

        <div className="space-y-2.5 p-5">
          <button
            type="button"
            onClick={handleDownloadPng}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#B91C1C] px-4 text-sm font-medium text-white transition-colors hover:bg-[#991B1B]"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Graph PNG</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download Loom .CSV</span>
          </button>
          <p className="pt-1 text-[11px] leading-relaxed text-zinc-500">
            Red rulings mark every 10th warp/weft thread for Jamdani extra-weft weaving and
            Nakshi Kantha embroidery. Matching C++11 module:{' '}
            <code className="font-mono text-zinc-800">weave_chart.cpp</code>.
          </p>
        </div>
      </aside>
    </div>
  );
}
