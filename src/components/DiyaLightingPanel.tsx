import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Flame, Plus, Trash2 } from 'lucide-react';
import type { RenderOptions } from '../graphics/engine';
import { renderUltraHdAlponaSurface } from '../graphics/highResExport';
import {
  DEFAULT_PHONG_PARAMS,
  DIYA_LIGHT_PRESETS,
  renderPhongDiyaLitAlpona,
  type DiyaLight,
  type DiyaShadingModel,
  type PhongLightingParams,
} from '../graphics/phongLighting';
import type { PixelSurface } from '../graphics/rasterizer';
import type { CanvasSurface, DrawOperation } from '../graphics/types';
import { CANVAS_SIZE } from './AlponaCanvas';

interface DiyaLightingPanelProps {
  alponaTexture: PixelSurface;
  operations: DrawOperation[];
  surface: CanvasSurface;
  renderOptions: RenderOptions;
}

export function DiyaLightingPanel({
  alponaTexture,
  operations,
  surface,
  renderOptions,
}: DiyaLightingPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingLightIdRef = useRef<string | null>(null);

  const [lights, setLights] = useState<DiyaLight[]>(
    DIYA_LIGHT_PRESETS['four-corners'].lights
  );
  const [params, setParams] = useState<PhongLightingParams>(DEFAULT_PHONG_PARAMS);
  const [exportingPoster, setExportingPoster] = useState(false);

  const litResult = useMemo(
    () => renderPhongDiyaLitAlpona(alponaTexture, surface.hex, lights, params),
    [alponaTexture, surface.hex, lights, params]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height, data } = litResult.surface;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(width, height);
    img.data.set(data);
    ctx.putImageData(img, 0, 0);
  }, [litResult]);

  const handleLightDown =
    (id: string) => (e: React.PointerEvent<SVGGElement>) => {
      e.stopPropagation();
      draggingLightIdRef.current = id;
      const svg = e.currentTarget.ownerSVGElement;
      if (svg) svg.setPointerCapture(e.pointerId);
    };

  const handleSvgMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const activeId = draggingLightIdRef.current;
    if (!activeId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const ny = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / Math.max(1, rect.height)));
    setLights((prev) =>
      prev.map((lt) => (lt.id === activeId ? { ...lt, x: nx, y: ny } : lt))
    );
  };

  const handleSvgUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingLightIdRef.current) {
      draggingLightIdRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handleAddDiya = () => {
    if (lights.length >= 6) return;
    const angle = (lights.length * 1.15) % (Math.PI * 2);
    setLights((prev) => [
      ...prev,
      {
        id: `diya-${Date.now()}`,
        x: Number((0.5 + 0.32 * Math.cos(angle)).toFixed(3)),
        y: Number((0.5 + 0.32 * Math.sin(angle)).toFixed(3)),
        z: 0.16,
        color: [1.0, 0.72, 0.34],
        intensity: 1.1,
      },
    ]);
  };

  const handleRemoveLastDiya = () => {
    if (lights.length <= 1) return;
    setLights((prev) => prev.slice(0, -1));
  };

  const handleExportNightPoster = () => {
    setExportingPoster(true);
    // Defer 1 tick so button state updates cleanly before 1440px Phong lighting pass
    setTimeout(() => {
      try {
        const hiArt = renderUltraHdAlponaSurface(
          operations,
          surface,
          CANVAS_SIZE,
          renderOptions,
          1440,
          false
        );
        const hiLit = renderPhongDiyaLitAlpona(
          hiArt,
          surface.hex,
          lights,
          params
        );
        const out = document.createElement('canvas');
        out.width = 1440;
        out.height = 1440;
        const ctx = out.getContext('2d');
        if (ctx) {
          const img = ctx.createImageData(1440, 1440);
          img.data.set(hiLit.surface.data);
          ctx.putImageData(img, 0, 0);
          const link = document.createElement('a');
          link.href = out.toDataURL('image/png');
          link.download = `alpona-night-diya-${params.shadingModel}-hd.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } finally {
        setExportingPoster(false);
      }
    }, 20);
  };

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Left: Interactive Night-Courtyard Diya Stage */}
      <div className="mx-auto w-full max-w-[600px] rounded-xl border border-zinc-200/90 bg-white p-3 shadow-xs">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
          <span className="font-semibold text-zinc-900">
            Drag glowing earthen diyas across the courtyard
          </span>
          <span className="font-mono text-[11px] tabular-nums text-zinc-500">
            {lights.length} diya{lights.length === 1 ? '' : 's'} ·{' '}
            {params.shadingModel === 'phong'
              ? 'Per-Pixel Phong'
              : params.shadingModel === 'gouraud'
                ? 'Vertex Gouraud'
                : 'Sobel Normal Map'}
          </span>
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-zinc-900/20 bg-[#0E0E12]">
          <canvas
            ref={canvasRef}
            data-testid="diya-phong-canvas"
            className="block h-full w-full"
          />
          <svg
            viewBox="0 0 100 100"
            onPointerMove={handleSvgMove}
            onPointerUp={handleSvgUp}
            onPointerCancel={handleSvgUp}
            className="absolute inset-0 h-full w-full touch-none select-none"
            aria-label="Draggable courtyard diya lights"
          >
            {lights.map((lt, idx) => (
              <g
                key={lt.id}
                data-testid={`diya-light-${idx}`}
                onPointerDown={handleLightDown(lt.id)}
                className="cursor-grab active:cursor-grabbing"
              >
                <circle
                  cx={lt.x * 100}
                  cy={lt.y * 100}
                  r={4.2}
                  fill="rgba(251, 191, 36, 0.16)"
                  stroke="rgba(253, 230, 138, 0.85)"
                  strokeWidth={0.55}
                  strokeDasharray="1.4 1"
                />
                <text
                  x={lt.x * 100}
                  y={lt.y * 100 - 5.2}
                  textAnchor="middle"
                  fill="#FDE68A"
                  fontSize={3}
                  fontFamily="monospace"
                  fontWeight={700}
                >
                  L{idx + 1}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-2.5 rounded-md border border-zinc-200/80 bg-zinc-50 px-3 py-2 font-mono text-[11px] text-zinc-700">
          I = kₐ·Iₐ + Σ atten · [ k_d·(N·L)·C + k_s·(R·V)ⁿ·L_c ]
        </div>
      </div>

      {/* Right: Phong Illumination Controls */}
      <aside className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200/90">
        <section className="space-y-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Shading Model</h2>
            <span className="font-mono text-[11px] text-zinc-500">CLO-4/5</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'phong', label: 'Phong' },
                { id: 'gouraud', label: 'Gouraud' },
                { id: 'normal-map', label: 'Normal Map' },
              ] as Array<{ id: DiyaShadingModel; label: string }>
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setParams((p) => ({ ...p, shadingModel: m.id }))}
                aria-pressed={params.shadingModel === m.id}
                className={`h-8 rounded-md border text-xs font-medium transition-colors ${
                  params.shadingModel === m.id
                    ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="text-xs font-medium text-zinc-600">
              Courtyard Diya Arrangement
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                Object.entries(DIYA_LIGHT_PRESETS) as Array<
                  [keyof typeof DIYA_LIGHT_PRESETS, { label: string; lights: DiyaLight[] }]
                >
              ).map(([id, preset]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLights(preset.lights)}
                  className="h-8 rounded border border-zinc-200 bg-zinc-50 px-1.5 text-[11px] font-medium text-zinc-700 hover:border-zinc-300"
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 pt-1">
              <button
                type="button"
                disabled={lights.length >= 6}
                onClick={handleAddDiya}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Diya ({lights.length}/6)</span>
              </button>
              <button
                type="button"
                disabled={lights.length <= 1}
                onClick={handleRemoveLastDiya}
                className="inline-flex h-8 items-center justify-center gap-1 rounded border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                aria-label="Remove last diya"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-2.5 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Phong Reflection Parameters
            </h2>
            <Flame className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
          </div>

          {[
            {
              id: 'ka',
              label: 'Ambient (kₐ)',
              min: 0.05,
              max: 0.65,
              step: 0.02,
              val: params.ka,
              fmt: (v: number) => v.toFixed(2),
            },
            {
              id: 'kd',
              label: 'Diffuse (k_d)',
              min: 0.2,
              max: 1.5,
              step: 0.05,
              val: params.kd,
              fmt: (v: number) => v.toFixed(2),
            },
            {
              id: 'ks',
              label: 'Specular (k_s)',
              min: 0,
              max: 1.2,
              step: 0.05,
              val: params.ks,
              fmt: (v: number) => v.toFixed(2),
            },
            {
              id: 'shininess',
              label: 'Shininess (n)',
              min: 4,
              max: 64,
              step: 2,
              val: params.shininess,
              fmt: (v: number) => `${v}`,
            },
            {
              id: 'reliefStrength',
              label: 'Chalk Relief Depth',
              min: 0.4,
              max: 4.5,
              step: 0.2,
              val: params.reliefStrength,
              fmt: (v: number) => `${v.toFixed(1)}×`,
            },
          ].map((ctrl) => (
            <div key={ctrl.id}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <label htmlFor={`phong-${ctrl.id}`} className="text-zinc-600">
                  {ctrl.label}
                </label>
                <span className="font-mono font-medium tabular-nums text-zinc-900">
                  {ctrl.fmt(ctrl.val)}
                </span>
              </div>
              <input
                id={`phong-${ctrl.id}`}
                type="range"
                min={ctrl.min}
                max={ctrl.max}
                step={ctrl.step}
                value={ctrl.val}
                onChange={(e) =>
                  setParams((p) => ({
                    ...p,
                    [ctrl.id]: Number(e.target.value),
                  }))
                }
                className="w-full accent-[#B91C1C]"
              />
            </div>
          ))}

          <button
            type="button"
            disabled={exportingPoster}
            onClick={handleExportNightPoster}
            className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#B91C1C] px-3 text-xs font-medium text-white transition-colors hover:bg-[#991B1B] disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {exportingPoster
                ? 'Rendering HD Night Poster...'
                : 'Export HD Night Poster (1440 px)'}
            </span>
          </button>
        </section>
      </aside>
    </div>
  );
}
