import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, RotateCcw, Sparkles, Upload } from 'lucide-react';
import type { HomographyQuad } from '../graphics/homography';
import {
  generateAngledStreetAlponaPhoto,
  restoreAlponaFromPhoto,
} from '../graphics/photoUnwarper';
import type { PixelSurface } from '../graphics/rasterizer';
import type { Point2D } from '../graphics/types';

const PHOTO_W = 640;
const PHOTO_H = 440;

export function PhotoUnwarperPanel() {
  const demo = useMemo(
    () => generateAngledStreetAlponaPhoto(PHOTO_W, PHOTO_H),
    []
  );

  const srcCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const outCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const draggingPinRef = useRef<keyof HomographyQuad | null>(null);

  const [customPhoto, setCustomPhoto] = useState<PixelSurface | null>(null);
  const [customFileName, setCustomFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [quad, setQuad] = useState<HomographyQuad>(demo.quad);
  const [sectorsMode, setSectorsMode] = useState<'auto' | 4 | 6 | 8 | 12>('auto');
  const [reflect, setReflect] = useState(true);
  const [outputView, setOutputView] = useState<'restored' | 'rectified' | 'stencil'>('restored');

  const activePhoto = customPhoto ?? demo.surface;

  const result = useMemo(
    () => restoreAlponaFromPhoto(activePhoto, quad, sectorsMode, reflect, 360),
    [activePhoto, quad, sectorsMode, reflect]
  );

  // Paint source street photo canvas
  useEffect(() => {
    const canvas = srcCanvasRef.current;
    if (!canvas) return;
    canvas.width = activePhoto.width;
    canvas.height = activePhoto.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(activePhoto.width, activePhoto.height);
    img.data.set(activePhoto.data);
    ctx.putImageData(img, 0, 0);
  }, [activePhoto]);

  // Paint active restored/rectified/stencil result canvas
  useEffect(() => {
    const canvas = outCanvasRef.current;
    if (!canvas) return;
    const chosen =
      outputView === 'rectified'
        ? result.rectified
        : outputView === 'stencil'
          ? result.stencil
          : result.restored;
    canvas.width = chosen.width;
    canvas.height = chosen.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(chosen.width, chosen.height);
    img.data.set(chosen.data);
    ctx.putImageData(img, 0, 0);
  }, [result, outputView]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const off = document.createElement('canvas');
        off.width = PHOTO_W;
        off.height = PHOTO_H;
        const ctx = off.getContext('2d');
        if (!ctx) return;
        const scale = Math.max(PHOTO_W / img.width, PHOTO_H / img.height);
        const sw = PHOTO_W / scale;
        const sh = PHOTO_H / scale;
        const sx = (img.width - sw) / 2;
        const sy = (img.height - sh) / 2;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, PHOTO_W, PHOTO_H);
        const data = ctx.getImageData(0, 0, PHOTO_W, PHOTO_H).data;
        setCustomPhoto({
          width: PHOTO_W,
          height: PHOTO_H,
          data: new Uint8ClampedArray(data),
        });
        setCustomFileName(file.name);
      };
      img.onerror = () =>
        setUploadError('Could not decode the uploaded Alpona photograph.');
      img.src = String(reader.result);
    };
    reader.onerror = () => setUploadError('Failed to read photo file.');
    reader.readAsDataURL(file);
  };

  const toPhotoPoint = (e: React.PointerEvent<SVGSVGElement>): Point2D => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * PHOTO_W;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * PHOTO_H;
    return {
      x: Math.max(10, Math.min(PHOTO_W - 10, Math.round(x))),
      y: Math.max(10, Math.min(PHOTO_H - 10, Math.round(y))),
    };
  };

  const handlePinDown =
    (key: keyof HomographyQuad) => (e: React.PointerEvent<SVGGElement>) => {
      e.stopPropagation();
      draggingPinRef.current = key;
      const svg = e.currentTarget.ownerSVGElement;
      if (svg) svg.setPointerCapture(e.pointerId);
    };

  const handleSvgMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const key = draggingPinRef.current;
    if (!key) return;
    const pt = toPhotoPoint(e);
    setQuad((prev) => ({ ...prev, [key]: pt }));
  };

  const handleSvgUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingPinRef.current) {
      draggingPinRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handleDownloadOutput = (kind: 'restored' | 'stencil') => {
    const hiRes = restoreAlponaFromPhoto(
      activePhoto,
      quad,
      sectorsMode,
      reflect,
      720
    );
    const chosen = kind === 'stencil' ? hiRes.stencil : hiRes.restored;
    const out = document.createElement('canvas');
    // Upscale cleanly to 2160x2160 crisp print PNG
    const targetDim = 2160;
    const tmp = document.createElement('canvas');
    tmp.width = chosen.width;
    tmp.height = chosen.height;
    const tCtx = tmp.getContext('2d');
    if (!tCtx) return;
    const img = tCtx.createImageData(chosen.width, chosen.height);
    img.data.set(chosen.data);
    tCtx.putImageData(img, 0, 0);

    out.width = targetDim;
    out.height = targetDim;
    const oCtx = out.getContext('2d');
    if (!oCtx) return;
    oCtx.imageSmoothingEnabled = true;
    oCtx.imageSmoothingQuality = 'high';
    oCtx.drawImage(tmp, 0, 0, targetDim, targetDim);

    const link = document.createElement('a');
    link.href = out.toDataURL('image/png');
    link.download =
      kind === 'stencil'
        ? 'alpona-unwarped-stencil-hd.png'
        : 'alpona-symmetry-restored-hd.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeSectors =
    sectorsMode === 'auto' ? result.symmetry.detectedSectors : sectorsMode;

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_350px]">
      {/* Left: Side-by-side Angled Street Photo + Unwarped & Symmetry-Restored Result */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200/90 bg-white p-3 shadow-xs">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-semibold text-zinc-900">
              1. Pin 4 Corners of Street Photo
            </span>
            <span className="truncate font-mono text-[11px] text-zinc-500">
              {customFileName ?? 'Demo Street Alpona (Scuffed)'}
            </span>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950">
            <canvas
              ref={srcCanvasRef}
              width={PHOTO_W}
              height={PHOTO_H}
              className="block w-full h-auto"
            />
            <svg
              viewBox={`0 0 ${PHOTO_W} ${PHOTO_H}`}
              onPointerMove={handleSvgMove}
              onPointerUp={handleSvgUp}
              onPointerCancel={handleSvgUp}
              className="absolute inset-0 h-full w-full touch-none select-none"
              aria-label="4-corner perspective rectification pins"
            >
              <polygon
                points={`${quad.tl.x},${quad.tl.y} ${quad.tr.x},${quad.tr.y} ${quad.br.x},${quad.br.y} ${quad.bl.x},${quad.bl.y}`}
                fill="none"
                stroke="#FDE68A"
                strokeWidth={2}
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
                  data-testid={`unwarp-pin-${key}`}
                  onPointerDown={handlePinDown(key)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={13}
                    fill="rgba(185, 28, 28, 0.94)"
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
          <p className="mt-2 px-1 text-[11px] leading-relaxed text-zinc-500">
            Notice the faded foot-scuffed bottom-right corner on the street photo —
            inverse homography + dihedral fold averaging repairs it automatically.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200/90 bg-white p-3 shadow-xs">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-semibold text-zinc-900">
              2. Top-Down Rectified &amp; Restored
            </span>
            <span className="font-mono text-[11px] font-semibold text-[#B91C1C]">
              {reflect ? 'D' : 'C'}
              {activeSectors} · {result.symmetry.confidencePercent}% match
            </span>
          </div>
          <div className="mx-auto aspect-square w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950">
            <canvas
              ref={outCanvasRef}
              data-testid="unwarper-output-canvas"
              className="block h-full w-full"
            />
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'restored', label: 'Restored' },
                { id: 'rectified', label: 'Raw Unwarp' },
                { id: 'stencil', label: 'B&W Stencil' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setOutputView(tab.id)}
                aria-pressed={outputView === tab.id}
                className={`h-8 rounded-md border text-[11px] font-medium transition-colors ${
                  outputView === tab.id
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Control Rail */}
      <aside className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200/90">
        <section className="space-y-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Street Photo Input</h2>
            <span className="font-mono text-[11px] text-zinc-500">CLO-4/6</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => uploadRef.current?.click()}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Upload Photo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomPhoto(null);
                setCustomFileName(null);
                setQuad(demo.quad);
                setUploadError(null);
              }}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Demo Street</span>
            </button>
          </div>
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="sr-only"
            aria-label="Upload angled street Alpona photograph"
          />
          {uploadError && (
            <p role="alert" className="text-xs font-medium text-[#B91C1C]">
              {uploadError}
            </p>
          )}
        </section>

        <section className="space-y-3 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Polar Symmetry Detector
            </h2>
            <span className="font-mono text-[11px] font-semibold text-[#B91C1C]">
              Detected: {result.symmetry.detectedSectors}-Fold
            </span>
          </div>

          <div className="space-y-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50 p-2.5 font-mono text-[11px]">
            {result.symmetry.scores.map((sc) => {
              const isPeak = sc.sectors === result.symmetry.detectedSectors;
              return (
                <div key={sc.sectors} className="space-y-0.5">
                  <div className="flex justify-between text-zinc-700">
                    <span className={isPeak ? 'font-semibold text-[#B91C1C]' : ''}>
                      n = {sc.sectors} sectors
                    </span>
                    <span className="tabular-nums">
                      {Math.round(sc.correlation * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className={`h-full rounded-full ${
                        isPeak ? 'bg-[#B91C1C]' : 'bg-zinc-500'
                      }`}
                      style={{ width: `${Math.max(4, Math.round(sc.correlation * 100))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-zinc-700">
              Symmetry Restoration Fold
            </div>
            <div className="grid grid-cols-5 gap-1">
              {(['auto', 4, 6, 8, 12] as const).map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setSectorsMode(val)}
                  aria-pressed={sectorsMode === val}
                  className={`h-8 rounded border font-mono text-[11px] font-medium transition-colors ${
                    sectorsMode === val
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  {val === 'auto' ? 'Auto' : val}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between text-xs text-zinc-700">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={reflect}
                onChange={(e) => setReflect(e.target.checked)}
                className="h-4 w-4 rounded accent-[#B91C1C]"
              />
              <span>Dihedral mirror repair (Dₙ)</span>
            </span>
            <Sparkles className="h-3.5 w-3.5 text-[#B91C1C]" aria-hidden="true" />
          </label>
        </section>

        <section className="space-y-2 p-4">
          <button
            type="button"
            onClick={() => handleDownloadOutput('restored')}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#B91C1C] px-3 text-xs font-medium text-white transition-colors hover:bg-[#991B1B]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download Restored HD PNG</span>
          </button>
          <button
            type="button"
            onClick={() => handleDownloadOutput('stencil')}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download Printable Stencil PNG</span>
          </button>
        </section>
      </aside>
    </div>
  );
}
