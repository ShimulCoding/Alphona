import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Brush, Crosshair, Download, Printer, SlidersHorizontal, Upload } from 'lucide-react';
import { renderScene, type RenderOptions } from '../graphics/engine';
import {
  applyFrequencyDomainFilter,
  applyMorphology,
  applyPointOperation,
  applySpatialFilter,
  computeLuminanceHistogram,
  computePixelRelationships,
  type FrequencyFilterKind,
  type HistogramData,
  type MorphologyOpKind,
  type MorphologyResult,
  type PixelPointCoord,
  type PointOpKind,
  type SpatialFilterKind,
} from '../graphics/imageProcessing';
import type { PixelSurface } from '../graphics/rasterizer';
import type { CanvasSurface, DrawOperation } from '../graphics/types';
import { CANVAS_SIZE } from './AlponaCanvas';
import { NaturalMediaPanel } from './NaturalMediaPanel';

type LabDomain = 'point' | 'spatial' | 'morphology' | 'frequency';

interface ImageLabViewProps {
  operations: DrawOperation[];
  surface: CanvasSurface;
  renderOptions: RenderOptions;
  onReturnToStudio: () => void;
}

const POINT_OPS: Array<{
  id: PointOpKind;
  label: string;
  formula: string;
}> = [
  { id: 'original', label: 'Original', formula: 's = r' },
  {
    id: 'grayscale',
    label: 'Grayscale',
    formula: 'Y = 0.299R + 0.587G + 0.114B',
  },
  { id: 'negative', label: 'Negative', formula: 's = 255 − r' },
  { id: 'log', label: 'Log Transform', formula: 's = c · ln(1 + r)' },
  { id: 'gamma', label: 'Power-Law (Gamma)', formula: 's = 255 · (r / 255)^γ' },
  {
    id: 'contrast-stretch',
    label: 'Contrast Stretch',
    formula: 's = 255 · (r − r_min) / (r_max − r_min)',
  },
  {
    id: 'hist-equalize',
    label: 'Histogram Equalization',
    formula: 's_k = round(255 · CDF(r_k))',
  },
];

const SPATIAL_OPS: Array<{
  id: SpatialFilterKind;
  label: string;
  kernel: string[];
  note: string;
}> = [
  {
    id: 'box-blur',
    label: 'Box Mean (3×3)',
    kernel: ['1', '1', '1', '1', '1', '1', '1', '1', '1'],
    note: 'Divisor = 9 · Uniform low-pass smoothing',
  },
  {
    id: 'gaussian-blur',
    label: 'Gaussian Blur (3×3)',
    kernel: ['1', '2', '1', '2', '4', '2', '1', '2', '1'],
    note: 'Divisor = 16 · Distance-weighted smoothing',
  },
  {
    id: 'laplacian-sharpen',
    label: 'Laplacian Sharpen',
    kernel: ['0', '-1', '0', '-1', '5', '-1', '0', '-1', '0'],
    note: 'I − ∇²I · Enhances crisp rice-paste edges',
  },
  {
    id: 'sobel-edge',
    label: 'Sobel Edge Gradient',
    kernel: ['-1', '0', '1', '-2', '0', '2', '-1', '0', '1'],
    note: '√(Gₓ² + Gᵧ²) · Directional contour detection',
  },
  {
    id: 'printable-stencil',
    label: 'Printable Alpona Stencil',
    kernel: ['G3', '→', 'S3', '→', 'T≥48', '→', 'Ink', 'on', 'White'],
    note: 'Gaussian denoise → Sobel gradient → B&W threshold for floor tracing',
  },
];

const FREQUENCY_OPS: Array<{
  id: FrequencyFilterKind;
  label: string;
  formula: string;
}> = [
  {
    id: 'ideal-lowpass',
    label: 'Ideal Low-Pass (ILPF)',
    formula: 'H(u,v) = 1 if D(u,v) ≤ D₀ else 0',
  },
  {
    id: 'gaussian-lowpass',
    label: 'Gaussian Low-Pass (GLPF)',
    formula: 'H(u,v) = exp(−D²(u,v) / 2D₀²)',
  },
  {
    id: 'ideal-highpass',
    label: 'Ideal High-Pass (IHPF)',
    formula: 'H(u,v) = 1 if D(u,v) > D₀ else 0',
  },
  {
    id: 'gaussian-highpass',
    label: 'Gaussian High-Pass (GHPF)',
    formula: 'H(u,v) = 1 − exp(−D²(u,v) / 2D₀²)',
  },
];

function blitSurface(canvas: HTMLCanvasElement | null, surface: PixelSurface) {
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

function HistogramChart({
  before,
  after,
}: {
  before: HistogramData;
  after: HistogramData;
}) {
  // Group 256 bins into 64 clean vertical bars for crisp SVG rendering
  const buckets = 64;
  const beforeBars: number[] = [];
  const afterBars: number[] = [];
  let maxVal = 1;

  for (let b = 0; b < buckets; b++) {
    let sb = 0;
    let sa = 0;
    for (let k = 0; k < 4; k++) {
      sb += before.bins[b * 4 + k];
      sa += after.bins[b * 4 + k];
    }
    // Log-compressed height so both dark background & thin bright strokes remain clearly visible
    const lb = Math.log1p(sb);
    const la = Math.log1p(sa);
    beforeBars.push(lb);
    afterBars.push(la);
    if (lb > maxVal) maxVal = lb;
    if (la > maxVal) maxVal = la;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-zinc-900">
          256-Bin Luminance Histogram (Log Scale)
        </h3>
        <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 bg-zinc-300" />
            Original μ={before.meanIntensity}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 bg-[#B91C1C]" />
            Output μ={after.meanIntensity}
          </span>
        </div>
      </div>

      <svg
        viewBox="0 0 256 76"
        role="img"
        aria-label="Before and after luminance histogram"
        className="h-24 w-full rounded border border-zinc-100 bg-zinc-50/70"
        preserveAspectRatio="none"
      >
        {beforeBars.map((val, idx) => {
          const h = (val / maxVal) * 68;
          return (
            <rect
              key={`b-${idx}`}
              x={idx * 4}
              y={74 - h}
              width="3.2"
              height={h}
              fill="#D4D4D8"
            />
          );
        })}
        {afterBars.map((val, idx) => {
          const h = (val / maxVal) * 68;
          return (
            <rect
              key={`a-${idx}`}
              x={idx * 4 + 0.6}
              y={74 - h}
              width="2.1"
              height={h}
              fill="#B91C1C"
              fillOpacity="0.82"
            />
          );
        })}
      </svg>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] tabular-nums text-zinc-400">
        <span>0 (Black)</span>
        <span>
          Range [{after.minIntensity}..{after.maxIntensity}]
        </span>
        <span>255 (White)</span>
      </div>
    </div>
  );
}

export function ImageLabView({
  operations,
  surface,
  renderOptions,
  onReturnToStudio,
}: ImageLabViewProps) {
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [labViewMode, setLabViewMode] = useState<'filters' | 'natural-media'>('filters');
  const [sourceMode, setSourceMode] = useState<'studio' | 'upload'>('studio');
  const [uploadedSurface, setUploadedSurface] = useState<PixelSurface | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [domain, setDomain] = useState<LabDomain>('point');
  const [pointOp, setPointOp] = useState<PointOpKind>('hist-equalize');
  const [gamma, setGamma] = useState(0.65);
  const [spatialOp, setSpatialOp] = useState<SpatialFilterKind>('sobel-edge');
  const [morphOp, setMorphOp] = useState<MorphologyOpKind>('close');
  const [morphRadius, setMorphRadius] = useState<1 | 2>(1);
  const [freqOp, setFreqOp] = useState<FrequencyFilterKind>('gaussian-lowpass');
  const [cutoffD0, setCutoffD0] = useState(18);

  // Week 13 Pixel Relationships Inspector state
  const [inspectPixels, setInspectPixels] = useState(false);
  const [pixelP1, setPixelP1] = useState<PixelPointCoord>({ x: 360, y: 360 });
  const [pixelP2, setPixelP2] = useState<PixelPointCoord>({ x: 432, y: 396 });
  const [nextPickSlot, setNextPickSlot] = useState<1 | 2>(1);

  // Render live 720x720 Alpona source surface directly from user's operations
  const studioSurface = useMemo<PixelSurface>(() => {
    const buf: PixelSurface = {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      data: new Uint8ClampedArray(CANVAS_SIZE * CANVAS_SIZE * 4),
    };
    renderScene(buf, surface.hex, operations, null, renderOptions);
    return buf;
  }, [operations, surface.hex, renderOptions]);

  const sourceSurface =
    sourceMode === 'upload' && uploadedSurface ? uploadedSurface : studioSurface;

  const sourceHist = useMemo(
    () => computeLuminanceHistogram(sourceSurface),
    [sourceSurface]
  );

  // Compute processed result + optional 2D FFT magnitude spectrum
  const processed = useMemo(() => {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let resultSurface: PixelSurface;
    let spectrumSurface: PixelSurface | null = null;
    let morphReport: MorphologyResult | null = null;

    if (domain === 'point') {
      resultSurface = applyPointOperation(sourceSurface, pointOp, gamma);
    } else if (domain === 'spatial') {
      resultSurface = applySpatialFilter(sourceSurface, spatialOp);
    } else if (domain === 'morphology') {
      morphReport = applyMorphology(sourceSurface, morphOp, morphRadius, 72);
      resultSurface = morphReport.surface;
    } else {
      const fftRes = applyFrequencyDomainFilter(
        sourceSurface,
        freqOp,
        cutoffD0,
        128
      );
      resultSurface = fftRes.filtered;
      spectrumSurface = fftRes.spectrum;
    }

    const hist = computeLuminanceHistogram(resultSurface);
    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

    return {
      output: resultSurface,
      spectrum: spectrumSurface,
      morphReport,
      histogram: hist,
      computeMs: Math.max(0.1, Number((t1 - t0).toFixed(1))),
    };
  }, [sourceSurface, domain, pointOp, gamma, spatialOp, morphOp, morphRadius, freqOp, cutoffD0]);

  // Compute Week 13 pixel relationships on demand when inspector is active
  const pixelReport = useMemo(() => {
    if (!inspectPixels) return null;
    // Downsample slightly if large for instant BFS responsiveness
    const out = processed.output;
    const scale = out.width > 360 ? 2 : 1;
    if (scale === 1) {
      return computePixelRelationships(out, pixelP1, pixelP2, 28);
    }
    const w = Math.floor(out.width / scale);
    const h = Math.floor(out.height / scale);
    const small: PixelSurface = {
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcOff = (y * scale * out.width + x * scale) * 4;
        const dstOff = (y * w + x) * 4;
        small.data[dstOff] = out.data[srcOff];
        small.data[dstOff + 1] = out.data[srcOff + 1];
        small.data[dstOff + 2] = out.data[srcOff + 2];
        small.data[dstOff + 3] = 255;
      }
    }
    const smallRep = computePixelRelationships(
      small,
      { x: Math.round(pixelP1.x / scale), y: Math.round(pixelP1.y / scale) },
      { x: Math.round(pixelP2.x / scale), y: Math.round(pixelP2.y / scale) },
      28
    );
    // Keep exact user-clicked coordinate distances D4, D8, De while preserving BFS connectivity
    const dx = Math.abs(pixelP1.x - pixelP2.x);
    const dy = Math.abs(pixelP1.y - pixelP2.y);
    return {
      ...smallRep,
      p1: {
        x: Math.max(0, Math.min(out.width - 1, Math.round(pixelP1.x))),
        y: Math.max(0, Math.min(out.height - 1, Math.round(pixelP1.y))),
      },
      p2: {
        x: Math.max(0, Math.min(out.width - 1, Math.round(pixelP2.x))),
        y: Math.max(0, Math.min(out.height - 1, Math.round(pixelP2.y))),
      },
      d4CityBlock: dx + dy,
      d8Chessboard: Math.max(dx, dy),
      deEuclidean: Math.round(Math.hypot(dx, dy) * 100) / 100,
      is4Adjacent: dx + dy === 1 && smallRep.sameIntensityBand,
      is8Adjacent: Math.max(dx, dy) === 1 && smallRep.sameIntensityBand,
      component4Size: smallRep.component4Size * scale * scale,
      component8Size: smallRep.component8Size * scale * scale,
    };
  }, [inspectPixels, processed.output, pixelP1, pixelP2]);

  useEffect(() => {
    blitSurface(outputCanvasRef.current, processed.output);
    if (processed.spectrum) {
      blitSurface(spectrumCanvasRef.current, processed.spectrum);
    }
  }, [processed]);

  const handlePhotoUpload = (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload a valid PNG, JPG, or WebP photo/sketch.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 512;
        const off = document.createElement('canvas');
        off.width = size;
        off.height = size;
        const ctx = off.getContext('2d');
        if (!ctx) return;
        // Center-crop square so aspect ratio never distorts
        const minSide = Math.min(img.width, img.height);
        const sx = Math.floor((img.width - minSide) / 2);
        const sy = Math.floor((img.height - minSide) / 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const imgData = ctx.getImageData(0, 0, size, size);
        setUploadedSurface({
          width: size,
          height: size,
          data: new Uint8ClampedArray(imgData.data),
        });
        setUploadedFileName(file.name);
        setSourceMode('upload');
        // Jump straight to Printable Stencil so the user immediately sees their photo converted!
        setDomain('spatial');
        setSpatialOp('printable-stencil');
        setPixelP1({ x: 240, y: 240 });
        setPixelP2({ x: 268, y: 256 });
      };
      img.onerror = () => {
        setUploadError('Could not decode that image file.');
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleOutputCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!inspectPixels) return;
    const canvas = outputCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(
        processed.output.width - 1,
        Math.round(((e.clientX - rect.left) / rect.width) * processed.output.width)
      )
    );
    const y = Math.max(
      0,
      Math.min(
        processed.output.height - 1,
        Math.round(((e.clientY - rect.top) / rect.height) * processed.output.height)
      )
    );
    if (nextPickSlot === 1) {
      setPixelP1({ x, y });
      setNextPickSlot(2);
    } else {
      setPixelP2({ x, y });
      setNextPickSlot(1);
    }
  };

  const handleDownloadProcessed = () => {
    const canvas = outputCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `alpona-imagelab-${
      domain === 'spatial'
        ? spatialOp
        : domain === 'morphology'
          ? `morphology-${morphOp}`
          : domain
    }.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const activePointMeta =
    POINT_OPS.find((p) => p.id === pointOp) ?? POINT_OPS[0];
  const activeSpatialMeta =
    SPATIAL_OPS.find((s) => s.id === spatialOp) ?? SPATIAL_OPS[0];
  const activeFreqMeta =
    FREQUENCY_OPS.find((f) => f.id === freqOp) ?? FREQUENCY_OPS[0];

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 px-4 py-7 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5">
        <div className="max-w-2xl space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            {labViewMode === 'filters'
              ? 'Image Processing & Frequency Domain Lab'
              : 'Natural Media Chaler Guro & Mati Courtyard (NPR)'}
          </h1>
          <p className="text-sm leading-relaxed text-zinc-600">
            {labViewMode === 'filters'
              ? 'CSE 401/402 CLO-6 — Apply gray-level point transforms, histogram equalization, 3×3 spatial convolution, binary mathematical morphology (flood-gap closing), and 2D Radix-2 FFT filters to your live Alpona raster buffer.'
              : 'Non-Photorealistic Rendering (NPR) — Synthesizes 3-octave fBm mud, street asphalt, Tant cotton, and Patachitra substrates with Sobel wet rice-paste impasto relief, dry-brush bristle grain, and chalk speckle.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-zinc-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setLabViewMode('filters')}
              aria-pressed={labViewMode === 'filters'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                labViewMode === 'filters'
                  ? 'bg-[#B91C1C] text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Filter Pipeline</span>
            </button>
            <button
              type="button"
              onClick={() => setLabViewMode('natural-media')}
              aria-pressed={labViewMode === 'natural-media'}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                labViewMode === 'natural-media'
                  ? 'bg-[#B91C1C] text-white'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Brush className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Natural Media (NPR)</span>
            </button>
          </div>
          {labViewMode === 'filters' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setDomain('spatial');
                  setSpatialOp('printable-stencil');
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <span>Printable Stencil</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadProcessed}
                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[#B91C1C] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#991B1B] whitespace-nowrap shrink-0"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Save Filtered PNG</span>
              </button>
            </>
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

      {/* Main Workspace */}
      {labViewMode === 'natural-media' ? (
        <NaturalMediaPanel
          studioSurface={studioSurface}
          operations={operations}
          surface={surface}
          renderOptions={renderOptions}
        />
      ) : (
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left: Live Visual Stage + Histogram */}
        <div className="space-y-5">
          {domain === 'frequency' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-300/90 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-900">
                    Inverse FFT Filtered Output
                  </span>
                  <span className="font-mono text-zinc-500">128 × 128</span>
                </div>
                <div className="aspect-square w-full overflow-hidden rounded border border-zinc-900/10 bg-[#141418]">
                  <canvas
                    ref={outputCanvasRef}
                    data-testid="imagelab-output-canvas"
                    className="block h-full w-full"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-zinc-300/90 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-900">
                    2D Fourier Log-Magnitude Spectrum
                  </span>
                  <span className="font-mono text-amber-700">
                    D₀ = {cutoffD0}
                  </span>
                </div>
                <div className="relative aspect-square w-full overflow-hidden rounded border border-zinc-900/10 bg-[#141418]">
                  <canvas
                    ref={spectrumCanvasRef}
                    data-testid="imagelab-spectrum-canvas"
                    className="block h-full w-full"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  {/* Cutoff radius D0 circle indicator */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 128 128"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  >
                    <circle
                      cx="64"
                      cy="64"
                      r={cutoffD0}
                      fill="none"
                      stroke="#FDE68A"
                      strokeWidth="0.9"
                      strokeDasharray="3 2"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[620px] rounded-lg border border-zinc-300/90 bg-white p-3 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-zinc-900">
                  {domain === 'point'
                    ? activePointMeta.label
                    : domain === 'morphology'
                      ? morphOp === 'close'
                        ? 'Binary Closing — Flood-Gap Sealer (A ⊕ B) ⊖ B'
                        : morphOp === 'open'
                          ? 'Binary Opening — Speckle Removal (A ⊖ B) ⊕ B'
                          : morphOp === 'dilate'
                            ? 'Binary Dilation (A ⊕ B)'
                            : 'Binary Erosion (A ⊖ B)'
                      : activeSpatialMeta.label}
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setInspectPixels((v) => !v)}
                    aria-pressed={inspectPixels}
                    className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] font-medium transition-colors whitespace-nowrap ${
                      inspectPixels
                        ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <Crosshair className="h-3 w-3" aria-hidden="true" />
                    <span>Pixel Inspector</span>
                  </button>
                  <span className="font-mono tabular-nums text-zinc-500">
                    {processed.output.width} × {processed.output.height} ·{' '}
                    {processed.computeMs} ms
                  </span>
                </div>
              </div>
              <div className="relative aspect-square w-full overflow-hidden rounded border border-zinc-900/10 bg-[#16161B]">
                <canvas
                  ref={outputCanvasRef}
                  data-testid="imagelab-output-canvas"
                  onClick={handleOutputCanvasClick}
                  className={`block h-full w-full ${
                    inspectPixels ? 'cursor-crosshair' : ''
                  }`}
                />
                {inspectPixels && pixelReport && (
                  <svg
                    aria-hidden="true"
                    viewBox={`0 0 ${processed.output.width} ${processed.output.height}`}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  >
                    <line
                      x1={pixelReport.p1.x}
                      y1={pixelReport.p1.y}
                      x2={pixelReport.p2.x}
                      y2={pixelReport.p2.y}
                      stroke="#F59E0B"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                    />
                    <circle
                      cx={pixelReport.p1.x}
                      cy={pixelReport.p1.y}
                      r={Math.max(8, processed.output.width * 0.016)}
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx={pixelReport.p2.x}
                      cy={pixelReport.p2.y}
                      r={Math.max(8, processed.output.width * 0.016)}
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2.5"
                    />
                  </svg>
                )}
              </div>
            </div>
          )}

          {/* Week 13 Pixel Relationships Report Card */}
          {inspectPixels && pixelReport && (
            <div
              data-testid="pixel-relationships-card"
              className="mx-auto max-w-[620px] rounded-lg border border-zinc-200 bg-white p-4 space-y-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200/80 pb-2">
                <h3 className="text-xs font-semibold text-zinc-900">
                  Pixel Relationships Inspector (CSE 401 Week 13)
                </h3>
                <span className="font-mono text-[11px] text-zinc-500">
                  Click image to set P{nextPickSlot}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-3">
                <div className="rounded border border-zinc-200 bg-zinc-50 p-2.5">
                  <div className="text-[10px] text-zinc-500">P₁ (Red) / P₂ (Gold)</div>
                  <div className="mt-0.5 font-semibold text-zinc-900">
                    ({pixelReport.p1.x},{pixelReport.p1.y}) → ({pixelReport.p2.x},{pixelReport.p2.y})
                  </div>
                </div>
                <div className="rounded border border-zinc-200 bg-zinc-50 p-2.5">
                  <div className="text-[10px] text-zinc-500">Distances D₄ / D₈ / Dₑ</div>
                  <div className="mt-0.5 font-semibold text-[#B91C1C]">
                    {pixelReport.d4CityBlock} / {pixelReport.d8Chessboard} / {pixelReport.deEuclidean}
                  </div>
                </div>
                <div className="rounded border border-zinc-200 bg-zinc-50 p-2.5">
                  <div className="text-[10px] text-zinc-500">N₄(P₁) / N₈(P₁)</div>
                  <div className="mt-0.5 font-semibold text-zinc-900">
                    {pixelReport.n4OfP1.length} / {pixelReport.n8OfP1.length} neighbors
                  </div>
                </div>
                <div className="rounded border border-zinc-200 bg-zinc-50 p-2.5">
                  <div className="text-[10px] text-zinc-500">Luminance Y(P₁), Y(P₂)</div>
                  <div className="mt-0.5 font-semibold text-zinc-900">
                    {pixelReport.lum1}, {pixelReport.lum2}
                  </div>
                </div>
                <div className="rounded border border-zinc-200 bg-zinc-50 p-2.5">
                  <div className="text-[10px] text-zinc-500">4-Connected Path / Area</div>
                  <div className="mt-0.5 font-semibold text-zinc-900">
                    {pixelReport.connected4Path ? 'Yes' : 'No'} ·{' '}
                    {pixelReport.component4Size.toLocaleString()} px
                  </div>
                </div>
                <div className="rounded border border-zinc-200 bg-zinc-50 p-2.5">
                  <div className="text-[10px] text-zinc-500">8-Connected Path / Area</div>
                  <div className="mt-0.5 font-semibold text-zinc-900">
                    {pixelReport.connected8Path ? 'Yes' : 'No'} ·{' '}
                    {pixelReport.component8Size.toLocaleString()} px
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Before / After 256-bin Histogram */}
          <HistogramChart before={sourceHist} after={processed.histogram} />
        </div>

        {/* Right: Domain & Filter Controls */}
        <aside
          aria-label="Image processing controls"
          className="rounded-lg border border-zinc-200/90 bg-white divide-y divide-zinc-200/80 shadow-sm"
        >
          {/* Input Source: Live Studio vs. Photo/Sketch Upload */}
          <div className="p-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Image Source
              </h2>
              <span className="font-mono text-[11px] text-zinc-400">
                Photo → Stencil
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setSourceMode('studio')}
                aria-pressed={sourceMode === 'studio'}
                className={`h-9 rounded-md border text-xs font-medium transition-colors whitespace-nowrap ${
                  sourceMode === 'studio'
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                }`}
              >
                Studio Canvas
              </button>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                aria-pressed={sourceMode === 'upload'}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors whitespace-nowrap ${
                  sourceMode === 'upload'
                    ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                }`}
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Upload Photo</span>
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                aria-label="Upload photo or sketch for Alpona stencil extraction"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                  e.currentTarget.value = '';
                }}
              />
            </div>
            {uploadedFileName && sourceMode === 'upload' && (
              <div className="truncate font-mono text-[11px] text-zinc-600">
                Loaded: {uploadedFileName} (512 × 512)
              </div>
            )}
            {uploadError && (
              <div role="alert" className="text-xs text-red-700">
                {uploadError}
              </div>
            )}
          </div>

          {/* Domain Tabs */}
          <div className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">
              Processing Domain
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'point', label: 'Point Ops' },
                  { id: 'spatial', label: 'Spatial 3×3' },
                  { id: 'morphology', label: 'Morphology' },
                  { id: 'frequency', label: '2D FFT' },
                ] as const
              ).map((tab) => {
                const active = domain === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDomain(tab.id)}
                    aria-pressed={active}
                    className={`h-9 rounded-md border text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Domain Operation Picker */}
          <div className="p-5 space-y-4">
            {domain === 'point' && (
              <>
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Gray-Level & Histogram Operators
                  </h3>
                  <div className="grid gap-1.5">
                    {POINT_OPS.map((op) => {
                      const active = pointOp === op.id;
                      return (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => setPointOp(op.id)}
                          aria-pressed={active}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors ${
                            active
                              ? 'border-zinc-900 bg-zinc-900 text-white'
                              : 'border-zinc-200 bg-zinc-50/70 text-zinc-800 hover:border-zinc-300'
                          }`}
                        >
                          <span>{op.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {pointOp === 'gamma' && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-600">
                      <label htmlFor="gamma-slider">Gamma exponent (γ)</label>
                      <span className="font-mono font-medium tabular-nums text-zinc-900">
                        {gamma.toFixed(2)}
                      </span>
                    </div>
                    <input
                      id="gamma-slider"
                      type="range"
                      min={0.25}
                      max={3.0}
                      step={0.05}
                      value={gamma}
                      onChange={(e) => setGamma(Number(e.target.value))}
                      className="studio-slider w-full"
                    />
                  </div>
                )}

                <div className="rounded-md border border-zinc-200/80 bg-zinc-50 p-3 font-mono text-xs text-zinc-800">
                  {activePointMeta.formula}
                </div>
              </>
            )}

            {domain === 'spatial' && (
              <>
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    3×3 Convolution Filters
                  </h3>
                  <div className="grid gap-1.5">
                    {SPATIAL_OPS.map((op) => {
                      const active = spatialOp === op.id;
                      return (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => setSpatialOp(op.id)}
                          aria-pressed={active}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors ${
                            active
                              ? 'border-zinc-900 bg-zinc-900 text-white'
                              : 'border-zinc-200 bg-zinc-50/70 text-zinc-800 hover:border-zinc-300'
                          }`}
                        >
                          <span>{op.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live 3x3 Kernel Matrix Display */}
                <div>
                  <div className="mb-1.5 text-xs font-medium text-zinc-600">
                    Active 3×3 Convolution Mask
                  </div>
                  <div className="grid grid-cols-3 gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-center font-mono text-xs font-semibold tabular-nums text-zinc-900">
                    {activeSpatialMeta.kernel.map((val, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-white py-1.5 border border-zinc-200/70"
                      >
                        {val}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-zinc-600">
                    {activeSpatialMeta.note}
                  </p>
                </div>
              </>
            )}

            {domain === 'frequency' && (
              <>
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    2D Fourier Transfer Function H(u, v)
                  </h3>
                  <div className="grid gap-1.5">
                    {FREQUENCY_OPS.map((op) => {
                      const active = freqOp === op.id;
                      return (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => setFreqOp(op.id)}
                          aria-pressed={active}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors ${
                            active
                              ? 'border-zinc-900 bg-zinc-900 text-white'
                              : 'border-zinc-200 bg-zinc-50/70 text-zinc-800 hover:border-zinc-300'
                          }`}
                        >
                          <span>{op.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-600">
                    <label htmlFor="fft-d0-slider">Cutoff radius (D₀)</label>
                    <span className="font-mono font-medium tabular-nums text-zinc-900">
                      {cutoffD0} freq bins
                    </span>
                  </div>
                  <input
                    id="fft-d0-slider"
                    type="range"
                    min={4}
                    max={56}
                    step={2}
                    value={cutoffD0}
                    onChange={(e) => setCutoffD0(Number(e.target.value))}
                    className="studio-slider w-full"
                  />
                </div>

                <div className="rounded-md border border-zinc-200/80 bg-zinc-50 p-3 font-mono text-xs text-zinc-800">
                  {activeFreqMeta.formula}
                </div>
              </>
            )}

            {domain === 'morphology' && (
              <>
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Binary Morphology &amp; Flood-Gap Sealer
                  </h3>
                  <div className="grid gap-1.5">
                    {(
                      [
                        {
                          id: 'close',
                          label: 'Closing (Seal Flood Gaps)',
                          formula: '(A ⊕ B) ⊖ B',
                        },
                        {
                          id: 'open',
                          label: 'Opening (Remove Speckles)',
                          formula: '(A ⊖ B) ⊕ B',
                        },
                        {
                          id: 'dilate',
                          label: 'Dilation (Thicken Strokes)',
                          formula: 'A ⊕ B',
                        },
                        {
                          id: 'erode',
                          label: 'Erosion (Thin Strokes)',
                          formula: 'A ⊖ B',
                        },
                      ] as const
                    ).map((op) => {
                      const active = morphOp === op.id;
                      return (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => setMorphOp(op.id)}
                          aria-pressed={active}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors ${
                            active
                              ? 'border-zinc-900 bg-zinc-900 text-white'
                              : 'border-zinc-200 bg-zinc-50/70 text-zinc-800 hover:border-zinc-300'
                          }`}
                        >
                          <span>{op.label}</span>
                          <span
                            className={`font-mono text-[10px] ${
                              active ? 'text-zinc-300' : 'text-zinc-400'
                            }`}
                          >
                            {op.formula}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-xs font-medium text-zinc-700">
                    Structuring Element (B)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { r: 1, label: '3×3 Box (1 px gaps)' },
                        { r: 2, label: '5×5 Box (2–3 px gaps)' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.r}
                        type="button"
                        onClick={() => setMorphRadius(item.r)}
                        aria-pressed={morphRadius === item.r}
                        className={`h-8 rounded border px-2 text-xs font-medium transition-colors ${
                          morphRadius === item.r
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {processed.morphReport && (
                  <div className="space-y-1.5 rounded-md border border-zinc-200/90 bg-zinc-50 p-3 font-mono text-[11px] tabular-nums">
                    <div className="flex justify-between text-zinc-600">
                      <span>Foreground before:</span>
                      <span className="font-medium text-zinc-900">
                        {processed.morphReport.foregroundBefore.toLocaleString()} px
                      </span>
                    </div>
                    <div className="flex justify-between text-zinc-600">
                      <span>Foreground after:</span>
                      <span className="font-medium text-zinc-900">
                        {processed.morphReport.foregroundAfter.toLocaleString()} px
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-zinc-200 pt-1.5 text-[#B91C1C]">
                      <span>Micro-gaps bridged (red):</span>
                      <span className="font-semibold">
                        +{processed.morphReport.gapsBridged.toLocaleString()} px
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pipeline Note */}
          <div className="p-5 text-xs leading-relaxed text-zinc-600">
            Source buffer is synchronized directly with your active Studio
            Alpona ({operations.length} operations on {surface.name}). Matching
            C++11 routines live in{' '}
            <code className="font-mono text-zinc-900">
              image_processing.cpp
            </code>
            .
          </div>
        </aside>
      </div>
      )}
    </div>
  );
}
