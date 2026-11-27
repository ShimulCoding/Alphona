import { useRef, useState } from 'react';
import {
  Circle,
  Eraser,
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
  Hexagon,
  ImagePlus,
  Layers,
  Minus,
  MousePointerClick,
  Move,
  PaintBucket,
  Pencil,
  RefreshCw,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Spline,
} from 'lucide-react';
import { BENGALI_BEZIER_STAMPS } from '../graphics/bezier';
import { analyzeHexColor } from '../graphics/colorModels';
import { FESTIVAL_COLORWAYS } from '../graphics/colorwayRemap';
import {
  KOLAM_MAX_DOTS,
  KOLAM_MIN_DOTS,
  clampKolamDots,
  type KolamComposeResult,
  type KolamSymmetry,
} from '../graphics/kolamComposer';
import {
  getLayerGroupAccent,
  type ReferenceUnderlayConfig,
} from '../graphics/layerStack';
import { ALPONA_MOTIFS } from '../graphics/motifs';
import { isIdentityTransform2D } from '../graphics/transforms';
import { LayerStackPanel } from './LayerStackPanel';
import { ReferenceUnderlayPanel } from './ReferenceUnderlayPanel';
import {
  ALPONA_PALETTE,
  CANVAS_SURFACES,
  DEFAULT_TRANSFORM_2D,
  type CanvasSurfaceId,
  type ClippingWindowConfig,
  type DrawingTool,
  type DrawOperation,
  type LineAlgorithm,
  type PolygonShapeMode,
  type SymmetryConfig,
  type Transform2DConfig,
} from '../graphics/types';

type DockTab = 'draw' | 'layers' | 'craft';

interface ControlDeckProps {
  tool: DrawingTool;
  onChangeTool: (tool: DrawingTool) => void;
  polygonShape: PolygonShapeMode;
  onChangePolygonShape: (shape: PolygonShapeMode) => void;
  bezierCurvature: number;
  onChangeBezierCurvature: (c: number) => void;
  bezierRingFactor: number;
  onChangeBezierRingFactor: (r: number) => void;
  showDeCasteljau: boolean;
  onChangeShowDeCasteljau: (v: boolean) => void;
  onStampBezierMotif: (stampId: string) => void;
  selectedLayerId: string | null;
  selectedGroupName: string | null;
  selectedGroupLayerIds: string[];
  onClearGroupSelection: () => void;
  hasBezierOps: boolean;
  labMode: boolean;
  symmetry: SymmetryConfig;
  onChangeSymmetry: (next: SymmetryConfig) => void;
  showSymmetryAxes: boolean;
  onChangeShowSymmetryAxes: (next: boolean) => void;
  onSyncAllStrokes: () => void;
  hasStrokes: boolean;
  symmetricFill: boolean;
  onChangeSymmetricFill: (next: boolean) => void;
  color: string;
  onChangeColor: (hex: string) => void;
  thickness: number;
  onChangeThickness: (px: number) => void;
  surfaceId: CanvasSurfaceId;
  onChangeSurface: (id: CanvasSurfaceId) => void;
  lineAlgorithm: LineAlgorithm;
  onChangeLineAlgorithm: (algo: LineAlgorithm) => void;
  clippingWindow: ClippingWindowConfig;
  onChangeClippingWindow: (next: ClippingWindowConfig) => void;
  transform2D: Transform2DConfig;
  onChangeTransform2D: (next: Transform2DConfig) => void;
  activeMotifId: string | null;
  onSelectMotif: (motifId: string) => void;
  stabilizerLevel: number;
  onChangeStabilizerLevel: (level: number) => void;
  taperedBrush: boolean;
  onChangeTaperedBrush: (tapered: boolean) => void;
  extractedPalette: string[] | null;
  onApplyColorway: (
    palette: string[],
    surfaceId: CanvasSurfaceId,
    label: string
  ) => void;
  onExtractPhotoColorway: (file: File) => void;
  onComposeProcedural: (opts: {
    seed: number;
    includePhyllotaxis: boolean;
    includeRhodonea: boolean;
    includeLSystemVine: boolean;
    append: boolean;
  }) => void;
  onComposeKolam: (opts: {
    rows: number;
    cols: number;
    symmetry: KolamSymmetry;
    mirrorDensity: number;
    seed: number;
    requireSingleLoop: boolean;
    showDots: boolean;
    colorEachLoop: boolean;
    append: boolean;
  }) => KolamComposeResult;
  operations: DrawOperation[];
  onToggleLayerVisibility: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onChangeLayerOpacity: (id: string, opacity: number) => void;
  onToggleGroupVisibility: (group: string) => void;
  onAssignLayerGroup: (id: string, group: string) => void;
  onEditLayer: (id: string) => void;
  onShowAllLayers: () => void;
  onMoveLayerOrder: (id: string, direction: 'up' | 'down') => void;
  onRecolorLayer: (id: string, colorHex: string) => void;
  onDeleteLayer: (id: string) => void;
  onMirrorSelectedLayer: (axis: 'horizontal' | 'vertical') => void;
  referenceUnderlay: ReferenceUnderlayConfig;
  onChangeReferenceUnderlay: (next: ReferenceUnderlayConfig) => void;
}

const SECTOR_PRESETS = [4, 6, 8, 12];

export function ControlDeck({
  tool,
  onChangeTool,
  polygonShape,
  onChangePolygonShape,
  bezierCurvature,
  onChangeBezierCurvature,
  bezierRingFactor,
  onChangeBezierRingFactor,
  showDeCasteljau,
  onChangeShowDeCasteljau,
  onStampBezierMotif,
  selectedLayerId,
  selectedGroupName,
  selectedGroupLayerIds,
  onClearGroupSelection,
  hasBezierOps,
  labMode,
  symmetry,
  onChangeSymmetry,
  showSymmetryAxes,
  onChangeShowSymmetryAxes,
  onSyncAllStrokes,
  hasStrokes,
  symmetricFill,
  onChangeSymmetricFill,
  color,
  onChangeColor,
  thickness,
  onChangeThickness,
  surfaceId,
  onChangeSurface,
  lineAlgorithm,
  onChangeLineAlgorithm,
  clippingWindow,
  onChangeClippingWindow,
  transform2D,
  onChangeTransform2D,
  activeMotifId,
  onSelectMotif,
  stabilizerLevel,
  onChangeStabilizerLevel,
  taperedBrush,
  onChangeTaperedBrush,
  extractedPalette,
  onApplyColorway,
  onExtractPhotoColorway,
  onComposeProcedural,
  onComposeKolam,
  operations,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onChangeLayerOpacity,
  onToggleGroupVisibility,
  onAssignLayerGroup,
  onEditLayer,
  onShowAllLayers,
  onMoveLayerOrder,
  onRecolorLayer,
  onDeleteLayer,
  onMirrorSelectedLayer,
  referenceUnderlay,
  onChangeReferenceUnderlay,
}: ControlDeckProps) {
  const colorwayPhotoRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<DockTab>('draw');
  const [mirrorTarget, setMirrorTarget] = useState<'auto' | 'canvas'>('auto');
  const [procSeed, setProcSeed] = useState(2026);
  const [includePhyllotaxis, setIncludePhyllotaxis] = useState(true);
  const [includeRhodonea, setIncludeRhodonea] = useState(true);
  const [includeLSystemVine, setIncludeLSystemVine] = useState(true);
  const [kolamRows, setKolamRows] = useState(7);
  const [kolamCols, setKolamCols] = useState(7);
  const [kolamSymmetry, setKolamSymmetry] = useState<KolamSymmetry>('mirror');
  const [kolamDensity, setKolamDensity] = useState(35);
  const [kolamSeed, setKolamSeed] = useState(7);
  const [kolamSingleLoop, setKolamSingleLoop] = useState(true);
  const [kolamShowDots, setKolamShowDots] = useState(true);
  const [kolamColorLoops, setKolamColorLoops] = useState(false);
  const [kolamResult, setKolamResult] = useState<KolamComposeResult | null>(null);

  const tools: Array<{
    id: DrawingTool;
    label: string;
    shortcut: string;
    icon: typeof Pencil;
  }> = [
    { id: 'freehand', label: 'Freehand', shortcut: 'F', icon: Pencil },
    { id: 'line', label: 'Line', shortcut: 'L', icon: Minus },
    { id: 'circle', label: 'Circle', shortcut: 'O', icon: Circle },
    { id: 'polygon', label: 'Polygon', shortcut: 'P', icon: Hexagon },
    { id: 'bezier', label: 'Bézier', shortcut: 'C', icon: Spline },
    { id: 'edit', label: 'Transform', shortcut: 'V', icon: Move },
    { id: 'fill', label: 'Seed Fill', shortcut: 'B', icon: PaintBucket },
    { id: 'eraser', label: 'Stroke Eraser', shortcut: 'E', icon: Eraser },
    {
      id: 'group-select',
      label: 'Group Select',
      shortcut: 'A',
      icon: MousePointerClick,
    },
  ];

  const activeSwatch = ALPONA_PALETTE.find(
    (s) => s.hex.toLowerCase() === color.toLowerCase()
  );
  const colorBreakdown = analyzeHexColor(color);
  const hasTransform = !isIdentityTransform2D(transform2D);
  const selectedLayerOp = selectedLayerId
    ? operations.find((op) => op.id === selectedLayerId) ?? null
    : null;
  const canMirrorSelectedLayer = Boolean(
    selectedLayerOp && !selectedLayerOp.locked
  );
  const effectiveMirrorScope: 'layer' | 'canvas' =
    canMirrorSelectedLayer && mirrorTarget !== 'canvas' ? 'layer' : 'canvas';

  const dockTabs: Array<{
    id: DockTab;
    label: string;
    icon: typeof Pencil;
    count?: number;
  }> = [
    { id: 'draw', label: 'Draw', icon: Pencil },
    { id: 'layers', label: 'Layers', icon: Layers, count: operations.length },
    { id: 'craft', label: 'Craft', icon: SlidersHorizontal },
  ];

  return (
    <aside
      aria-label="Alpona Studio inspector"
      data-testid="studio-inspector-dock"
      className="rounded-lg border border-zinc-200/90 bg-white shadow-sm overflow-hidden"
    >
      {/* 3-Tab Compact Studio Inspector Navigation (Eliminates vertical scroll wall) */}
      <div
        role="tablist"
        aria-label="Studio inspector sections"
        className="grid grid-cols-3 border-b border-zinc-200/90 bg-[#F7F6F2]"
      >
        {dockTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`dock-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex h-11 items-center justify-center gap-1.5 text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#B91C1C] ${
                active
                  ? 'bg-white text-zinc-950'
                  : 'text-zinc-600 hover:bg-white/60 hover:text-zinc-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
              {tab.id === 'layers' && selectedGroupName && (
                <span
                  aria-label={`Group ${selectedGroupName} selected`}
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: getLayerGroupAccent(selectedGroupName),
                  }}
                />
              )}
              {typeof tab.count === 'number' && (
                <span className="font-mono text-[10px] tabular-nums text-zinc-400">
                  {tab.count}
                </span>
              )}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-[2px] bg-[#B91C1C]"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DRAW — Core Tools, Symmetry, Pigments & Surface */}
      {activeTab === 'draw' && (
        <div
          role="tabpanel"
          aria-label="Drawing tools and pigments"
          className="divide-y divide-zinc-200/80"
        >
          {/* 1. Drawing Tool & Rasterizer Algorithm */}
          <div className="p-5">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">
                Drawing Tool
              </h2>
              <span className="truncate text-xs text-zinc-500">
                {tool === 'freehand' &&
                  (lineAlgorithm === 'dda'
                    ? 'DDA · Stylus pressure'
                    : 'Bresenham · Stylus pressure')}
                {tool === 'line' &&
                  (lineAlgorithm === 'dda'
                    ? 'DDA floating-point'
                    : 'Bresenham integer')}
                {tool === 'circle' && 'Midpoint 8-octant'}
                {tool === 'polygon' &&
                  (polygonShape === 'concave-star'
                    ? 'Concave Shapla star'
                    : 'Convex diamond petal')}
                {tool === 'bezier' && 'Cubic Bézier & folk stamps'}
                {tool === 'edit' && 'Move, scale, rotate & curves'}
                {tool === 'fill' && 'Iterative scanline fill'}
                {tool === 'eraser' && 'Click any stroke to erase'}
                {tool === 'group-select' && 'Click stroke to select group'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {tools.map((item) => {
                const Icon = item.icon;
                const active = tool === item.id;
                const spanFull = item.id === 'group-select';
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`tool-btn-${item.id}`}
                    onClick={() => onChangeTool(item.id)}
                    aria-pressed={active}
                    className={`flex h-9 items-center justify-between rounded-md border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C] ${
                      spanFull ? 'col-span-2' : ''
                    } ${
                      active
                        ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                        : 'border-zinc-200 bg-zinc-50/70 text-zinc-800 hover:border-zinc-300 hover:bg-zinc-100/80'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </span>
                    <span
                      className={`font-mono text-[10px] ${
                        active ? 'text-red-100' : 'text-zinc-400'
                      }`}
                    >
                      {item.shortcut}
                    </span>
                  </button>
                );
              })}
            </div>

            {tool === 'edit' && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-zinc-700">
                Click any unlocked stroke on canvas (or pick one in{' '}
                <strong className="font-semibold">Layers</strong>) to move,
                scale, rotate, or drag <strong className="font-semibold">P0–P3</strong>{' '}
                Bézier handles live across all symmetry folds.
              </div>
            )}

            {(tool === 'group-select' || selectedGroupName) && (
              <div
                data-testid="active-group-selection-card"
                className="mt-3 rounded-md border border-zinc-200 bg-zinc-50/90 px-3 py-2 text-xs text-zinc-700"
                style={
                  selectedGroupName
                    ? {
                        borderLeftWidth: '3px',
                        borderLeftColor: getLayerGroupAccent(selectedGroupName),
                      }
                    : undefined
                }
              >
                {selectedGroupName ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-900">
                        Group: {selectedGroupName}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-zinc-600">
                        {selectedGroupLayerIds.length}{' '}
                        {selectedGroupLayerIds.length === 1 ? 'layer' : 'layers'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="inspect-selected-group-btn"
                        onClick={() => setActiveTab('layers')}
                        className="flex-1 rounded border border-zinc-900 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-zinc-800"
                      >
                        Inspect in Layers
                      </button>
                      <button
                        type="button"
                        data-testid="clear-selected-group-btn"
                        onClick={onClearGroupSelection}
                        className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <p>
                    Click any stroke on the canvas to select all operations
                    sharing its <strong className="font-semibold">group</strong>{' '}
                    attribute and highlight them in{' '}
                    <strong className="font-semibold">Layers</strong>.
                  </p>
                )}
              </div>
            )}

            {tool === 'freehand' && (
              <div className="mt-3 space-y-2 rounded-md border border-zinc-200 bg-zinc-50/80 p-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold text-zinc-700">
                    Chaikin Stroke Stabilizer
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    Level {stabilizerLevel}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      { lvl: 0, label: 'Off' },
                      { lvl: 1, label: 'Light' },
                      { lvl: 2, label: 'Smooth' },
                      { lvl: 3, label: 'Silk' },
                    ] as const
                  ).map((opt) => {
                    const active = stabilizerLevel === opt.lvl;
                    return (
                      <button
                        key={opt.lvl}
                        type="button"
                        onClick={() => onChangeStabilizerLevel(opt.lvl)}
                        aria-pressed={active}
                        className={`h-7 rounded border text-[11px] font-medium transition-colors ${
                          active
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={taperedBrush}
                    onChange={(e) => onChangeTaperedBrush(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#B91C1C]"
                  />
                  <span>Pressure &amp; rice-paste taper (চালের গুঁড়ো)</span>
                </label>
              </div>
            )}

            {tool === 'fill' && (
              <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={symmetricFill}
                  onChange={(e) => onChangeSymmetricFill(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 accent-[#B91C1C]"
                />
                <span>Symmetric multi-petal fill</span>
              </label>
            )}

            {tool === 'polygon' && (
              <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50/80 p-2.5">
                <div className="mb-1.5 text-[11px] font-medium text-zinc-600">
                  Polygon motif shape
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'diamond', label: 'Diamond Petal' },
                      { id: 'concave-star', label: 'Concave Star' },
                    ] as const
                  ).map((opt) => {
                    const active = polygonShape === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChangePolygonShape(opt.id)}
                        aria-pressed={active}
                        className={`h-8 rounded border px-2 text-xs font-medium transition-colors whitespace-nowrap ${
                          active
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {tool === 'bezier' && (
              <div className="mt-3 space-y-2.5 rounded-md border border-zinc-200 bg-zinc-50/80 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold text-zinc-700">
                    Bengali Ritual &amp; Folk Stamps ({BENGALI_BEZIER_STAMPS.length})
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    1-click symmetric
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {BENGALI_BEZIER_STAMPS.map((stamp) => (
                    <button
                      key={stamp.id}
                      type="button"
                      data-testid={`bezier-stamp-${stamp.id}`}
                      onClick={() => onStampBezierMotif(stamp.id)}
                      className="rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-[#B91C1C] hover:bg-red-50/40"
                    >
                      <div className="text-xs font-medium text-zinc-900">
                        {stamp.name}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {stamp.bengali}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-zinc-600">
                      <label htmlFor="bezier-ring">Ring radius</label>
                      <span className="font-mono text-zinc-900">
                        {Math.round(bezierRingFactor * 100)}%
                      </span>
                    </div>
                    <input
                      id="bezier-ring"
                      type="range"
                      min={18}
                      max={44}
                      value={Math.round(bezierRingFactor * 100)}
                      onChange={(e) =>
                        onChangeBezierRingFactor(Number(e.target.value) / 100)
                      }
                      className="w-full accent-[#B91C1C]"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-zinc-600">
                      <label htmlFor="bezier-arch">Drag arch</label>
                      <span className="font-mono text-zinc-900">
                        {bezierCurvature.toFixed(2)}
                      </span>
                    </div>
                    <input
                      id="bezier-arch"
                      type="range"
                      min={-80}
                      max={80}
                      step={5}
                      value={Math.round(bezierCurvature * 100)}
                      onChange={(e) =>
                        onChangeBezierCurvature(Number(e.target.value) / 100)
                      }
                      className="w-full accent-[#B91C1C]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                    <input
                      type="checkbox"
                      checked={showDeCasteljau}
                      onChange={(e) => onChangeShowDeCasteljau(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#B91C1C]"
                    />
                    <span>de Casteljau hull</span>
                  </label>
                  {hasBezierOps && (
                    <button
                      type="button"
                      onClick={() => onChangeTool('edit')}
                      className="text-xs font-medium text-[#B91C1C] hover:underline"
                    >
                      Edit P0–P3 →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Line Rasterizer Selector (Bresenham vs DDA — visible in Engine Specs Mode) */}
            {labMode && (
              <div
                data-testid="lab-rasterizer-selector"
                className="mt-3 border-t border-zinc-100 pt-2.5"
              >
                <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-600">
                  <span>Line rasterizer</span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    Kernel
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'bresenham', label: 'Bresenham' },
                      { id: 'dda', label: 'DDA' },
                    ] as const
                  ).map((opt) => {
                    const active = lineAlgorithm === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onChangeLineAlgorithm(opt.id)}
                        aria-pressed={active}
                        className={`h-8 rounded-md border text-xs font-medium transition-colors ${
                          active
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Radial Symmetry */}
          <div className="p-5">
            <div className="mb-2.5 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Radial Symmetry
              </h2>
              <span className="font-mono text-xs tabular-nums text-zinc-600">
                {symmetry.sectors} sectors · {(360 / symmetry.sectors).toFixed(1)}°
              </span>
            </div>

            <div className="mb-3 grid grid-cols-4 gap-1.5">
              {SECTOR_PRESETS.map((n) => {
                const active = symmetry.sectors === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onChangeSymmetry({ ...symmetry, sectors: n })}
                    aria-pressed={active}
                    className={`h-8 rounded-md border font-mono text-sm font-medium tabular-nums transition-colors ${
                      active
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                <label htmlFor="mirror-lines-slider">Mirror lines</label>
                <span className="font-mono font-medium tabular-nums text-zinc-900">
                  {symmetry.sectors}
                </span>
              </div>
              <input
                id="mirror-lines-slider"
                type="range"
                min={3}
                max={16}
                step={1}
                value={symmetry.sectors}
                onChange={(e) =>
                  onChangeSymmetry({
                    ...symmetry,
                    sectors: Number(e.target.value),
                  })
                }
                className="studio-slider w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium text-zinc-800">
                <span className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={symmetry.reflect}
                    onChange={(e) =>
                      onChangeSymmetry({
                        ...symmetry,
                        reflect: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-zinc-300 accent-[#B91C1C]"
                  />
                  <span>Reflect (dihedral Dₙ)</span>
                </span>
                <span className="font-mono text-xs tabular-nums text-zinc-500">
                  {symmetry.reflect
                    ? `${symmetry.sectors * 2}×`
                    : `${symmetry.sectors}×`}
                </span>
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium text-zinc-800">
                <span className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showSymmetryAxes}
                    onChange={(e) =>
                      onChangeShowSymmetryAxes(e.target.checked)
                    }
                    className="h-4 w-4 rounded border-zinc-300 accent-[#B91C1C]"
                  />
                  <span>Show reflection axes</span>
                </span>
                <span className="font-mono text-xs text-zinc-400">X</span>
              </label>
            </div>

            <button
              type="button"
              onClick={onSyncAllStrokes}
              disabled={!hasStrokes}
              className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sync Existing Pattern to {symmetry.sectors} Sectors</span>
            </button>

            <div className="mt-3.5 border-t border-zinc-100 pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-800">
                  Mirror Flip
                </span>
                {canMirrorSelectedLayer ? (
                  <div
                    role="group"
                    aria-label="Mirror flip target"
                    className="inline-flex rounded border border-zinc-200 bg-zinc-50 p-0.5 text-[11px] font-medium"
                  >
                    <button
                      type="button"
                      data-testid="mirror-scope-layer"
                      onClick={() => setMirrorTarget('auto')}
                      aria-pressed={effectiveMirrorScope === 'layer'}
                      className={`rounded px-1.5 py-0.5 transition-colors ${
                        effectiveMirrorScope === 'layer'
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Layer
                    </button>
                    <button
                      type="button"
                      data-testid="mirror-scope-canvas"
                      onClick={() => setMirrorTarget('canvas')}
                      aria-pressed={effectiveMirrorScope === 'canvas'}
                      className={`rounded px-1.5 py-0.5 transition-colors ${
                        effectiveMirrorScope === 'canvas'
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Canvas
                    </button>
                  </div>
                ) : (
                  <span
                    data-testid="mirror-scope-label"
                    className="font-mono text-[11px] text-zinc-500"
                  >
                    {selectedLayerOp?.locked
                      ? 'Layer locked · Canvas'
                      : 'Canvas view'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  data-testid="mirror-horizontal-btn"
                  onClick={() => {
                    if (effectiveMirrorScope === 'layer') {
                      onMirrorSelectedLayer('horizontal');
                    } else {
                      onChangeTransform2D({
                        ...transform2D,
                        flipX: !transform2D.flipX,
                      });
                    }
                  }}
                  aria-pressed={
                    effectiveMirrorScope === 'canvas'
                      ? Boolean(transform2D.flipX)
                      : undefined
                  }
                  className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    effectiveMirrorScope === 'canvas' && transform2D.flipX
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                  }`}
                >
                  <FlipHorizontal2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Horizontal Mirror</span>
                </button>
                <button
                  type="button"
                  data-testid="mirror-vertical-btn"
                  onClick={() => {
                    if (effectiveMirrorScope === 'layer') {
                      onMirrorSelectedLayer('vertical');
                    } else {
                      onChangeTransform2D({
                        ...transform2D,
                        flipY: !transform2D.flipY,
                      });
                    }
                  }}
                  aria-pressed={
                    effectiveMirrorScope === 'canvas'
                      ? Boolean(transform2D.flipY)
                      : undefined
                  }
                  className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    effectiveMirrorScope === 'canvas' && transform2D.flipY
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                  }`}
                >
                  <FlipVertical2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Vertical Mirror</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. Pigments, Color Model Readout, Weight & Courtyard Surface */}
          <div className="p-5">
            <div className="mb-2.5 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Alpona Pigments
              </h2>
              <span className="text-xs text-zinc-500">
                {activeSwatch
                  ? `${activeSwatch.name} (${activeSwatch.bengali})`
                  : color.toUpperCase()}
              </span>
            </div>

            <div className="mb-3 grid grid-cols-9 gap-1.5">
              {ALPONA_PALETTE.map((swatch) => {
                const selected =
                  swatch.hex.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => onChangeColor(swatch.hex)}
                    aria-label={`Select ${swatch.name} pigment`}
                    aria-pressed={selected}
                    title={`${swatch.name} — ${swatch.bengali}`}
                    className={`aspect-square w-full rounded-full border transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C] ${
                      selected
                        ? 'scale-110 border-zinc-950 ring-2 ring-[#B91C1C] ring-offset-1'
                        : 'border-zinc-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                );
              })}
              <label
                title="Custom color"
                className="relative flex aspect-square w-full cursor-pointer items-center justify-center rounded-full border border-dashed border-zinc-400 bg-zinc-50 text-xs font-medium text-zinc-600 hover:border-zinc-600"
              >
                <span className="sr-only">Pick custom pigment color</span>
                <span aria-hidden="true">+</span>
                <input
                  type="color"
                  aria-label="Custom pigment color"
                  value={color}
                  onChange={(e) => onChangeColor(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
            </div>

            <div
              aria-label="Selected pigment color models"
              className="mb-3.5 rounded-md border border-zinc-200/80 bg-zinc-50/70 px-3 py-1.5 font-mono text-[11px] tabular-nums text-zinc-600 space-y-0.5"
            >
              <div className="flex justify-between">
                <span>
                  RGB({colorBreakdown.rgb.r}, {colorBreakdown.rgb.g},{' '}
                  {colorBreakdown.rgb.b})
                </span>
                <span>Y = {colorBreakdown.luminance}</span>
              </div>
              <div className="flex justify-between">
                <span>
                  HSV({colorBreakdown.hsv.h}°, {colorBreakdown.hsv.s}%,{' '}
                  {colorBreakdown.hsv.v}%)
                </span>
                <span>
                  CMYK({colorBreakdown.cmyk.c},{colorBreakdown.cmyk.m},
                  {colorBreakdown.cmyk.y},{colorBreakdown.cmyk.k})
                </span>
              </div>
            </div>

            {/* Brush Thickness */}
            <div className="mb-3.5">
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                <label htmlFor="brush-weight-slider">Stroke weight</label>
                <span className="font-mono font-medium tabular-nums text-zinc-900">
                  {thickness} px
                </span>
              </div>
              <input
                id="brush-weight-slider"
                type="range"
                min={1}
                max={8}
                step={1}
                value={thickness}
                onChange={(e) => onChangeThickness(Number(e.target.value))}
                className="studio-slider w-full"
              />
            </div>

            {/* Canvas Surface */}
            <div>
              <span className="mb-1.5 block text-xs font-medium text-zinc-600">
                Courtyard surface
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {CANVAS_SURFACES.map((s) => {
                  const active = surfaceId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onChangeSurface(s.id)}
                      aria-pressed={active}
                      className={`flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 rounded-sm border border-black/20"
                        style={{ backgroundColor: s.hex }}
                      />
                      <span className="truncate">{s.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LAYERS — Grouped Stroke Layers & Tracing Reference Underlay */}
      {activeTab === 'layers' && (
        <div
          role="tabpanel"
          aria-label="Stroke layers and tracing reference underlay"
          className="divide-y divide-zinc-200/80"
        >
          <LayerStackPanel
            operations={operations}
            activeColor={color}
            selectedLayerId={selectedLayerId}
            selectedGroupName={selectedGroupName}
            selectedGroupLayerIds={selectedGroupLayerIds}
            onClearGroupSelection={onClearGroupSelection}
            onToggleVisibility={onToggleLayerVisibility}
            onToggleLock={onToggleLayerLock}
            onChangeOpacity={onChangeLayerOpacity}
            onToggleGroupVisibility={onToggleGroupVisibility}
            onAssignGroup={onAssignLayerGroup}
            onEditLayer={(id) => {
              onEditLayer(id);
              setActiveTab('draw');
            }}
            onShowAll={onShowAllLayers}
            onMoveOrder={onMoveLayerOrder}
            onRecolor={onRecolorLayer}
            onDelete={onDeleteLayer}
          />

          <ReferenceUnderlayPanel
            underlay={referenceUnderlay}
            onChangeUnderlay={onChangeReferenceUnderlay}
          />
        </div>
      )}

      {/* TAB 3: CRAFT — Starter Motifs, Procedural Composer, Colorways, Clipping & 2D Matrix */}
      {activeTab === 'craft' && (
        <div
          role="tabpanel"
          aria-label="Motifs, procedural composer, colorways, clipping and transforms"
          className="divide-y divide-zinc-200/80"
        >
          {/* Starter Motifs */}
          <div className="p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Starter Motifs
              </h2>
              <span className="text-xs text-zinc-500">Traditional presets</span>
            </div>

            <div className="space-y-1.5">
              {ALPONA_MOTIFS.map((motif) => {
                const active = activeMotifId === motif.id;
                const symTag = motif.defaultSymmetry.reflect
                  ? `D${motif.defaultSymmetry.sectors}`
                  : `C${motif.defaultSymmetry.sectors}`;
                return (
                  <button
                    key={motif.id}
                    type="button"
                    onClick={() => onSelectMotif(motif.id)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B91C1C] ${
                      active
                        ? 'border-[#B91C1C]/40 bg-red-50/60 text-zinc-950'
                        : 'border-zinc-200/80 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-900">
                        {motif.name}
                      </div>
                      <div className="truncate text-[11px] text-zinc-500">
                        {motif.bengaliTitle}
                      </div>
                    </div>
                    <span className="ml-3 font-mono text-xs font-medium tabular-nums text-zinc-500 shrink-0">
                      {symTag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Procedural Lata-Pata L-System & Phyllotaxis Composer */}
          <div className="p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Procedural Composer
              </h2>
              <span className="font-mono text-[11px] text-zinc-500">
                L-System · 137.5°
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="proc-seed-input"
                  className="text-xs font-medium text-zinc-600 shrink-0"
                >
                  Seed
                </label>
                <input
                  id="proc-seed-input"
                  type="number"
                  min={1}
                  max={999999}
                  value={procSeed}
                  onChange={(e) =>
                    setProcSeed(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="h-8 w-full rounded border border-zinc-300 bg-white px-2.5 font-mono text-xs tabular-nums text-zinc-900 focus:border-[#B91C1C] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setProcSeed(
                      (prev) =>
                        (((prev * 1103515245 + 12345) >>> 16) % 9000) + 1000
                    )
                  }
                  aria-label="Next deterministic seed"
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Next</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={includePhyllotaxis}
                    onChange={(e) => setIncludePhyllotaxis(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#B91C1C]"
                  />
                  <span>Golden-Angle Phyllotaxis Core</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={includeRhodonea}
                    onChange={(e) => setIncludeRhodonea(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#B91C1C]"
                  />
                  <span>Polar Rhodonea Lotus Petals</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={includeLSystemVine}
                    onChange={(e) => setIncludeLSystemVine(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#B91C1C]"
                  />
                  <span>L-System Lata-Pata Vine Border</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onComposeProcedural({
                      seed: procSeed,
                      includePhyllotaxis,
                      includeRhodonea,
                      includeLSystemVine,
                      append: false,
                    })
                  }
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#B91C1C] px-3 text-xs font-medium text-white transition-colors hover:bg-[#991B1B]"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Compose Alpona</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onComposeProcedural({
                      seed: procSeed,
                      includePhyllotaxis,
                      includeRhodonea,
                      includeLSystemVine,
                      append: true,
                    })
                  }
                  className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
                >
                  + Add Ring
                </button>
              </div>
            </div>
          </div>

          {/* Kolam / Pulli Dot-Grid Composer (mirror-curve algorithm) */}
          <div className="p-5" data-testid="kolam-composer">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Kolam Dot Grid
              </h2>
              <span className="font-mono text-[11px] text-zinc-500">
                Pulli · Mirror curves
              </span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['kolam-rows', 'Rows', kolamRows, setKolamRows],
                    ['kolam-cols', 'Columns', kolamCols, setKolamCols],
                  ] as const
                ).map(([id, label, value, setValue]) => (
                  <label key={id} htmlFor={id} className="space-y-1">
                    <span className="flex items-baseline justify-between text-xs font-medium text-zinc-600">
                      {label}
                      <span className="font-mono tabular-nums text-zinc-900">
                        {value} dots
                      </span>
                    </span>
                    <input
                      id={id}
                      type="range"
                      min={KOLAM_MIN_DOTS}
                      max={KOLAM_MAX_DOTS}
                      value={value}
                      onChange={(e) => setValue(clampKolamDots(Number(e.target.value)))}
                      className="w-full accent-[#B91C1C]"
                    />
                  </label>
                ))}
              </div>

              <div>
                <span className="mb-1 block text-xs font-medium text-zinc-600">
                  Symmetry
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['none', 'Free'],
                      ['mirror', 'Mirror'],
                      ['rotational', 'Rotate'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setKolamSymmetry(id)}
                      aria-pressed={kolamSymmetry === id}
                      className={`h-8 rounded border text-xs font-medium transition-colors ${
                        kolamSymmetry === id
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label htmlFor="kolam-density" className="block space-y-1">
                <span className="flex items-baseline justify-between text-xs font-medium text-zinc-600">
                  Mirror density
                  <span className="font-mono tabular-nums text-zinc-900">
                    {kolamDensity}%
                  </span>
                </span>
                <input
                  id="kolam-density"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={kolamDensity}
                  onChange={(e) => setKolamDensity(Number(e.target.value))}
                  className="w-full accent-[#B91C1C]"
                />
              </label>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="kolam-seed-input"
                  className="text-xs font-medium text-zinc-600 shrink-0"
                >
                  Seed
                </label>
                <input
                  id="kolam-seed-input"
                  type="number"
                  min={1}
                  max={999999}
                  value={kolamSeed}
                  onChange={(e) =>
                    setKolamSeed(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="h-8 w-full rounded border border-zinc-300 bg-white px-2.5 font-mono text-xs tabular-nums text-zinc-900 focus:border-[#B91C1C] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setKolamSeed(
                      (prev) =>
                        (((prev * 1103515245 + 12345) >>> 16) % 9000) + 1000
                    )
                  }
                  aria-label="Next kolam seed"
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Next</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {(
                  [
                    [kolamSingleLoop, setKolamSingleLoop, 'One continuous stroke (single loop)'],
                    [kolamShowDots, setKolamShowDots, 'Show pulli dots'],
                    [kolamColorLoops, setKolamColorLoops, 'Colour each loop differently'],
                  ] as const
                ).map(([checked, setChecked, label]) => (
                  <label
                    key={label}
                    className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setChecked(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#B91C1C]"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {([false, true] as const).map((append) => (
                  <button
                    key={append ? 'add' : 'draw'}
                    type="button"
                    onClick={() => {
                      const result = onComposeKolam({
                        rows: kolamRows,
                        cols: kolamCols,
                        symmetry: kolamSymmetry,
                        mirrorDensity: kolamDensity / 100,
                        seed: kolamSeed,
                        requireSingleLoop: kolamSingleLoop,
                        showDots: kolamShowDots,
                        colorEachLoop: kolamColorLoops,
                        append,
                      });
                      setKolamResult(result);
                      setKolamSeed(result.seedUsed);
                    }}
                    className={
                      append
                        ? 'inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50'
                        : 'inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#B91C1C] px-3 text-xs font-medium text-white transition-colors hover:bg-[#991B1B]'
                    }
                  >
                    {append ? (
                      '+ Add on Top'
                    ) : (
                      <>
                        <Grid3x3 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Draw Kolam</span>
                      </>
                    )}
                  </button>
                ))}
              </div>

              {kolamResult && (
                <p
                  className="rounded border border-zinc-200 bg-zinc-50 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-zinc-600"
                  data-testid="kolam-result"
                >
                  {kolamResult.rows}×{kolamResult.cols} dots ·{' '}
                  {kolamResult.isSingleLoop
                    ? '1 loop (one stroke)'
                    : `${kolamResult.loopCount} loops`}{' '}
                  · {kolamResult.segmentCount} segments ·{' '}
                  {kolamResult.innerMirrorCount} mirrors · seed #
                  {kolamResult.seedUsed}
                  {kolamSingleLoop && !kolamResult.isSingleLoop && (
                    <span className="block text-[#B91C1C]">
                      No one-stroke layout found in {kolamResult.attempts} tries —
                      change the size, symmetry or density.
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Festival & Saree Photo K-Means Colorways */}
          <div className="p-5 space-y-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Festival &amp; Photo Colorways
              </h2>
              <span className="font-mono text-[10px] text-zinc-500">
                K-Means k=5
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {FESTIVAL_COLORWAYS.map((cw) => (
                <button
                  key={cw.id}
                  type="button"
                  onClick={() =>
                    onApplyColorway(cw.palette, cw.surfaceId, cw.name)
                  }
                  className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-left transition-colors hover:border-[#B91C1C]"
                >
                  <div className="truncate text-[11px] font-medium text-zinc-900">
                    {cw.name}
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    {cw.palette.slice(0, 4).map((hex) => (
                      <span
                        key={hex}
                        className="h-2.5 flex-1 rounded-[2px] border border-black/10"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => colorwayPhotoRef.current?.click()}
              className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-800 transition-colors hover:border-zinc-900 hover:bg-zinc-50"
            >
              <ImagePlus
                className="h-3.5 w-3.5 text-[#B91C1C]"
                aria-hidden="true"
              />
              <span>Match Saree Photo (K-Means)</span>
            </button>
            <input
              ref={colorwayPhotoRef}
              type="file"
              accept="image/*"
              aria-label="Upload saree or room photo for K-Means colorway extraction"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onExtractPhotoColorway(file);
                e.currentTarget.value = '';
              }}
            />

            {extractedPalette && extractedPalette.length > 0 && (
              <div className="pt-1">
                <div className="mb-1 text-[10px] font-medium text-zinc-600">
                  Extracted photo pigments (click to draw):
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {extractedPalette.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => onChangeColor(hex)}
                      title={hex}
                      aria-label={`Select extracted color ${hex}`}
                      className="h-5 rounded border border-black/15 transition-transform hover:scale-105"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Clipping Window & 2D Homogeneous Matrix (visible in Engine Specs Mode) */}
          {labMode && (
          <div data-testid="lab-clipping-transform" className="p-5 space-y-4">
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Clipping Window
                </h2>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={clippingWindow.enabled}
                    onChange={(e) =>
                      onChangeClippingWindow({
                        ...clippingWindow,
                        enabled: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-zinc-300 accent-[#B91C1C]"
                  />
                  <span>Active</span>
                </label>
              </div>

              {clippingWindow.enabled && (
                <div className="space-y-3 rounded-md border border-amber-200/90 bg-amber-50/40 p-3">
                  <div>
                    <div className="mb-1 text-[11px] font-medium text-zinc-600">
                      Line clipping algorithm
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'cohen-sutherland', label: 'Cohen-Sutherland' },
                          { id: 'liang-barsky', label: 'Liang-Barsky' },
                        ] as const
                      ).map((algo) => {
                        const active = clippingWindow.algorithm === algo.id;
                        return (
                          <button
                            key={algo.id}
                            type="button"
                            onClick={() =>
                              onChangeClippingWindow({
                                ...clippingWindow,
                                algorithm: algo.id,
                              })
                            }
                            aria-pressed={active}
                            className={`h-8 rounded border px-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                              active
                                ? 'border-zinc-900 bg-zinc-900 text-white'
                                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                            }`}
                          >
                            {algo.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-[11px] font-medium text-zinc-600">
                      Polygon clipping algorithm
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          {
                            id: 'sutherland-hodgman',
                            label: 'Sutherland-Hodgman',
                          },
                          { id: 'weiler-atherton', label: 'Weiler-Atherton' },
                        ] as const
                      ).map((algo) => {
                        const active =
                          (clippingWindow.polygonAlgorithm ??
                            'sutherland-hodgman') === algo.id;
                        return (
                          <button
                            key={algo.id}
                            type="button"
                            onClick={() =>
                              onChangeClippingWindow({
                                ...clippingWindow,
                                polygonAlgorithm: algo.id,
                              })
                            }
                            aria-pressed={active}
                            className={`h-8 rounded border px-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                              active
                                ? 'border-[#B91C1C] bg-[#B91C1C] text-white'
                                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                            }`}
                          >
                            {algo.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                      <label htmlFor="clip-inset-slider">Window inset</label>
                      <span className="font-mono font-medium tabular-nums text-zinc-900">
                        {clippingWindow.inset} px
                      </span>
                    </div>
                    <input
                      id="clip-inset-slider"
                      type="range"
                      min={40}
                      max={210}
                      step={5}
                      value={clippingWindow.inset}
                      onChange={(e) =>
                        onChangeClippingWindow({
                          ...clippingWindow,
                          inset: Number(e.target.value),
                        })
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-zinc-100 pt-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">
                  2D Matrix Transform
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    onChangeTransform2D({ ...DEFAULT_TRANSFORM_2D })
                  }
                  disabled={!hasTransform}
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-[#B91C1C] disabled:opacity-35"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    data-testid="matrix-flip-x"
                    onClick={() =>
                      onChangeTransform2D({
                        ...transform2D,
                        flipX: !transform2D.flipX,
                      })
                    }
                    aria-pressed={Boolean(transform2D.flipX)}
                    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      transform2D.flipX
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100'
                    }`}
                  >
                    <FlipHorizontal2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Flip X (−1, 1)</span>
                  </button>
                  <button
                    type="button"
                    data-testid="matrix-flip-y"
                    onClick={() =>
                      onChangeTransform2D({
                        ...transform2D,
                        flipY: !transform2D.flipY,
                      })
                    }
                    aria-pressed={Boolean(transform2D.flipY)}
                    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      transform2D.flipY
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100'
                    }`}
                  >
                    <FlipVertical2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>Flip Y (1, −1)</span>
                  </button>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                    <label htmlFor="t2d-rotate">Global rotate (θ)</label>
                    <span className="font-mono tabular-nums text-zinc-900">
                      {transform2D.rotateDeg}°
                    </span>
                  </div>
                  <input
                    id="t2d-rotate"
                    type="range"
                    min={-180}
                    max={180}
                    step={5}
                    value={transform2D.rotateDeg}
                    onChange={(e) =>
                      onChangeTransform2D({
                        ...transform2D,
                        rotateDeg: Number(e.target.value),
                      })
                    }
                    className="studio-slider w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                      <label htmlFor="t2d-scale">Scale</label>
                      <span className="font-mono tabular-nums text-zinc-900">
                        {transform2D.scaleX.toFixed(2)}×
                      </span>
                    </div>
                    <input
                      id="t2d-scale"
                      type="range"
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      value={transform2D.scaleX}
                      onChange={(e) => {
                        const s = Number(e.target.value);
                        onChangeTransform2D({
                          ...transform2D,
                          scaleX: s,
                          scaleY: s,
                        });
                      }}
                      className="studio-slider w-full"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                      <label htmlFor="t2d-shear">Shear X</label>
                      <span className="font-mono tabular-nums text-zinc-900">
                        {transform2D.shearX.toFixed(2)}
                      </span>
                    </div>
                    <input
                      id="t2d-shear"
                      type="range"
                      min={-0.5}
                      max={0.5}
                      step={0.05}
                      value={transform2D.shearX}
                      onChange={(e) =>
                        onChangeTransform2D({
                          ...transform2D,
                          shearX: Number(e.target.value),
                        })
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                      <label htmlFor="t2d-tx">Shift X</label>
                      <span className="font-mono tabular-nums text-zinc-900">
                        {transform2D.translateX} px
                      </span>
                    </div>
                    <input
                      id="t2d-tx"
                      type="range"
                      min={-140}
                      max={140}
                      step={5}
                      value={transform2D.translateX}
                      onChange={(e) =>
                        onChangeTransform2D({
                          ...transform2D,
                          translateX: Number(e.target.value),
                        })
                      }
                      className="studio-slider w-full"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-zinc-600">
                      <label htmlFor="t2d-ty">Shift Y</label>
                      <span className="font-mono tabular-nums text-zinc-900">
                        {transform2D.translateY} px
                      </span>
                    </div>
                    <input
                      id="t2d-ty"
                      type="range"
                      min={-140}
                      max={140}
                      step={5}
                      value={transform2D.translateY}
                      onChange={(e) =>
                        onChangeTransform2D({
                          ...transform2D,
                          translateY: Number(e.target.value),
                        })
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      )}
    </aside>
  );
}
