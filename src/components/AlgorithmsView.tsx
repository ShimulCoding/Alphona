import {
  buildCenteredTransformMatrix2D,
  getRotationMatrix2x2,
  mat3Inverse,
} from '../graphics/transforms';
import type {
  ClippingWindowConfig,
  LineAlgorithm,
  PipelineMetrics,
  SymmetryConfig,
  Transform2DConfig,
} from '../graphics/types';
import { PixelStepperCard } from './PixelStepperCard';

interface AlgorithmsViewProps {
  symmetry: SymmetryConfig;
  metrics: PipelineMetrics;
  lineAlgorithm: LineAlgorithm;
  clippingWindow: ClippingWindowConfig;
  transform2D: Transform2DConfig;
  onReturnToStudio: () => void;
}

const ENGINE_SUBSYSTEM_MATRIX = [
  {
    moduleCode: 'CORE-1',
    tier: 'Stage I',
    topic: 'Graphics Pipeline, RGBA Framebuffer & Output Primitives',
    module: 'canvas_buffer.h · engine.ts',
  },
  {
    moduleCode: 'CORE-2',
    tier: 'Stage II',
    topic: 'DDA & Bresenham Line, Midpoint Circle, RGB/HSV/CMYK Color Spaces',
    module: 'rasterizer.cpp · colorModels.ts',
  },
  {
    moduleCode: 'CORE-3',
    tier: 'Stage III',
    topic: '3×3 Homogeneous 2D Transforms + Inverse, Cohen-Sutherland & Liang-Barsky',
    module: 'transforms.cpp · transforms.ts',
  },
  {
    moduleCode: 'CORE-4',
    tier: 'Stage IV',
    topic:
      '3D Courtyard Floor Projection, Parallel vs. Perspective & Near-Plane Camera Clipping',
    module: 'projection3d.cpp · Projection3DView',
  },
  {
    moduleCode: 'CORE-5',
    tier: 'Stage V',
    topic:
      "Sutherland-Hodgman & Weiler-Atherton Concave Polygon Clipping, Painter's & Z-Buffer HSR",
    module: 'transforms.cpp · projection3d.cpp',
  },
  {
    moduleCode: 'CORE-6',
    tier: 'Stage VI',
    topic:
      'Pixel Topology (N₄/N₈/D₄/D₈/Dₑ), Point Ops, Printable Stencil, 3×3 Convolution & 2D FFT',
    module: 'image_processing.cpp · ImageLabView',
  },
];

export function AlgorithmsView({
  symmetry,
  metrics,
  lineAlgorithm,
  clippingWindow,
  transform2D,
  onReturnToStudio,
}: AlgorithmsViewProps) {
  const stepDeg = 360 / symmetry.sectors;
  const mat = getRotationMatrix2x2(stepDeg);
  const totalCopies = symmetry.reflect ? symmetry.sectors * 2 : symmetry.sectors;

  const mat3M = buildCenteredTransformMatrix2D(transform2D);
  const mat3Inv = mat3Inverse(mat3M);

  const pipelineStages = [
    {
      step: '01',
      title: '2D Symmetry & 3×3 Homogeneous Transform Matrix',
      summary:
        'Each coordinate is rotated across n radial sectors (with optional dihedral reflection), then transformed by the composite 3×3 homogeneous matrix M = T · R(θ) · Sh · S. Its analytic inverse M⁻¹ is verified in real time.',
      formula: 'p′ = M · p,  M = T(tx,ty) · R(θ) · Sh(shx,shy) · S(sx,sy)',
    },
    {
      step: '02',
      title: 'Cohen-Sutherland, Liang-Barsky & Sutherland-Hodgman Clipping',
      summary:
        'Line segments are clipped against the active viewport or inset clipping window using either 4-bit region outcodes (Cohen-Sutherland) or parametric inequalities (Liang-Barsky). Diamond petals use Sutherland-Hodgman half-plane polygon clipping.',
      formula: 'Liang-Barsky: t₀ = max(0, qₖ/pₖ | pₖ < 0),  t₁ = min(1, qₖ/pₖ | pₖ > 0)',
    },
    {
      step: '03',
      title: 'Bresenham vs. DDA Line & Midpoint Circle Rasterizer',
      summary:
        'Accepted segments are rasterized directly into the 720×720 RGBA buffer using either integer Bresenham decision errors or floating-point DDA incremental stepping, alongside 8-octant midpoint circles.',
      formula: 'Bresenham: err = dx − dy  |  DDA: xᵢ₊₁ = xᵢ + Δx/steps',
    },
    {
      step: '04',
      title: 'Iterative Scanline Seed Fill',
      summary:
        'Closed floral petals and geometric cells are colored using an explicit-stack scanline flood fill with strict bounds checking, preventing recursion stack overflow on large regions.',
      formula: 'while (!stack.empty()) fillHorizontalSpan(x, y) → push(y ± 1)',
    },
  ];

  return (
    <div className="mx-auto max-w-[1160px] space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div className="max-w-2xl space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-950">
            Graphics Pipeline, Matrices &amp; Core Architecture Map
          </h1>
          <p className="text-sm leading-relaxed text-zinc-600">
            Live framebuffer telemetry, 2×2 symmetry and 3×3 homogeneous
            transformation matrices, and complete C++11 &amp; TypeScript subsystem architecture.
          </p>
        </div>
        <button
          type="button"
          onClick={onReturnToStudio}
          className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0"
        >
          Back to Canvas
        </button>
      </div>

      {/* Live Framebuffer Metrics Row */}
      <section aria-label="Live raster pipeline metrics">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">
            Current Framebuffer Telemetry
          </h2>
          <span className="font-mono text-xs text-zinc-500">
            Line: {lineAlgorithm === 'dda' ? 'DDA' : 'Bresenham'} · Clip:{' '}
            {clippingWindow.algorithm === 'liang-barsky'
              ? 'Liang-Barsky'
              : 'Cohen-Sutherland'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-xs text-zinc-500">Bresenham Line px</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-950">
              {metrics.bresenhamLinePixels.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-xs text-zinc-500">DDA Line px</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-950">
              {metrics.ddaLinePixels.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-xs text-zinc-500">Midpoint Circle px</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-950">
              {metrics.midpointCirclePixels.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-xs text-zinc-500">Seed Fill px</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-950">
              {metrics.seedFillPixels.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-xs text-zinc-500">Segments Tested</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-950">
              {metrics.segmentsSubmitted.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-xs text-zinc-500">Clipped / Rejected</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-950">
              {metrics.segmentsClipped} / {metrics.segmentsRejected}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-xs text-zinc-500">Polygons Clipped</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-950">
              {metrics.polygonsClipped}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-xs text-zinc-500">Raster Pass Time</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-950">
              {metrics.lastRenderMs} ms
            </div>
          </div>
        </div>
      </section>

      {/* Interactive 16x Zoomed Pixel-Grid Algorithm Stepper */}
      <PixelStepperCard />

      {/* Live 3x3 Homogeneous Transform Matrix & Inverse + 2x2 Symmetry Matrices */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* 3x3 Homogeneous M and Inverse M^-1 */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex items-baseline justify-between border-b border-zinc-200/80 pb-3">
            <h2 className="text-base font-semibold text-zinc-900">
              3×3 Homogeneous Matrix M &amp; Inverse M⁻¹
            </h2>
            <span className="font-mono text-xs tabular-nums text-zinc-500">
              CORE-3 · Mat3
            </span>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium text-zinc-600">
                Composite Matrix M
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3.5 font-mono text-xs tabular-nums text-zinc-900">
                <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-right">
                  {mat3M.map((v, i) => (
                    <span key={i}>{v.toFixed(3)}</span>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-zinc-600">
                Analytic Inverse M⁻¹
              </div>
              <div className="rounded-md border border-red-200 bg-red-50/40 p-3.5 font-mono text-xs tabular-nums text-zinc-900">
                {mat3Inv ? (
                  <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-right">
                    {mat3Inv.map((v, i) => (
                      <span key={i}>{v.toFixed(3)}</span>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-zinc-500">
                    Singular matrix (det = 0)
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-zinc-600">
            Adjust Rotate, Scale, Shear X, or Shift X/Y in the Studio sidebar to
            inspect how <span className="font-mono text-zinc-900">M · M⁻¹ = I</span>{' '}
            updates live across all vertices.
          </p>
        </div>

        {/* 2x2 Symmetry Matrices */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex items-baseline justify-between border-b border-zinc-200/80 pb-3">
            <h2 className="text-base font-semibold text-zinc-900">
              Radial Symmetry Matrices
            </h2>
            <span className="font-mono text-xs tabular-nums text-zinc-500">
              θ = {stepDeg.toFixed(2)}° · {totalCopies} copies
            </span>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium text-zinc-600">
                Rotation Matrix R({stepDeg.toFixed(1)}°)
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm tabular-nums text-zinc-900">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-right">
                  <span>{mat.cos.toFixed(4)}</span>
                  <span>{mat.negSin.toFixed(4)}</span>
                  <span>{mat.sin.toFixed(4)}</span>
                  <span>{mat.cos.toFixed(4)}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-zinc-600">
                {symmetry.reflect
                  ? 'Reflection Matrix (Enabled)'
                  : 'Reflection Matrix (Disabled)'}
              </div>
              <div
                className={`rounded-md border p-4 font-mono text-sm tabular-nums ${
                  symmetry.reflect
                    ? 'border-red-200 bg-red-50/40 text-zinc-900'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-400'
                }`}
              >
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-right">
                  <span>1.0000</span>
                  <span>0.0000</span>
                  <span>0.0000</span>
                  <span>{symmetry.reflect ? '-1.0000' : '1.0000'}</span>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-zinc-600">
            Active symmetry group:{' '}
            <strong className="font-semibold text-zinc-900">
              {symmetry.reflect
                ? `Dihedral group D${symmetry.sectors}`
                : `Cyclic group C${symmetry.sectors}`}
            </strong>
            .
          </p>
        </div>
      </section>

      {/* Core Graphics Engine Subsystem Architecture Table */}
      <section aria-label="Core graphics engine subsystem matrix">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">
          Core Graphics Engine Subsystem Matrix (Stages I–VI)
        </h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Subsystem</th>
                <th className="px-4 py-3 font-semibold">Pipeline Tier</th>
                <th className="px-4 py-3 font-semibold">Implemented Algorithms &amp; Capabilities</th>
                <th className="px-4 py-3 font-semibold">C++11 &amp; Web Modules</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70">
              {ENGINE_SUBSYSTEM_MATRIX.map((row) => (
                <tr key={row.moduleCode} className="hover:bg-zinc-50/60">
                  <td className="px-4 py-3 font-mono font-semibold text-[#B91C1C] whitespace-nowrap">
                    {row.moduleCode}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-500 whitespace-nowrap">
                    {row.tier}
                  </td>
                  <td className="px-4 py-3 text-zinc-800">{row.topic}</td>
                  <td className="px-4 py-3 font-mono text-zinc-600 whitespace-nowrap">
                    {row.module}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Four-Stage Pipeline Breakdown */}
      <section aria-label="Pipeline architecture">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">
          Four-Stage Raster Graphics Pipeline
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {pipelineStages.map((stage) => (
            <div
              key={stage.step}
              className="rounded-lg border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-xs font-semibold text-[#B91C1C]">
                  {stage.step}.
                </span>
                <h3 className="text-sm font-semibold text-zinc-950">
                  {stage.title}
                </h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                {stage.summary}
              </p>
              <div className="mt-3 overflow-x-auto rounded bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800 border border-zinc-200/70">
                {stage.formula}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
