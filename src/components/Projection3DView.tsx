import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Box, Download, Flame, RotateCcw, Stamp } from 'lucide-react';
import { renderScene, type RenderOptions } from '../graphics/engine';
import {
  buildAlponaMonumentMesh,
  PERSPECTIVE_ANOMALY_PRESETS,
  render3DCourtyardFloor,
  render3DScene,
  type HiddenSurfaceMode,
  type ProjectionMode,
  type Render3DMetrics,
  type Scene3DMode,
  type Transform3DParams,
} from '../graphics/projection3d';
import type { PixelSurface } from '../graphics/rasterizer';
import type { CanvasSurface, DrawOperation } from '../graphics/types';
import { CANVAS_SIZE } from './AlponaCanvas';
import { DiyaLightingPanel } from './DiyaLightingPanel';
import { StlStampPanel } from './StlStampPanel';

const VIEWPORT_3D_SIZE = 560;

interface Projection3DViewProps {
  defaultSectors: number;
  operations: DrawOperation[];
  surface: CanvasSurface;
  renderOptions: RenderOptions;
  onReturnToStudio: () => void;
}

const DEFAULT_3D_PARAMS: Transform3DParams = {
  rotXDeg: 38,
  rotYDeg: 28,
  rotZDeg: 0,
  scale: 0.84,
  translateX: 0,
  translateY: 0.04,
  focalLength: 2.8,
  projection: 'perspective',
  hsrMode: 'zbuffer',
  allowCopAnomaly: false,
};

const HSR_MODES: Array<{
  id: HiddenSurfaceMode;
  label: string;
  desc: string;
}> = [
  { id: 'wireframe', label: 'Wireframe', desc: 'Bresenham projected edges' },
  { id: 'painters', label: "Painter's", desc: 'Back-to-front depth sort' },
  { id: 'zbuffer', label: 'Z-Buffer', desc: 'Per-pixel depth test' },
  { id: 'depth-map', label: 'Depth Map', desc: 'Normalized Z-buffer view' },
];

export function Projection3DView({
  defaultSectors,
  operations,
  surface,
  renderOptions,
  onReturnToStudio,
}: Projection3DViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef<{ x: number; y: number } | null>(null);

  const [viewMode, setViewMode] = useState<'projection' | 'diya-lighting' | 'stl-stamp'>('projection');
  const [sceneMode, setSceneMode] = useState<Scene3DMode>('courtyard-floor');
  const [activePresetId, setActivePresetId] = useState<string>('two-point');
  const [sectors, setSectors] = useState(
    Math.max(4, Math.min(16, defaultSectors))
  );
  const [params, setParams] = useState<Transform3DParams>(DEFAULT_3D_PARAMS);
  const [metrics, setMetrics] = useState<Render3DMetrics>({
    triangleCount: 0,
    pixelsShaded: 0,
    zBufferRejects: 0,
    projectionMatrix: new Array(16).fill(0),
    anomalyVerticesCount: 0,
  });

  const mesh = useMemo(() => buildAlponaMonumentMesh(sectors), [sectors]);

  // Rasterize the user's live Alpona canvas as a 360x360 texture surface for fast 3D floor mapping
  const alponaTexture = useMemo<PixelSurface>(() => {
    const full: PixelSurface = {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      data: new Uint8ClampedArray(CANVAS_SIZE * CANVAS_SIZE * 4),
    };
    renderScene(full, surface.hex, operations, null, renderOptions);
    const texSize = 360;
    const small: PixelSurface = {
      width: texSize,
      height: texSize,
      data: new Uint8ClampedArray(texSize * texSize * 4),
    };
    for (let y = 0; y < texSize; y++) {
      const sy = y * 2;
      for (let x = 0; x < texSize; x++) {
        const sx = x * 2;
        const srcOff = (sy * CANVAS_SIZE + sx) * 4;
        const dstOff = (y * texSize + x) * 4;
        small.data[dstOff] = full.data[srcOff];
        small.data[dstOff + 1] = full.data[srcOff + 1];
        small.data[dstOff + 2] = full.data[srcOff + 2];
        small.data[dstOff + 3] = 255;
      }
    }
    return small;
  }, [operations, surface.hex, renderOptions]);

  useEffect(() => {
    if (viewMode !== 'projection') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(VIEWPORT_3D_SIZE, VIEWPORT_3D_SIZE);
    const target: PixelSurface = {
      width: VIEWPORT_3D_SIZE,
      height: VIEWPORT_3D_SIZE,
      data: img.data,
    };
    const m =
      sceneMode === 'courtyard-floor'
        ? render3DCourtyardFloor(target, alponaTexture, params, '#141418')
        : render3DScene(target, mesh, params, '#141418');
    ctx.putImageData(img, 0, 0);
    setMetrics(m);
  }, [viewMode, sceneMode, alponaTexture, mesh, params]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - draggingRef.current.x;
    const dy = e.clientY - draggingRef.current.y;
    draggingRef.current = { x: e.clientX, y: e.clientY };

    setParams((prev) => ({
      ...prev,
      rotYDeg: Math.round(((prev.rotYDeg + dx * 0.65 + 540) % 360) - 180),
      rotXDeg: Math.max(-85, Math.min(85, Math.round(prev.rotXDeg + dy * 0.55))),
    }));
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
  };

  const handleDownload3D = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `alpona-3d-${params.projection}-${params.hsrMode}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 px-4 py-7 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5">
        <div className="max-w-2xl space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            {viewMode === 'projection'
              ? '3D Courtyard Projection & Hidden Surface Removal'
              : viewMode === 'diya-lighting'
                ? 'Night-Courtyard Diya Lighting (Phong & Gouraud Shading)'
                : '3D-Printable Pitha Mold & Woodblock Stamp (.STL / .OBJ)'}
          </h1>
          <p className="text-sm leading-relaxed text-zinc-600">
            {viewMode === 'projection'
              ? '3D Spatial & Occlusion Engine — Pure software 3D pipeline projecting your live artwork with Parallel vs. Perspective projection, near-plane camera frustum presets, Painter’s Algorithm, and Z-Buffer occlusion.'
              : viewMode === 'diya-lighting'
                ? 'Specular & Diffuse Illumination Engine — Sobel 3×3 stroke-relief normal mapping with interactive earthen diya point lights, live Phong vs. Gouraud shading comparison, and 1440px night poster export.'
                : 'Generate watertight binary .STL and Wavefront .OBJ heightfield meshes with Gaussian draft-angle bevels, recessed Pitha cavities, or mirrored saree woodblock stamps with an underside grip handle.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-zinc-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode('projection')}
              aria-pressed={viewMode === 'projection'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'projection'
                  ? 'bg-[#B91C1C] text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Box className="h-3.5 w-3.5" aria-hidden="true" />
              <span>3D Projection &amp; HSR</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('diya-lighting')}
              aria-pressed={viewMode === 'diya-lighting'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'diya-lighting'
                  ? 'bg-[#B91C1C] text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Diya Lighting (Phong)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('stl-stamp')}
              aria-pressed={viewMode === 'stl-stamp'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'stl-stamp'
                  ? 'bg-[#B91C1C] text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Stamp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>3D Stamp (.STL)</span>
            </button>
          </div>
          {viewMode === 'projection' && (
            <button
              type="button"
              onClick={handleDownload3D}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[#B91C1C] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#991B1B] whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Save 3D PNG</span>
            </button>
          )}
          <button
            type="button"
            onClick={onReturnToStudio}
            className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0"
          >
            Back to Canvas
          </button>
        </div>
      </div>

      {viewMode === 'diya-lighting' ? (
        <DiyaLightingPanel
          alponaTexture={alponaTexture}
          operations={operations}
          surface={surface}
          renderOptions={renderOptions}
        />
      ) : viewMode === 'stl-stamp' ? (
        <StlStampPanel alponaTexture={alponaTexture} surface={surface} />
      ) : (
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left: Software 3D Viewport + Live 4x4 Matrix */}
        <div className="space-y-5">
          <div
            data-testid="canvas-continuity-surface"
            className="canvas-continuity-surface mx-auto max-w-[620px] rounded-lg border border-zinc-300/90 bg-white p-3 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-900">
                {sceneMode === 'courtyard-floor'
                  ? 'Live Alpona Courtyard Floor (Drag to Orbit)'
                  : '3D Lotus Monument (Drag to Orbit)'}
              </span>
              <span className="font-mono tabular-nums text-zinc-500">
                {params.projection === 'perspective'
                  ? `Perspective (d=${params.focalLength.toFixed(2)})`
                  : 'Parallel Orthographic'}
              </span>
            </div>
            <div className="aspect-square w-full overflow-hidden rounded border border-zinc-900/10 bg-[#141418]">
              <canvas
                ref={canvasRef}
                width={VIEWPORT_3D_SIZE}
                height={VIEWPORT_3D_SIZE}
                data-testid="alpona-3d-canvas"
                data-scene-mode={sceneMode}
                data-projection={params.projection}
                data-hsr={params.hsrMode}
                data-anomaly={params.allowCopAnomaly ? 'true' : 'false'}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="block h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
              />
            </div>

            {params.allowCopAnomaly && (
              <div
                data-testid="perspective-anomaly-banner"
                className="mt-3 flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50/80 p-3 text-xs text-amber-950"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <div>
                  <div className="font-semibold">
                    Perspective Anomaly Active: View Confusion (z ≤ −d)
                  </div>
                  <p className="mt-0.5 leading-relaxed text-amber-900">
                    Camera focal distance <code className="font-mono">d = {params.focalLength.toFixed(2)}</code>{' '}
                    places {metrics.anomalyVerticesCount ?? 0} vertices behind the Center of Projection
                    (negative denominator <code className="font-mono">d + z &lt; 0</code>), inverting
                    projected rays — demonstrating why 3D frustum near-plane clipping is mandatory.
                  </p>
                </div>
              </div>
            )}

            {/* Unboxed Software 3D Telemetry */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/80 pt-2.5 font-mono text-xs tabular-nums text-zinc-600">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-900">
                  {metrics.triangleCount} tris
                </span>
                <span aria-hidden="true">·</span>
                <span>{metrics.pixelsShaded.toLocaleString()} px shaded</span>
              </div>
              <span className="text-zinc-700">
                Z-Buffer rejects:{' '}
                <strong className="text-[#B91C1C]">
                  {metrics.zBufferRejects.toLocaleString()}
                </strong>
              </span>
            </div>
          </div>

          {/* 4x4 Projection Matrix Card */}
          <div className="mx-auto max-w-[620px] rounded-lg border border-zinc-200 bg-white p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Active 4×4 Projection Matrix
              </h2>
              <span className="font-mono text-xs text-zinc-500">
                {params.projection === 'perspective'
                  ? "x' = d·x / (d + z)"
                  : "x' = x, y' = y"}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3.5 text-right font-mono text-xs tabular-nums text-zinc-900">
              {metrics.projectionMatrix.map((val, idx) => (
                <span key={idx}>{val.toFixed(3)}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: 3D Scene, Perspective Anomalies, Projection & HSR Controls */}
        <aside
          aria-label="3D projection controls"
          className="rounded-lg border border-zinc-200/90 bg-white divide-y divide-zinc-200/80 shadow-sm"
        >
          {/* 3D Scene Mode */}
          <div className="p-5">
            <div className="mb-2.5 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">3D Scene</h2>
              <span className="font-mono text-[11px] text-zinc-400">Live Texture</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'courtyard-floor', label: 'Live Courtyard Floor' },
                  { id: 'monument', label: '3D Lotus Monument' },
                ] as Array<{ id: Scene3DMode; label: string }>
              ).map((m) => {
                const active = sceneMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSceneMode(m.id)}
                    aria-pressed={active}
                    className={`h-9 rounded-md border px-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Perspective Camera Frustum & Vanishing-Point Presets */}
          <div className="p-5 space-y-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Perspective Presets &amp; Frustum
              </h2>
              <span className="font-mono text-[11px] text-zinc-400">Camera</span>
            </div>
            <div className="grid gap-1.5">
              {PERSPECTIVE_ANOMALY_PRESETS.map((preset) => {
                const active = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setActivePresetId(preset.id);
                      setParams((prev) => ({
                        ...prev,
                        rotXDeg: preset.rotXDeg,
                        rotYDeg: preset.rotYDeg,
                        rotZDeg: preset.rotZDeg,
                        scale: preset.scale,
                        focalLength: preset.focalLength,
                        projection: preset.projection,
                        allowCopAnomaly: preset.allowCopAnomaly,
                      }));
                    }}
                    aria-pressed={active}
                    className={`rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors ${
                      active
                        ? preset.allowCopAnomaly
                          ? 'border-amber-600 bg-amber-600 text-white'
                          : 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-zinc-50/80 text-zinc-800 hover:border-zinc-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Projection Type */}
          <div className="p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Projection Geometry
              </h2>
              <span className="font-mono text-[11px] text-zinc-400">4×4 Matrix</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'perspective', label: 'Perspective' },
                  { id: 'parallel', label: 'Parallel (Ortho)' },
                ] as Array<{ id: ProjectionMode; label: string }>
              ).map((mode) => {
                const active = params.projection === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      setParams((prev) => ({
                        ...prev,
                        projection: mode.id,
                        allowCopAnomaly: mode.id === 'parallel' ? false : prev.allowCopAnomaly,
                      }))
                    }
                    aria-pressed={active}
                    className={`h-9 rounded-md border text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>

            {params.projection === 'perspective' && (
              <div className="mt-3.5">
                <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-600">
                  <label htmlFor="focal-length-slider">
                    Focal distance (d)
                  </label>
                  <span className="font-mono font-medium tabular-nums text-zinc-900">
                    {params.focalLength.toFixed(2)}
                  </span>
                </div>
                <input
                  id="focal-length-slider"
                  type="range"
                  min={params.allowCopAnomaly ? 0.55 : 1.8}
                  max={6.0}
                  step={0.05}
                  value={params.focalLength}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      focalLength: Number(e.target.value),
                    }))
                  }
                  className="studio-slider w-full"
                />
              </div>
            )}
          </div>

          {/* Hidden Surface Removal */}
          <div className="p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Hidden Surface Removal
              </h2>
              <span className="font-mono text-[11px] text-zinc-400">Depth Buffer</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {HSR_MODES.map((m) => {
                const active = params.hsrMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setParams((prev) => ({ ...prev, hsrMode: m.id }))
                    }
                    aria-pressed={active}
                    className={`rounded-md border px-2.5 py-2 text-left transition-colors ${
                      active
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-zinc-300'
                    }`}
                  >
                    <div className="text-xs font-semibold">{m.label}</div>
                    <div
                      className={`mt-0.5 text-[10px] ${
                        active ? 'text-zinc-300' : 'text-zinc-500'
                      }`}
                    >
                      {m.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3D Transformations */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                3D Transformations
              </h2>
              <button
                type="button"
                onClick={() => setParams(DEFAULT_3D_PARAMS)}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-[#B91C1C]"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Reset View</span>
              </button>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                <label htmlFor="rot-x-slider">Pitch (Rₓ)</label>
                <span className="font-mono tabular-nums text-zinc-900">
                  {params.rotXDeg}°
                </span>
              </div>
              <input
                id="rot-x-slider"
                type="range"
                min={-85}
                max={85}
                step={1}
                value={params.rotXDeg}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    rotXDeg: Number(e.target.value),
                  }))
                }
                className="studio-slider w-full"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                <label htmlFor="rot-y-slider">Yaw (Rᵧ)</label>
                <span className="font-mono tabular-nums text-zinc-900">
                  {params.rotYDeg}°
                </span>
              </div>
              <input
                id="rot-y-slider"
                type="range"
                min={-180}
                max={180}
                step={1}
                value={params.rotYDeg}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    rotYDeg: Number(e.target.value),
                  }))
                }
                className="studio-slider w-full"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                <label htmlFor="rot-z-slider">Roll (Z)</label>
                <span className="font-mono tabular-nums text-zinc-900">
                  {params.rotZDeg}°
                </span>
              </div>
              <input
                id="rot-z-slider"
                type="range"
                min={-180}
                max={180}
                step={1}
                value={params.rotZDeg}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    rotZDeg: Number(e.target.value),
                  }))
                }
                className="studio-slider w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                  <label htmlFor="scale-3d-slider">Scale</label>
                  <span className="font-mono tabular-nums text-zinc-900">
                    {params.scale.toFixed(2)}×
                  </span>
                </div>
                <input
                  id="scale-3d-slider"
                  type="range"
                  min={0.6}
                  max={1.45}
                  step={0.05}
                  value={params.scale}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      scale: Number(e.target.value),
                    }))
                  }
                  className="studio-slider w-full"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                  <label htmlFor="sectors-3d-slider">Petals</label>
                  <span className="font-mono tabular-nums text-zinc-900">
                    {sectors}
                  </span>
                </div>
                <input
                  id="sectors-3d-slider"
                  type="range"
                  min={4}
                  max={16}
                  step={1}
                  value={sectors}
                  onChange={(e) => setSectors(Number(e.target.value))}
                  className="studio-slider w-full"
                />
              </div>
            </div>
          </div>

          <div className="p-5 text-xs leading-relaxed text-zinc-600">
            Rendered entirely on CPU without WebGL using barycentric triangle
            scan-conversion. Matching C++11 module:{' '}
            <code className="font-mono text-zinc-900">projection3d.cpp</code>.
          </div>
        </aside>
      </div>
      )}
    </div>
  );
}
