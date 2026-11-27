import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Download,
  FileCode2,
  Grid2x2,
  Layers,
  Link2,
  Move,
  Projector,
  RotateCcw,
  Ruler,
  Upload,
  Users,
} from 'lucide-react';
import { renderScene, type RenderOptions } from '../graphics/engine';
import {
  computeFloorBlueprint,
  renderA4StencilTileToCanvas,
} from '../graphics/floorBlueprint';
import {
  generateCourtyardFloorPhoto,
  renderVirtualFloorTryOn,
  type FloorBlendMode,
  type HomographyQuad,
} from '../graphics/homography';
import {
  PRINT_STENCIL_EXPORT_SIZE,
  renderUltraHdAlponaSurface,
} from '../graphics/highResExport';
import { extractPrintableStencil } from '../graphics/imageProcessing';
import type { PixelSurface } from '../graphics/rasterizer';
import { downloadAlponaSvg, generateAlponaSvg } from '../graphics/svgExport';
import {
  hexToRgba,
  type CanvasSurface,
  type DrawOperation,
  type Point2D,
} from '../graphics/types';
import { CANVAS_SIZE } from './AlponaCanvas';
import { FriezeBorderPanel } from './FriezeBorderPanel';
import { PhotoUnwarperPanel } from './PhotoUnwarperPanel';
import { ProjectorTracePanel } from './ProjectorTracePanel';
import { StencilBridgerPanel } from './StencilBridgerPanel';
import { TeamPlannerPanel } from './TeamPlannerPanel';
import { WeaveChartPanel } from './WeaveChartPanel';

type FloorPrintMode =
  | 'try-on'
  | 'blueprint'
  | 'team'
  | 'unwarper'
  | 'projector'
  | 'frieze'
  | 'bridger'
  | 'weave';

interface FloorPrintViewProps {
  operations: DrawOperation[];
  surface: CanvasSurface;
  renderOptions: RenderOptions;
  sectors: number;
  onReturnToStudio: () => void;
}

const TRYON_W = 640;
const TRYON_H = 440;

const DEFAULT_QUAD: HomographyQuad = {
  tl: { x: 215, y: 150 },
  tr: { x: 425, y: 150 },
  br: { x: 520, y: 392 },
  bl: { x: 120, y: 392 },
};

const DIAMETER_PRESETS = [
  { label: '3 ft (90 cm)', cm: 90 },
  { label: '6 ft (180 cm)', cm: 180 },
  { label: '10 ft (300 cm)', cm: 300 },
];

export function FloorPrintView({
  operations,
  surface,
  renderOptions,
  sectors,
  onReturnToStudio,
}: FloorPrintViewProps) {
  const [mode, setMode] = useState<FloorPrintMode>('try-on');

  // --- Mode 1: Virtual Floor Try-On (4-Corner Homography) ---
  const tryOnCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const floorUploadRef = useRef<HTMLInputElement | null>(null);
  const draggingPinRef = useRef<keyof HomographyQuad | null>(null);

  const [quad, setQuad] = useState<HomographyQuad>(DEFAULT_QUAD);
  const [blendMode, setBlendMode] = useState<FloorBlendMode>('chalk-screen');
  const [opacity, setOpacity] = useState(0.92);
  const [customFloorPhoto, setCustomFloorPhoto] = useState<PixelSurface | null>(null);
  const [customFloorHiRes, setCustomFloorHiRes] = useState<PixelSurface | null>(null);
  const [customFloorName, setCustomFloorName] = useState<string | null>(null);
  const [floorError, setFloorError] = useState<string | null>(null);

  // --- Mode 2: Chalk-Grid Blueprint & Tiled A4 Floor Stencil ---
  const tilePreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [diameterCm, setDiameterCm] = useState(180);
  const [unit, setUnit] = useState<'cm' | 'ft'>('cm');
  const [tileGrid, setTileGrid] = useState<2 | 3>(2);
  const [selectedTile, setSelectedTile] = useState<{ row: number; col: number }>({
    row: 0,
    col: 0,
  });

  // Live Alpona 360x360 texture for smooth real-time Homography warping & full 720x720 for blueprint/stencil
  const studioSurface = useMemo<PixelSurface>(() => {
    const buf: PixelSurface = {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      data: new Uint8ClampedArray(CANVAS_SIZE * CANVAS_SIZE * 4),
    };
    renderScene(buf, surface.hex, operations, null, renderOptions);
    return buf;
  }, [operations, surface.hex, renderOptions]);

  const alponaTexture360 = useMemo<PixelSurface>(() => {
    const dim = 360;
    const out = new Uint8ClampedArray(dim * dim * 4);
    for (let y = 0; y < dim; y++) {
      const sy = Math.min(CANVAS_SIZE - 1, y * 2);
      for (let x = 0; x < dim; x++) {
        const sx = Math.min(CANVAS_SIZE - 1, x * 2);
        const sOff = (sy * CANVAS_SIZE + sx) * 4;
        const dOff = (y * dim + x) * 4;
        out[dOff] = studioSurface.data[sOff];
        out[dOff + 1] = studioSurface.data[sOff + 1];
        out[dOff + 2] = studioSurface.data[sOff + 2];
        out[dOff + 3] = 255;
      }
    }
    return { width: dim, height: dim, data: out };
  }, [studioSurface]);

  const defaultFloorPhoto = useMemo(
    () => generateCourtyardFloorPhoto(TRYON_W, TRYON_H),
    []
  );

  const activeFloorPhoto = customFloorPhoto ?? defaultFloorPhoto;

  const tryOnResult = useMemo(() => {
    const bgRgb = hexToRgba(surface.hex);
    return renderVirtualFloorTryOn(
      activeFloorPhoto,
      alponaTexture360,
      quad,
      blendMode,
      opacity,
      { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b }
    );
  }, [activeFloorPhoto, alponaTexture360, quad, blendMode, opacity, surface.hex]);

  useEffect(() => {
    if (mode !== 'try-on') return;
    const canvas = tryOnCanvasRef.current;
    if (!canvas) return;
    if (
      canvas.width !== tryOnResult.surface.width ||
      canvas.height !== tryOnResult.surface.height
    ) {
      canvas.width = tryOnResult.surface.width;
      canvas.height = tryOnResult.surface.height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(
      tryOnResult.surface.width,
      tryOnResult.surface.height
    );
    img.data.set(tryOnResult.surface.data);
    ctx.putImageData(img, 0, 0);
  }, [mode, tryOnResult]);

  // Blueprint calculations & crisp Printable Stencil for A4 tiling
  const blueprint = useMemo(
    () => computeFloorBlueprint(studioSurface, surface.hex, diameterCm, sectors),
    [studioSurface, surface.hex, diameterCm, sectors]
  );

  const stencilSurface = useMemo(
    () => extractPrintableStencil(studioSurface, 46),
    [studioSurface]
  );

  useEffect(() => {
    if (mode !== 'blueprint') return;
    const clampedRow = Math.min(tileGrid - 1, selectedTile.row);
    const clampedCol = Math.min(tileGrid - 1, selectedTile.col);
    const tileCanvas = renderA4StencilTileToCanvas(
      stencilSurface,
      tileGrid,
      clampedRow,
      clampedCol,
      diameterCm,
      440,
      622
    );
    const dst = tilePreviewCanvasRef.current;
    if (!dst) return;
    dst.width = tileCanvas.width;
    dst.height = tileCanvas.height;
    const ctx = dst.getContext('2d');
    if (ctx) {
      ctx.drawImage(tileCanvas, 0, 0);
    }
  }, [mode, stencilSurface, tileGrid, selectedTile, diameterCm]);

  const handleFloorUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFloorError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Preview buffer (640x440) for smooth interactive pin dragging
        const off = document.createElement('canvas');
        off.width = TRYON_W;
        off.height = TRYON_H;
        const ctx = off.getContext('2d');
        if (!ctx) return;
        const scale = Math.max(TRYON_W / img.width, TRYON_H / img.height);
        const sw = TRYON_W / scale;
        const sh = TRYON_H / scale;
        const sx = (img.width - sw) / 2;
        const sy = (img.height - sh) / 2;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TRYON_W, TRYON_H);
        const data = ctx.getImageData(0, 0, TRYON_W, TRYON_H).data;
        setCustomFloorPhoto({
          width: TRYON_W,
          height: TRYON_H,
          data: new Uint8ClampedArray(data),
        });

        // Full-HD 3x buffer (1920x1320) retained for top-class PNG mockup export
        const hiW = TRYON_W * 3;
        const hiH = TRYON_H * 3;
        const hiOff = document.createElement('canvas');
        hiOff.width = hiW;
        hiOff.height = hiH;
        const hiCtx = hiOff.getContext('2d');
        if (hiCtx) {
          hiCtx.imageSmoothingEnabled = true;
          hiCtx.imageSmoothingQuality = 'high';
          hiCtx.drawImage(img, sx, sy, sw, sh, 0, 0, hiW, hiH);
          const hiData = hiCtx.getImageData(0, 0, hiW, hiH).data;
          setCustomFloorHiRes({
            width: hiW,
            height: hiH,
            data: new Uint8ClampedArray(hiData),
          });
        }
        setCustomFloorName(file.name);
      };
      img.onerror = () => setFloorError('Could not decode the uploaded floor photo.');
      img.src = String(reader.result);
    };
    reader.onerror = () => setFloorError('Failed to read the selected photo file.');
    reader.readAsDataURL(file);
  };

  const toPhotoPoint = (e: React.PointerEvent<SVGSVGElement>): Point2D => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * TRYON_W;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * TRYON_H;
    return {
      x: Math.max(12, Math.min(TRYON_W - 12, Math.round(x))),
      y: Math.max(12, Math.min(TRYON_H - 12, Math.round(y))),
    };
  };

  const handlePinPointerDown =
    (corner: keyof HomographyQuad) =>
    (e: React.PointerEvent<SVGGElement>) => {
      e.stopPropagation();
      draggingPinRef.current = corner;
      const svg = e.currentTarget.ownerSVGElement;
      if (svg) svg.setPointerCapture(e.pointerId);
    };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const corner = draggingPinRef.current;
    if (!corner) return;
    const pt = toPhotoPoint(e);
    setQuad((prev) => ({ ...prev, [corner]: pt }));
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingPinRef.current) {
      draggingPinRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handleDownloadTryOn = () => {
    // Export top-class 3x Full-HD (1920 x 1320) homography-warped floor mockup
    const hiScale = 3;
    const hiW = TRYON_W * hiScale;
    const hiH = TRYON_H * hiScale;
    const hiFloor = customFloorHiRes ?? generateCourtyardFloorPhoto(hiW, hiH);
    const hiAlpona = renderUltraHdAlponaSurface(
      operations,
      surface,
      CANVAS_SIZE,
      renderOptions,
      1440,
      false
    );
    const hiQuad: HomographyQuad = {
      tl: { x: quad.tl.x * hiScale, y: quad.tl.y * hiScale },
      tr: { x: quad.tr.x * hiScale, y: quad.tr.y * hiScale },
      br: { x: quad.br.x * hiScale, y: quad.br.y * hiScale },
      bl: { x: quad.bl.x * hiScale, y: quad.bl.y * hiScale },
    };
    const bgRgb = hexToRgba(surface.hex);
    const hiResult = renderVirtualFloorTryOn(
      hiFloor,
      hiAlpona,
      hiQuad,
      blendMode,
      opacity,
      { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b }
    );
    const outCanvas = document.createElement('canvas');
    outCanvas.width = hiW;
    outCanvas.height = hiH;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(hiW, hiH);
    img.data.set(hiResult.surface.data);
    ctx.putImageData(img, 0, 0);

    const link = document.createElement('a');
    link.href = outCanvas.toDataURL('image/png');
    link.download = 'alpona-virtual-floor-tryon-hd.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSelectedTile = () => {
    const r = Math.min(tileGrid - 1, selectedTile.row);
    const c = Math.min(tileGrid - 1, selectedTile.col);
    // True 300 DPI A4 (2480 x 3508) fed by crisp 2400x2400 vector stencil
    const hiStencil = renderUltraHdAlponaSurface(
      operations,
      surface,
      CANVAS_SIZE,
      renderOptions,
      PRINT_STENCIL_EXPORT_SIZE,
      true
    );
    const hiRes = renderA4StencilTileToCanvas(
      hiStencil,
      tileGrid,
      r,
      c,
      diameterCm,
      2480,
      3508
    );
    const rowLetter = String.fromCharCode(65 + r);
    const link = document.createElement('a');
    link.href = hiRes.toDataURL('image/png');
    link.download = `alpona-a4-stencil-300dpi-${tileGrid}x${tileGrid}-${rowLetter}${c + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllTiles = () => {
    const hiStencil = renderUltraHdAlponaSurface(
      operations,
      surface,
      CANVAS_SIZE,
      renderOptions,
      PRINT_STENCIL_EXPORT_SIZE,
      true
    );
    for (let r = 0; r < tileGrid; r++) {
      for (let c = 0; c < tileGrid; c++) {
        const hiRes = renderA4StencilTileToCanvas(
          hiStencil,
          tileGrid,
          r,
          c,
          diameterCm,
          2480,
          3508
        );
        const rowLetter = String.fromCharCode(65 + r);
        const link = document.createElement('a');
        link.href = hiRes.toDataURL('image/png');
        link.download = `alpona-a4-stencil-300dpi-${tileGrid}x${tileGrid}-${rowLetter}${c + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  const handleDownloadCutSvg = () => {
    const svg = generateAlponaSvg(operations, surface, CANVAS_SIZE, renderOptions, {
      includeBackground: true,
      monochromeCutLines: true,
    });
    downloadAlponaSvg(svg, 'alpona-cut-stencil-vector.svg');
  };

  const tileCode = `${String.fromCharCode(
    65 + Math.min(tileGrid - 1, selectedTile.row)
  )}${Math.min(tileGrid - 1, selectedTile.col) + 1}`;

  return (
    <div className="mx-auto max-w-[1320px] space-y-6 px-4 py-7 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5">
        <div className="max-w-2xl space-y-1.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-950">
            Floor, Saree Border &amp; Stencil Studio
          </h1>
          <p className="text-sm leading-relaxed text-zinc-600">
            Preview your Alpona on any floor via 3×3 homography, print 300 DPI
            tiled A4 stencils, unwrap seamless Saree Paar borders &amp; 90°
            corners, auto-bridge Laser/Cricut stencil islands, unwarp street
            photos, or project tracing rings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-zinc-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setMode('try-on')}
              aria-pressed={mode === 'try-on'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'try-on'
                  ? 'bg-[#B91C1C] text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Move className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Virtual Floor Try-On</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('blueprint')}
              aria-pressed={mode === 'blueprint'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'blueprint'
                  ? 'bg-[#B91C1C] text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Chalk Blueprint &amp; A4</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('team')}
              aria-pressed={mode === 'team'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'team'
                  ? 'bg-[#B91C1C] text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Team Planner</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('frieze')}
              aria-pressed={mode === 'frieze'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'frieze'
                  ? 'bg-[#B91C1C] text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Saree Border</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('bridger')}
              aria-pressed={mode === 'bridger'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'bridger'
                  ? 'bg-[#B91C1C] text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Laser Bridges</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('weave')}
              aria-pressed={mode === 'weave'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'weave'
                  ? 'bg-[#B91C1C] text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Grid2x2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Jamdani Weave</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('unwarper')}
              aria-pressed={mode === 'unwarper'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'unwarper'
                  ? 'bg-[#B91C1C] text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Photo Unwarper</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('projector')}
              aria-pressed={mode === 'projector'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'projector'
                  ? 'bg-[#B91C1C] text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Projector className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Projector &amp; Trace</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onReturnToStudio}
            className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 whitespace-nowrap"
          >
            Back to Canvas
          </button>
        </div>
      </div>

      {/* MODE 1: Virtual Floor Try-On (4-Corner 3x3 Projective Homography) */}
      {mode === 'try-on' && (
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_350px]">
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200/90 bg-white p-3 shadow-xs">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                <span className="text-xs font-semibold text-zinc-900">
                  Drag the 4 corner pins to match your floor perspective
                </span>
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {customFloorName ?? 'Procedural Bengali Courtyard'} ·{' '}
                  {tryOnResult.warpedPixels.toLocaleString()} px warped
                </span>
              </div>

              <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950">
                <canvas
                  ref={tryOnCanvasRef}
                  width={TRYON_W}
                  height={TRYON_H}
                  className="block w-full h-auto"
                />

                {/* Interactive 4-Corner Homography Pin Overlay */}
                <svg
                  viewBox={`0 0 ${TRYON_W} ${TRYON_H}`}
                  onPointerMove={handleSvgPointerMove}
                  onPointerUp={handleSvgPointerUp}
                  onPointerCancel={handleSvgPointerUp}
                  className="absolute inset-0 h-full w-full touch-none select-none"
                  aria-label="Draggable 4-corner perspective homography pins"
                >
                  <polygon
                    points={`${quad.tl.x},${quad.tl.y} ${quad.tr.x},${quad.tr.y} ${quad.br.x},${quad.br.y} ${quad.bl.x},${quad.bl.y}`}
                    fill="none"
                    stroke="rgba(250, 248, 242, 0.78)"
                    strokeWidth={1.6}
                    strokeDasharray="6 4"
                  />

                  {(
                    [
                      { key: 'tl', label: 'TL', pt: quad.tl },
                      { key: 'tr', label: 'TR', pt: quad.tr },
                      { key: 'br', label: 'BR', pt: quad.br },
                      { key: 'bl', label: 'BL', pt: quad.bl },
                    ] as const
                  ).map(({ key, label, pt }) => (
                    <g
                      key={key}
                      data-testid={`homography-pin-${key}`}
                      onPointerDown={handlePinPointerDown(key)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={12}
                        fill="rgba(185, 28, 28, 0.92)"
                        stroke="#FAF8F2"
                        strokeWidth={2}
                      />
                      <text
                        x={pt.x}
                        y={pt.y + 3.5}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize={9}
                        fontFamily="monospace"
                        fontWeight={700}
                      >
                        {label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </div>

          {/* Right Control Rail */}
          <aside className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200/90">
            <section className="space-y-3 p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">Floor Photo</h2>
                <span className="font-mono text-[11px] text-zinc-500">Real Room</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => floorUploadRef.current?.click()}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Upload Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomFloorPhoto(null);
                    setCustomFloorHiRes(null);
                    setCustomFloorName(null);
                    setFloorError(null);
                  }}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  <span>Default Floor</span>
                </button>
              </div>
              <input
                ref={floorUploadRef}
                type="file"
                accept="image/*"
                onChange={handleFloorUpload}
                className="sr-only"
                aria-label="Upload floor or courtyard photo"
              />
              {floorError && (
                <p role="alert" className="text-xs font-medium text-[#B91C1C]">
                  {floorError}
                </p>
              )}
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Upload a photo of your balcony, courtyard, living room tiles, or
                plaza walkway and align the 4 red corner pins to the floor plane.
              </p>
            </section>

            <section className="space-y-3 p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Surface Blending
                </h2>
                <span className="font-mono text-[11px] text-zinc-500">Shader</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'chalk-screen', label: 'Chalk Paint' },
                    { id: 'ink-multiply', label: 'Ink Multiply' },
                    { id: 'opaque', label: 'Opaque' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBlendMode(item.id)}
                    aria-pressed={blendMode === item.id}
                    className={`h-8 rounded-md border text-[11px] font-medium transition-colors ${
                      blendMode === item.id
                        ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label htmlFor="tryon-opacity" className="text-zinc-700">
                    Pigment opacity
                  </label>
                  <span className="font-mono font-medium tabular-nums text-zinc-900">
                    {Math.round(opacity * 100)}%
                  </span>
                </div>
                <input
                  id="tryon-opacity"
                  type="range"
                  min={20}
                  max={100}
                  value={Math.round(opacity * 100)}
                  onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                  className="w-full accent-[#B91C1C]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setQuad(DEFAULT_QUAD)}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset Pins</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTryOn}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-[#B91C1C] px-3 text-xs font-medium text-white transition-colors hover:bg-[#991B1B]"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Save Mockup</span>
                </button>
              </div>
            </section>

            {/* Live 3x3 Projective Homography Matrix H Readout */}
            <section className="space-y-2.5 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-zinc-900">
                  3×3 Homography Matrix (H)
                </h2>
                <span className="font-mono text-[11px] text-zinc-500">
                  8×8 DLT + H⁻¹
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-zinc-100 bg-zinc-50 p-2 font-mono text-[11px] tabular-nums text-zinc-800">
                {tryOnResult.homography.matrix.map((val, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-zinc-200/80 bg-white px-1.5 py-1 text-center"
                  >
                    {val.toFixed(3)}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}

      {/* MODE 2: Real-World Chalk-Grid Blueprint & Tiled A4 Floor Stencil */}
      {mode === 'blueprint' && (
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_390px]">
          {/* Left: Interactive Tiled A4 Floor Stencil Preview */}
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-xs">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Tiled A4 Printable Floor Stencil — Sheet {tileCode}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Print on standard A4 paper, align the red (+) registration
                    crosshairs, tape together on the floor, and trace with chalk.
                  </p>
                </div>

                <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTileGrid(2);
                      setSelectedTile({ row: 0, col: 0 });
                    }}
                    aria-pressed={tileGrid === 2}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      tileGrid === 2
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    2×2 (4 Sheets)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTileGrid(3);
                      setSelectedTile({ row: 0, col: 0 });
                    }}
                    aria-pressed={tileGrid === 3}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      tileGrid === 3
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    3×3 (9 Sheets)
                  </button>
                </div>
              </div>

              <div className="grid items-start gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
                {/* Interactive Sheet Matrix Selector */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-700">
                    <Grid2x2 className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
                    <span>Select A4 Sheet</span>
                  </div>
                  <div
                    className={`grid gap-1.5 ${
                      tileGrid === 2 ? 'grid-cols-2' : 'grid-cols-3'
                    }`}
                  >
                    {Array.from({ length: tileGrid * tileGrid }).map((_, idx) => {
                      const r = Math.floor(idx / tileGrid);
                      const c = idx % tileGrid;
                      const active =
                        Math.min(tileGrid - 1, selectedTile.row) === r &&
                        Math.min(tileGrid - 1, selectedTile.col) === c;
                      const code = `${String.fromCharCode(65 + r)}${c + 1}`;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setSelectedTile({ row: r, col: c })}
                          aria-pressed={active}
                          className={`flex h-12 items-center justify-center rounded-md border font-mono text-xs font-semibold transition-colors ${
                            active
                              ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                              : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-white'
                          }`}
                        >
                          {code}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={handleDownloadSelectedTile}
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Download Tile {tileCode}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadAllTiles}
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Download All {tileGrid * tileGrid} Tiles</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCutSvg}
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
                    >
                      <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Export Laser/Vinyl SVG</span>
                    </button>
                  </div>
                </div>

                {/* Live A4 Sheet Canvas */}
                <div className="flex justify-center rounded-lg border border-zinc-200 bg-zinc-100/80 p-4">
                  <canvas
                    ref={tilePreviewCanvasRef}
                    width={440}
                    height={622}
                    className="max-h-[540px] w-auto rounded border border-zinc-300 bg-white shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Chalk-String Geometry Table & Pigment Estimator */}
          <aside className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200/90">
            <section className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Target Floor Size
                </h2>
                <div className="flex items-center gap-1 rounded border border-zinc-200 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setUnit('cm')}
                    className={`rounded px-2 py-0.5 font-mono font-medium ${
                      unit === 'cm' ? 'bg-zinc-900 text-white' : 'text-zinc-600'
                    }`}
                  >
                    cm
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnit('ft')}
                    className={`rounded px-2 py-0.5 font-mono font-medium ${
                      unit === 'ft' ? 'bg-zinc-900 text-white' : 'text-zinc-600'
                    }`}
                  >
                    ft / in
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {DIAMETER_PRESETS.map((p) => (
                  <button
                    key={p.cm}
                    type="button"
                    onClick={() => setDiameterCm(p.cm)}
                    className={`h-8 rounded-md border text-[11px] font-medium transition-colors ${
                      diameterCm === p.cm
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label htmlFor="floor-diameter" className="text-zinc-700">
                    Courtyard diameter
                  </label>
                  <span className="font-mono font-semibold tabular-nums text-zinc-900">
                    {unit === 'cm'
                      ? `${blueprint.diameterCm} cm`
                      : `${blueprint.diameterFeet} ft`}
                  </span>
                </div>
                <input
                  id="floor-diameter"
                  type="range"
                  min={60}
                  max={500}
                  step={10}
                  value={diameterCm}
                  onChange={(e) => setDiameterCm(Number(e.target.value))}
                  className="w-full accent-[#B91C1C]"
                />
              </div>
            </section>

            {/* Chalk-String Compass & Chord Spacing Table */}
            <section className="space-y-2.5 p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Chalk-String Guide ({blueprint.sectors} Sectors ·{' '}
                  {blueprint.sectorAngleDeg}°)
                </h2>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Tie chalk to a center nail at radius <em>R</em>, then step along
                each ring by exact chord length{' '}
                <span className="font-mono text-zinc-800">2R·sin(π/n)</span> to
                mark perfect radial symmetry by hand.
              </p>

              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-[11px] text-zinc-600">
                    <tr>
                      <th className="px-2.5 py-2 font-medium">Ring</th>
                      <th className="px-2.5 py-2 font-medium">String Radius</th>
                      <th className="px-2.5 py-2 font-medium">Sector Chord</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-mono text-[11px] tabular-nums">
                    {blueprint.rings.map((ring) => (
                      <tr key={ring.ringIndex}>
                        <td className="px-2.5 py-2 font-sans text-zinc-800">
                          {ring.label}
                        </td>
                        <td className="px-2.5 py-2 font-medium text-zinc-900">
                          {unit === 'cm'
                            ? `${ring.radiusCm} cm`
                            : `${ring.radiusInches} in`}
                        </td>
                        <td className="px-2.5 py-2 font-medium text-[#B91C1C]">
                          {unit === 'cm'
                            ? `${ring.sectorChordCm} cm`
                            : `${ring.sectorChordInches} in`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Pigment Surface Area & Paint Volume Estimator */}
            <section className="space-y-2.5 p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Rice Paste / Paint Estimate
                </h2>
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {blueprint.totalAlponaAreaSqM} m² painted
                </span>
              </div>

              {blueprint.pigments.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Draw strokes on the Studio canvas to estimate pigment coverage.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {blueprint.pigments.map((pig) => (
                    <div
                      key={pig.name}
                      className="flex items-center justify-between rounded-md border border-zinc-200/80 bg-zinc-50/70 px-2.5 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-full border border-zinc-300"
                          style={{ backgroundColor: pig.hex }}
                        />
                        <span className="truncate font-medium text-zinc-800">
                          {pig.name}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] tabular-nums text-zinc-700 whitespace-nowrap">
                        {pig.coveragePercent}% · ~{pig.estimatedPaintMl} mL
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}

      {/* Team Floor Planner: split a large alpona into team sections with paint per colour */}
      {mode === 'team' && <TeamPlannerPanel studioSurface={studioSurface} surface={surface} />}

      {/* MODE 3: Street-Photo Alpona Unwarper & Polar Symmetry Restorer */}
      {mode === 'unwarper' && <PhotoUnwarperPanel />}

      {/* MODE 4: Darkroom Projector & Step-by-Step Ring-by-Ring Floor Tracing */}
      {mode === 'projector' && (
        <ProjectorTracePanel
          operations={operations}
          surface={surface}
          renderOptions={renderOptions}
        />
      )}

      {/* MODE 5: Saree Paar Border & 90-Degree Anchal Corner Frieze Studio */}
      {mode === 'frieze' && (
        <FriezeBorderPanel
          studioSurface={studioSurface}
          operations={operations}
          surface={surface}
          renderOptions={renderOptions}
          sectors={sectors}
        />
      )}

      {/* MODE 6: Auto-Bridged Laser / Cricut Stencil Island Detector & Fixer */}
      {mode === 'bridger' && (
        <StencilBridgerPanel
          studioSurface={studioSurface}
          operations={operations}
          surface={surface}
          renderOptions={renderOptions}
        />
      )}

      {/* MODE 7: Jamdani Handloom & Nakshi Kantha Cross-Stitch Weave Chart */}
      {mode === 'weave' && <WeaveChartPanel studioSurface={studioSurface} />}
    </div>
  );
}
