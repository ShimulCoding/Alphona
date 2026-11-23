import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Download, RotateCcw } from 'lucide-react';
import type { PixelSurface } from '../graphics/rasterizer';
import {
  buildStampHeightfield,
  DEFAULT_STL_STAMP_OPTIONS,
  generateStampMesh,
  renderStampTurntablePreview,
  serializeAsciiObj,
  serializeBinaryStl,
  type StampPresetMode,
  type StlStampOptions,
} from '../graphics/stlStampExporter';
import type { CanvasSurface } from '../graphics/types';

interface StlStampPanelProps {
  alponaTexture: PixelSurface;
  surface: CanvasSurface;
}

const PREVIEW_W = 540;
const PREVIEW_H = 420;

const PRESET_CARDS: Array<{
  mode: StampPresetMode;
  label: string;
  desc: string;
  defaults: Partial<StlStampOptions>;
}> = [
  {
    mode: 'woodblock-stamp',
    label: 'Woodblock Stamp',
    desc: 'Mirrored raised relief + grip handle for saree & cloth block printing',
    defaults: {
      mode: 'woodblock-stamp',
      mirrorHorizontal: true,
      circularBase: true,
      includeHandle: true,
      reliefHeightMm: 3.4,
      baseThicknessMm: 4.5,
    },
  },
  {
    mode: 'pitha-mold',
    label: 'Pitha Mold',
    desc: 'Intaglio recessed cavity so pressed rice dough forms raised Bengali Pitha',
    defaults: {
      mode: 'pitha-mold',
      mirrorHorizontal: false,
      circularBase: true,
      includeHandle: false,
      reliefHeightMm: 3.8,
      baseThicknessMm: 4.0,
    },
  },
  {
    mode: 'terracotta-coaster',
    label: 'Terracotta Coaster',
    desc: 'Direct raised relief disc for 3D printing, clay press, or CNC carving',
    defaults: {
      mode: 'terracotta-coaster',
      mirrorHorizontal: false,
      circularBase: true,
      includeHandle: false,
      reliefHeightMm: 2.6,
      baseThicknessMm: 4.0,
    },
  },
];

export function StlStampPanel({ alponaTexture, surface }: StlStampPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);

  const [options, setOptions] = useState<StlStampOptions>(DEFAULT_STL_STAMP_OPTIONS);
  const [yawDeg, setYawDeg] = useState(28);
  const [pitchDeg, setPitchDeg] = useState(46);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const heightfield = useMemo(
    () => buildStampHeightfield(alponaTexture, surface.hex, options),
    [alponaTexture, surface.hex, options]
  );

  const mesh = useMemo(
    () => generateStampMesh(heightfield, options),
    [heightfield, options]
  );

  const previewSurface = useMemo(
    () =>
      renderStampTurntablePreview(
        heightfield,
        options,
        yawDeg,
        pitchDeg,
        PREVIEW_W,
        PREVIEW_H
      ),
    [heightfield, options, yawDeg, pitchDeg]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = new ImageData(
      new Uint8ClampedArray(previewSurface.data),
      previewSurface.width,
      previewSurface.height
    );
    ctx.putImageData(imgData, 0, 0);
  }, [previewSurface]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      yaw: yawDeg,
      pitch: pitchDeg,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setYawDeg(Math.round(dragRef.current.yaw + dx * 0.55));
    setPitchDeg(Math.max(20, Math.min(80, Math.round(dragRef.current.pitch + dy * 0.45))));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleDownloadStl = () => {
    const bytes = serializeBinaryStl(mesh);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy.buffer], { type: 'model/stl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alpona-${options.mode}-${options.diameterMm}mm.stl`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportNotice(
      `Exported watertight binary .STL (${mesh.triangleCount.toLocaleString()} triangles, ${(bytes.byteLength / 1024).toFixed(0)} KB).`
    );
  };

  const handleDownloadObj = () => {
    const objText = serializeAsciiObj(mesh);
    const blob = new Blob([objText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alpona-${options.mode}-${options.diameterMm}mm.obj`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportNotice(
      `Exported Wavefront .OBJ (${mesh.triangleCount.toLocaleString()} triangles) for Blender / CAD.`
    );
  };

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Left: Turntable Relief Preview & Mesh Readout */}
      <div className="space-y-4">
        <div className="rounded-lg border border-zinc-300/90 bg-white p-3 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-zinc-900">
              3D Relief Turntable Preview (Drag to Rotate)
            </span>
            <span className="font-mono tabular-nums text-zinc-500">
              Yaw {yawDeg}° · Pitch {pitchDeg}° · {options.diameterMm}×{options.diameterMm}×{mesh.heightMm} mm
            </span>
          </div>
          <div className="w-full overflow-hidden rounded border border-zinc-900/15 bg-[#1C1A1D]">
            <canvas
              ref={canvasRef}
              width={PREVIEW_W}
              height={PREVIEW_H}
              data-testid="stl-stamp-canvas"
              data-mode={options.mode}
              data-triangles={mesh.triangleCount}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="block h-auto w-full cursor-grab touch-none active:cursor-grabbing"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded border border-zinc-200 bg-[#FBF9F5] px-3 py-2">
              <div className="text-[11px] font-medium text-zinc-500">Triangles</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-zinc-900">
                {mesh.triangleCount.toLocaleString()}
              </div>
            </div>
            <div className="rounded border border-zinc-200 bg-[#FBF9F5] px-3 py-2">
              <div className="text-[11px] font-medium text-zinc-500">Est. Volume</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-zinc-900">
                {mesh.estimatedVolumeCm3} cm³
              </div>
            </div>
            <div className="rounded border border-zinc-200 bg-[#FBF9F5] px-3 py-2">
              <div className="text-[11px] font-medium text-zinc-500">Footprint</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-zinc-900">
                {options.diameterMm} mm {options.circularBase ? 'Ø' : 'sq'}
              </div>
            </div>
            <div className="rounded border border-zinc-200 bg-[#FBF9F5] px-3 py-2">
              <div className="text-[11px] font-medium text-zinc-500">Total Height</div>
              <div className="font-mono text-sm font-semibold tabular-nums text-zinc-900">
                {mesh.heightMm} mm
              </div>
            </div>
          </div>
        </div>

        {exportNotice && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900">
            {exportNotice}
          </div>
        )}

        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-xs leading-relaxed text-zinc-600">
          <strong className="font-semibold text-zinc-900">
            Watertight Manifold Heightfield Mesh:
          </strong>{' '}
          Applies a 3×3 Gaussian draft-angle bevel so rice dough releases cleanly from
          <span className="font-medium text-zinc-800"> Pitha Molds</span> and fabric ink transfers crisply from{' '}
          <span className="font-medium text-zinc-800">Mirrored Woodblock Stamps</span>. Ready for Cura, PrusaSlicer, Bambu Studio, and CNC routing. Matching C++11 module:{' '}
          <code className="font-mono text-zinc-900">stl_stamp.cpp</code>.
        </div>
      </div>

      {/* Right: Stamp & Mold Controls */}
      <aside className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Craft Preset
            </h2>
            <button
              type="button"
              onClick={() => {
                setOptions(DEFAULT_STL_STAMP_OPTIONS);
                setYawDeg(28);
                setPitchDeg(46);
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
          <div className="space-y-2">
            {PRESET_CARDS.map((p) => {
              const active = options.mode === p.mode;
              return (
                <button
                  key={p.mode}
                  type="button"
                  onClick={() => setOptions((prev) => ({ ...prev, ...p.defaults }))}
                  aria-pressed={active}
                  className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-[#B91C1C] bg-red-50/70'
                      : 'border-zinc-200 bg-white hover:bg-zinc-50'
                  }`}
                >
                  <div className="text-xs font-semibold text-zinc-900">{p.label}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-zinc-600">
                    {p.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Physical Dimensions (mm)
          </h2>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="stl-diameter-slider">Diameter / Width</label>
              <span className="font-mono tabular-nums text-zinc-900">
                {options.diameterMm} mm
              </span>
            </div>
            <input
              id="stl-diameter-slider"
              type="range"
              min={60}
              max={140}
              step={5}
              value={options.diameterMm}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, diameterMm: Number(e.target.value) }))
              }
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="stl-relief-slider">Relief Depth</label>
              <span className="font-mono tabular-nums text-zinc-900">
                {options.reliefHeightMm.toFixed(1)} mm
              </span>
            </div>
            <input
              id="stl-relief-slider"
              type="range"
              min={1.5}
              max={6.0}
              step={0.2}
              value={options.reliefHeightMm}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, reliefHeightMm: Number(e.target.value) }))
              }
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="stl-base-slider">Baseplate Thickness</label>
              <span className="font-mono tabular-nums text-zinc-900">
                {options.baseThicknessMm.toFixed(1)} mm
              </span>
            </div>
            <input
              id="stl-base-slider"
              type="range"
              min={2.5}
              max={8.0}
              step={0.5}
              value={options.baseThicknessMm}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, baseThicknessMm: Number(e.target.value) }))
              }
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
              <label htmlFor="stl-res-slider">Mesh Resolution</label>
              <span className="font-mono tabular-nums text-zinc-900">
                {options.gridSize}×{options.gridSize}
              </span>
            </div>
            <input
              id="stl-res-slider"
              type="range"
              min={48}
              max={104}
              step={8}
              value={options.gridSize}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, gridSize: Number(e.target.value) }))
              }
              className="studio-slider w-full"
            />
          </div>
        </div>

        <div className="space-y-2.5 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Geometry Options
          </h2>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={options.mirrorHorizontal}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, mirrorHorizontal: e.target.checked }))
              }
              className="h-4 w-4 rounded border-zinc-300 accent-[#B91C1C]"
            />
            <span>Mirror X for Block Print</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={options.circularBase}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, circularBase: e.target.checked }))
              }
              className="h-4 w-4 rounded border-zinc-300 accent-[#B91C1C]"
            />
            <span>Circular Disc Footprint</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={options.includeHandle}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, includeHandle: e.target.checked }))
              }
              className="h-4 w-4 rounded border-zinc-300 accent-[#B91C1C]"
            />
            <span>Add Back Grip Handle</span>
          </label>
        </div>

        <div className="space-y-2.5 p-5">
          <button
            type="button"
            onClick={handleDownloadStl}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#B91C1C] px-4 text-sm font-medium text-white transition-colors hover:bg-[#991B1B]"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download Binary .STL</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadObj}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            <Box className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download Wavefront .OBJ</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
