import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlgorithmsView } from './components/AlgorithmsView';
import { AlponaCanvas, CANVAS_SIZE } from './components/AlponaCanvas';
import { ControlDeck } from './components/ControlDeck';
import { CppSourceView } from './components/CppSourceView';
import { DocumentationSidebar } from './components/DocumentationSidebar';
import { DraftRecoveryBanner } from './components/DraftRecoveryBanner';
import { FloorPrintView } from './components/FloorPrintView';
import { HeaderBar, type StudioView } from './components/HeaderBar';
import { ImageLabView } from './components/ImageLabView';
import { Projection3DView } from './components/Projection3DView';
import { ProjectGalleryModal } from './components/ProjectGalleryModal';
import { ShortcutsHelpModal } from './components/ShortcutsHelpModal';
import { StudioSplashOverlay } from './components/StudioSplashOverlay';
import type { DocGuideTab } from './graphics/documentationGuides';
import { BENGALI_BEZIER_STAMPS } from './graphics/bezier';
import {
  STUDIO_QUICK_START_TEMPLATES,
  type StudioQuickStartTemplate,
} from './graphics/desktopGui';
import { getCanvasContinuityTransition } from './graphics/viewContinuity';
import {
  DEFAULT_SNAP_CONFIG,
  type SnapConfig,
} from './graphics/canvasAssist';
import {
  extractKMeansPalette,
  pickContrastingSurfaceForPalette,
  remapOperationsColorway,
} from './graphics/colorwayRemap';
import {
  clearDraftFromStorage,
  computeDraftSyncIndicator,
  loadDraftFromStorage,
  saveDraftToStorage,
} from './graphics/draftStorage';
import {
  assignOperationGroup,
  DEFAULT_REFERENCE_UNDERLAY,
  deleteOperationById,
  getOperationIdsInGroup,
  moveOperationOrder,
  recolorOperation,
  setAllOperationsVisibility,
  setOperationOpacity,
  toggleGroupVisibility,
  toggleOperationLock,
  toggleOperationVisibility,
  updateBezierControlPoint,
  type BezierHandleKey,
  type ReferenceUnderlayConfig,
} from './graphics/layerStack';
import {
  mirrorOperation,
  replaceOperationInStack,
  type MirrorAxis,
} from './graphics/layerTransform';
import {
  createBrowserGalleryBackend,
  deleteGalleryProject,
  listGalleryProjects,
  renameGalleryProject,
  saveGalleryProject,
  type SavedAlponaProject,
} from './graphics/projectGallery';
import type { RenderOptions } from './graphics/engine';
import {
  exportAlponaPng,
  exportPrintableStencilPng,
  FESTIVAL_GREETING_PRESETS,
  type GreetingCardOptions,
} from './graphics/exportCard';
import {
  PRINT_STENCIL_EXPORT_SIZE,
  renderUltraHdAlponaCanvas,
  ULTRA_HD_EXPORT_SIZE,
} from './graphics/highResExport';
import { composeProceduralAlpona } from './graphics/generativeComposer';
import { composeKolam, type KolamSymmetry } from './graphics/kolamComposer';
import { ALPONA_MOTIFS } from './graphics/motifs';
import {
  parseAlponaProject,
  serializeAlponaProject,
} from './graphics/projectFile';
import { downloadAlponaSvg, generateAlponaSvg } from './graphics/svgExport';
import { exportAlponaTimelapseReel } from './graphics/videoReelExport';
import {
  ALPONA_PALETTE,
  CANVAS_SURFACES,
  DEFAULT_TRANSFORM_2D,
  type CanvasSurfaceId,
  type ClippingWindowConfig,
  type DrawingTool,
  type DrawOperation,
  type LineAlgorithm,
  type PipelineMetrics,
  type PolygonShapeMode,
  type SymmetryConfig,
  type Transform2DConfig,
} from './graphics/types';

const INITIAL_MOTIF = ALPONA_MOTIFS[0]; // Padma Lotus

const EMPTY_METRICS: PipelineMetrics = {
  operationsCount: 0,
  bresenhamLinePixels: 0,
  ddaLinePixels: 0,
  midpointCirclePixels: 0,
  seedFillPixels: 0,
  segmentsSubmitted: 0,
  segmentsClipped: 0,
  segmentsRejected: 0,
  polygonsClipped: 0,
  lastRenderMs: 0,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const initialDraft = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return loadDraftFromStorage(window.localStorage);
  }, []);

  const [activeView, setActiveView] = useState<StudioView>('studio');
  const [previousView, setPreviousView] = useState<StudioView>('studio');
  const [labMode, setLabMode] = useState(false);
  const [hdPreview, setHdPreview] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsTab, setDocsTab] = useState<DocGuideTab>('quick-start');
  const [galleryProjects, setGalleryProjects] = useState<SavedAlponaProject[]>(
    []
  );
  const galleryBackend = useMemo(() => createBrowserGalleryBackend(), []);
  const [tool, setTool] = useState<DrawingTool>('freehand');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(
    null
  );
  const [polygonShape, setPolygonShape] = useState<PolygonShapeMode>('concave-star');
  const [bezierCurvature, setBezierCurvature] = useState(0.42);
  const [bezierRingFactor, setBezierRingFactor] = useState(0.36);
  const [showDeCasteljau, setShowDeCasteljau] = useState(true);
  const [symmetry, setSymmetry] = useState<SymmetryConfig>(
    () => initialDraft?.symmetry ?? INITIAL_MOTIF.defaultSymmetry
  );
  const [symmetricFill, setSymmetricFill] = useState(true);
  const [color, setColor] = useState('#FAF8F2');
  const [thickness, setThickness] = useState(3);
  const [stabilizerLevel, setStabilizerLevel] = useState(2);
  const [taperedBrush, setTaperedBrush] = useState(true);
  const [extractedPalette, setExtractedPalette] = useState<string[] | null>(null);
  const [surfaceId, setSurfaceId] = useState<CanvasSurfaceId>(
    () => initialDraft?.surfaceId ?? INITIAL_MOTIF.defaultSurface
  );
  const [showGuides, setShowGuides] = useState(true);
  const [showSymmetryAxes, setShowSymmetryAxes] = useState(true);
  const [snapConfig, setSnapConfig] = useState<SnapConfig>(DEFAULT_SNAP_CONFIG);
  const [referenceUnderlay, setReferenceUnderlay] =
    useState<ReferenceUnderlayConfig>(DEFAULT_REFERENCE_UNDERLAY);
  const [lineAlgorithm, setLineAlgorithm] = useState<LineAlgorithm>(
    () => initialDraft?.lineAlgorithm ?? 'bresenham'
  );
  const [clippingWindow, setClippingWindow] = useState<ClippingWindowConfig>(
    () =>
      initialDraft?.clippingWindow ?? {
        enabled: false,
        inset: 110,
        algorithm: 'cohen-sutherland',
        polygonAlgorithm: 'weiler-atherton',
      }
  );
  const [transform2D, setTransform2D] = useState<Transform2DConfig>(
    () => initialDraft?.transform2D ?? { ...DEFAULT_TRANSFORM_2D }
  );

  const [activeMotifId, setActiveMotifId] = useState<string | null>(
    () => (initialDraft ? null : INITIAL_MOTIF.id)
  );
  const [operations, setOperations] = useState<DrawOperation[]>(
    () => initialDraft?.operations ?? INITIAL_MOTIF.buildOperations(CANVAS_SIZE)
  );
  const defaultMotifStrokeCount = useMemo(
    () => INITIAL_MOTIF.buildOperations(CANVAS_SIZE).length,
    []
  );
  const [restoredDraftInfo, setRestoredDraftInfo] = useState<{
    savedAt: number;
    strokesCount: number;
  } | null>(() =>
    initialDraft &&
    (initialDraft.operations.length !== defaultMotifStrokeCount ||
      initialDraft.surfaceId !== INITIAL_MOTIF.defaultSurface)
      ? {
          savedAt: initialDraft.savedAt,
          strokesCount: initialDraft.operations.length,
        }
      : null
  );
  const hasUserMutatedRef = useRef(false);
  const [lastDraftSyncedAt, setLastDraftSyncedAt] = useState<number | null>(
    () => initialDraft?.savedAt ?? null
  );
  const [pastSnapshots, setPastSnapshots] = useState<DrawOperation[][]>([]);
  const [futureSnapshots, setFutureSnapshots] = useState<DrawOperation[][]>([]);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayCount, setReplayCount] = useState<number>(0);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PipelineMetrics>(EMPTY_METRICS);
  const [greetingCard, setGreetingCard] = useState<GreetingCardOptions>({
    enabled: false,
    headline: FESTIVAL_GREETING_PRESETS[0].headline,
    subtitle: FESTIVAL_GREETING_PRESETS[0].subtitle,
  });
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [reelProgress, setReelProgress] = useState<number | null>(null);

  const surface =
    CANVAS_SURFACES.find((s) => s.id === surfaceId) ?? CANVAS_SURFACES[0];

  const renderOptions = useMemo<RenderOptions>(
    () => ({
      lineAlgorithm,
      clippingWindow,
      transform2D,
    }),
    [lineAlgorithm, clippingWindow, transform2D]
  );

  const mutateOperationsWithHistory = useCallback(
    (updater: (prev: DrawOperation[]) => DrawOperation[]) => {
      hasUserMutatedRef.current = true;
      setOperations((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        setPastSnapshots((past) => [...past.slice(-39), prev]);
        setFutureSnapshots([]);
        return next;
      });
    },
    []
  );

  // Debounced (450ms) automatic localStorage draft persistence
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      const savedAt = Date.now();
      const didSave = saveDraftToStorage(window.localStorage, {
        version: 1,
        savedAt,
        surfaceId,
        symmetry,
        lineAlgorithm,
        clippingWindow,
        transform2D,
        operations,
      });
      if (didSave) {
        setLastDraftSyncedAt(savedAt);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    operations,
    surfaceId,
    symmetry,
    lineAlgorithm,
    clippingWindow,
    transform2D,
  ]);

  const draftSyncIndicator = useMemo(
    () =>
      computeDraftSyncIndicator(
        lastDraftSyncedAt,
        lastDraftSyncedAt ?? Date.now()
      ),
    [lastDraftSyncedAt]
  );

  // Load saved IndexedDB multi-project gallery entries on mount
  useEffect(() => {
    let active = true;
    listGalleryProjects(galleryBackend)
      .then((list) => {
        if (active) setGalleryProjects(list);
      })
      .catch(() => {
        // Ignore storage errors on restricted environments
      });
    return () => {
      active = false;
    };
  }, [galleryBackend]);

  const handleCommitOperation = useCallback(
    (op: DrawOperation) => {
      mutateOperationsWithHistory((prev) => [...prev, op]);
      if (op.kind === 'bezier') {
        setSelectedLayerId(op.id);
      }
    },
    [mutateOperationsWithHistory]
  );

  const handleUndo = useCallback(() => {
    setPastSnapshots((past) => {
      if (past.length > 0) {
        const previous = past[past.length - 1];
        setOperations((curr) => {
          setFutureSnapshots((fut) => [...fut, curr]);
          return previous;
        });
        return past.slice(0, -1);
      }
      // Fallback: undo starter motif strokes one-by-one even on fresh load
      setOperations((curr) => {
        if (curr.length === 0) return curr;
        setFutureSnapshots((fut) => [...fut, curr]);
        return curr.slice(0, -1);
      });
      return past;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setFutureSnapshots((fut) => {
      if (fut.length === 0) return fut;
      const restored = fut[fut.length - 1];
      setOperations((curr) => {
        setPastSnapshots((past) => [...past.slice(-39), curr]);
        return restored;
      });
      return fut.slice(0, -1);
    });
  }, []);

  const handleClear = useCallback(() => {
    mutateOperationsWithHistory(() => []);
    setActiveMotifId(null);
    setSelectedLayerId(null);
    setSelectedGroupName(null);
  }, [mutateOperationsWithHistory]);

  const handleToggleLayerVisibility = useCallback(
    (id: string) => {
      setIsReplaying(false);
      mutateOperationsWithHistory((prev) => toggleOperationVisibility(prev, id));
    },
    [mutateOperationsWithHistory]
  );

  const handleShowAllLayers = useCallback(() => {
    setIsReplaying(false);
    mutateOperationsWithHistory((prev) => setAllOperationsVisibility(prev, true));
  }, [mutateOperationsWithHistory]);

  const handleMoveLayerOrder = useCallback(
    (id: string, direction: 'up' | 'down') => {
      setIsReplaying(false);
      mutateOperationsWithHistory((prev) => moveOperationOrder(prev, id, direction));
    },
    [mutateOperationsWithHistory]
  );

  const handleRecolorLayer = useCallback(
    (id: string, colorHex: string) => {
      setIsReplaying(false);
      mutateOperationsWithHistory((prev) => recolorOperation(prev, id, colorHex));
    },
    [mutateOperationsWithHistory]
  );

  const handleToggleLayerLock = useCallback(
    (id: string) => {
      setIsReplaying(false);
      mutateOperationsWithHistory((prev) => toggleOperationLock(prev, id));
    },
    [mutateOperationsWithHistory]
  );

  const handleChangeLayerOpacity = useCallback(
    (id: string, opacity: number) => {
      setIsReplaying(false);
      mutateOperationsWithHistory((prev) =>
        setOperationOpacity(prev, id, opacity)
      );
    },
    [mutateOperationsWithHistory]
  );

  const handleDeleteLayer = useCallback(
    (id: string) => {
      setIsReplaying(false);
      mutateOperationsWithHistory((prev) => deleteOperationById(prev, id));
      setSelectedLayerId((cur) => (cur === id ? null : cur));
    },
    [mutateOperationsWithHistory]
  );

  const handleToggleGroupVisibility = useCallback(
    (group: string) => {
      setIsReplaying(false);
      mutateOperationsWithHistory((prev) => toggleGroupVisibility(prev, group));
    },
    [mutateOperationsWithHistory]
  );

  const handleAssignLayerGroup = useCallback(
    (id: string, group: string) => {
      setIsReplaying(false);
      mutateOperationsWithHistory((prev) => assignOperationGroup(prev, id, group));
    },
    [mutateOperationsWithHistory]
  );

  const handleCommitBezierHandle = useCallback(
    (id: string, handle: BezierHandleKey, nextPoint: { x: number; y: number }) => {
      setIsReplaying(false);
      mutateOperationsWithHistory((prev) =>
        updateBezierControlPoint(prev, id, handle, nextPoint)
      );
    },
    [mutateOperationsWithHistory]
  );

  const handleCommitLayerTransform = useCallback(
    (nextOp: DrawOperation) => {
      setIsReplaying(false);
      mutateOperationsWithHistory((prev) =>
        replaceOperationInStack(prev, nextOp)
      );
    },
    [mutateOperationsWithHistory]
  );

  const handleMirrorSelectedLayer = useCallback(
    (axis: MirrorAxis) => {
      if (!selectedLayerId) return;
      const target = operations.find((op) => op.id === selectedLayerId);
      if (!target || target.locked) return;
      setIsReplaying(false);
      const origin = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };
      mutateOperationsWithHistory((prev) =>
        prev.map((op) =>
          op.id === selectedLayerId && !op.locked
            ? mirrorOperation(op, axis, origin)
            : op
        )
      );
      setExportNotice(
        axis === 'horizontal'
          ? 'Selected layer mirrored horizontally.'
          : 'Selected layer mirrored vertically.'
      );
    },
    [selectedLayerId, operations, mutateOperationsWithHistory]
  );

  const handleEditLayer = useCallback((id: string) => {
    setSelectedGroupName(null);
    setSelectedLayerId(id);
    setTool('edit');
  }, []);

  const selectedGroupLayerIds = useMemo(
    () =>
      selectedGroupName
        ? getOperationIdsInGroup(operations, selectedGroupName)
        : [],
    [selectedGroupName, operations]
  );

  const activeSelectedGroupName =
    selectedGroupName && selectedGroupLayerIds.length > 0
      ? selectedGroupName
      : null;

  const handleSelectGroup = useCallback(
    (groupName: string | null) => {
      setSelectedGroupName(groupName);
      if (groupName) {
        setSelectedLayerId(null);
        const count = getOperationIdsInGroup(operations, groupName).length;
        setExportNotice(
          `Selected group "${groupName}" (${count} ${count === 1 ? 'layer' : 'layers'} highlighted).`
        );
        setTimeout(() => setExportNotice(null), 2600);
      }
    },
    [operations]
  );

  const handleChangeView = useCallback((nextView: StudioView) => {
    setActiveView((cur) => {
      if (cur !== nextView) {
        setPreviousView(cur);
      }
      return nextView;
    });
  }, []);

  const viewContinuity = useMemo(
    () => getCanvasContinuityTransition(previousView, activeView),
    [previousView, activeView]
  );

  const handleToggleLabMode = useCallback(() => {
    setLabMode((prev) => {
      const next = !prev;
      if (!next) {
        setActiveView((cur) => {
          if (cur === 'algorithms' || cur === 'cpp') {
            setPreviousView(cur);
            return 'studio';
          }
          return cur;
        });
      }
      return next;
    });
  }, []);

  const handleSaveToGallery = useCallback(
    async (name: string) => {
      let thumbnailDataUrl = '';
      const srcCanvas = canvasRef.current;
      if (srcCanvas) {
        const thumb = document.createElement('canvas');
        thumb.width = 240;
        thumb.height = 240;
        const ctx = thumb.getContext('2d');
        if (ctx) {
          ctx.drawImage(srcCanvas, 0, 0, 240, 240);
          thumbnailDataUrl = thumb.toDataURL('image/png');
        }
      }
      await saveGalleryProject(galleryBackend, {
        name,
        thumbnailDataUrl,
        payload: {
          version: 1,
          savedAt: Date.now(),
          surfaceId,
          symmetry,
          lineAlgorithm,
          clippingWindow,
          transform2D,
          operations,
        },
      });
      const updated = await listGalleryProjects(galleryBackend);
      setGalleryProjects(updated);
      setExportNotice(`Saved "${name}" to local Projects Gallery.`);
      setTimeout(() => setExportNotice(null), 2600);
    },
    [
      galleryBackend,
      surfaceId,
      symmetry,
      lineAlgorithm,
      clippingWindow,
      transform2D,
      operations,
    ]
  );

  const handleLoadFromGallery = useCallback((project: SavedAlponaProject) => {
    const p = project.payload;
    hasUserMutatedRef.current = true;
    setIsReplaying(false);
    setSurfaceId(p.surfaceId);
    setSymmetry({ ...p.symmetry });
    setLineAlgorithm(p.lineAlgorithm);
    setClippingWindow({ ...p.clippingWindow });
    setTransform2D({ ...p.transform2D });
    setOperations(p.operations);
    setPastSnapshots([]);
    setFutureSnapshots([]);
    setSelectedLayerId(null);
    setSelectedGroupName(null);
    setActiveMotifId(null);
    setGalleryOpen(false);
    setExportNotice(
      `Opened "${project.name}" (${p.operations.length} strokes).`
    );
    setTimeout(() => setExportNotice(null), 2600);
  }, []);

  const handleRenameGalleryProject = useCallback(
    async (id: string, nextName: string) => {
      await renameGalleryProject(galleryBackend, id, nextName);
      const updated = await listGalleryProjects(galleryBackend);
      setGalleryProjects(updated);
    },
    [galleryBackend]
  );

  const handleDeleteGalleryProject = useCallback(
    async (id: string) => {
      await deleteGalleryProject(galleryBackend, id);
      const updated = await listGalleryProjects(galleryBackend);
      setGalleryProjects(updated);
    },
    [galleryBackend]
  );

  const handleResetDefaultDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      clearDraftFromStorage(window.localStorage);
    }
    hasUserMutatedRef.current = false;
    setRestoredDraftInfo(null);
    setActiveMotifId(INITIAL_MOTIF.id);
    setSymmetry({ ...INITIAL_MOTIF.defaultSymmetry });
    setSurfaceId(INITIAL_MOTIF.defaultSurface);
    setColor('#FAF8F2');
    setLineAlgorithm('bresenham');
    setClippingWindow({
      enabled: false,
      inset: 110,
      algorithm: 'cohen-sutherland',
      polygonAlgorithm: 'weiler-atherton',
    });
    setTransform2D({ ...DEFAULT_TRANSFORM_2D });
    setOperations(INITIAL_MOTIF.buildOperations(CANVAS_SIZE));
    setPastSnapshots([]);
    setFutureSnapshots([]);
    setSelectedLayerId(null);
    setSelectedGroupName(null);
  }, []);

  const handleSyncAllStrokes = useCallback(() => {
    mutateOperationsWithHistory((prev) =>
      prev.map((op) => {
        if (op.symmetry.sectors === 1 && !op.symmetry.reflect) {
          return op;
        }
        return {
          ...op,
          symmetry: { ...symmetry },
        };
      })
    );
  }, [mutateOperationsWithHistory, symmetry]);

  const handleSelectMotif = useCallback((motifId: string) => {
    const motif = ALPONA_MOTIFS.find((m) => m.id === motifId);
    if (!motif) return;
    hasUserMutatedRef.current = true;
    setActiveMotifId(motif.id);
    setSymmetry({ ...motif.defaultSymmetry });
    setSurfaceId(motif.defaultSurface);
    setColor(motif.defaultSurface === 'paper' ? '#B91C1C' : '#FAF8F2');
    setOperations(motif.buildOperations(CANVAS_SIZE));
    setPastSnapshots([]);
    setFutureSnapshots([]);
    setSelectedLayerId(null);
    setSelectedGroupName(null);
  }, []);

  const handleApplyQuickStartTemplate = useCallback(
    (template: StudioQuickStartTemplate) => {
      setIsReplaying(false);
      hasUserMutatedRef.current = true;
      setSurfaceId(template.surfaceId);
      setSymmetry({ ...template.symmetry });
      setColor(template.defaultColor);
      setSelectedLayerId(null);
      setSelectedGroupName(null);
      setPastSnapshots([]);
      setFutureSnapshots([]);

      if (template.motifId) {
        const motif = ALPONA_MOTIFS.find((m) => m.id === template.motifId);
        if (motif) {
          setActiveMotifId(motif.id);
          setOperations(motif.buildOperations(CANVAS_SIZE));
        }
      } else {
        setActiveMotifId('blank-canvas');
        setOperations([]);
      }
      setExportNotice(`Loaded "${template.title}" workspace template.`);
      setTimeout(() => setExportNotice(null), 2400);
    },
    []
  );

  const handleApplyColorway = useCallback(
    (palette: string[], nextSurfaceId: CanvasSurfaceId, label: string) => {
      if (palette.length === 0) return;
      setIsReplaying(false);
      setSurfaceId(nextSurfaceId);
      setColor(palette[0]);
      mutateOperationsWithHistory((prev) => remapOperationsColorway(prev, palette));
      setExportNotice(`Applied ${label} colorway (${palette.slice(0, 3).join(', ')}).`);
      setTimeout(() => setExportNotice(null), 2600);
    },
    [mutateOperationsWithHistory]
  );

  const handleExtractPhotoColorway = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const dim = 160;
          const off = document.createElement('canvas');
          off.width = dim;
          off.height = dim;
          const ctx = off.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, dim, dim);
          const pixels = ctx.getImageData(0, 0, dim, dim).data;
          const palette = extractKMeansPalette(
            { width: dim, height: dim, data: new Uint8ClampedArray(pixels) },
            5
          );
          const bestSurface = pickContrastingSurfaceForPalette(palette);
          setExtractedPalette(palette);
          handleApplyColorway(palette, bestSurface, `K-Means Photo (${file.name})`);
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    },
    [handleApplyColorway]
  );

  const displayedOperations = useMemo(
    () => (isReplaying ? operations.slice(0, replayCount) : operations),
    [isReplaying, operations, replayCount]
  );

  // Animated stroke-by-stroke timelapse replay timer
  useEffect(() => {
    if (!isReplaying) return;
    const timer = window.setInterval(() => {
      setReplayCount((prev) => {
        if (prev >= operations.length) {
          setIsReplaying(false);
          return operations.length;
        }
        return prev + 1;
      });
    }, 280);
    return () => window.clearInterval(timer);
  }, [isReplaying, operations.length]);

  const handleToggleReplay = useCallback(() => {
    if (operations.length === 0) return;
    if (isReplaying) {
      setIsReplaying(false);
      return;
    }
    setReplayCount(1);
    setIsReplaying(true);
  }, [isReplaying, operations.length]);

  const handleSaveProject = useCallback(() => {
    const json = serializeAlponaProject({
      surfaceId,
      symmetry,
      lineAlgorithm,
      clippingWindow,
      transform2D,
      operations,
    });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'alpona-studio-project.alpona.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportNotice('Saved project to alpona-studio-project.alpona.json.');
    setTimeout(() => setExportNotice(null), 2600);
  }, [surfaceId, symmetry, lineAlgorithm, clippingWindow, transform2D, operations]);

  const handleLoadProjectFile = useCallback((file: File) => {
    setProjectError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseAlponaProject(String(reader.result));
        setIsReplaying(false);
        setSurfaceId(parsed.surfaceId);
        setSymmetry(parsed.symmetry);
        setLineAlgorithm(parsed.lineAlgorithm);
        setClippingWindow(parsed.clippingWindow);
        setTransform2D(parsed.transform2D);
        setOperations(parsed.operations);
        setPastSnapshots([]);
        setFutureSnapshots([]);
        setActiveMotifId(null);
        setExportNotice(`Loaded ${parsed.operations.length} strokes from ${file.name}.`);
        setTimeout(() => setExportNotice(null), 2600);
      } catch (err) {
        setProjectError(
          err instanceof Error ? err.message : 'Unable to parse .alpona.json file.'
        );
      }
    };
    reader.onerror = () => {
      setProjectError('Could not read the selected project file.');
    };
    reader.readAsText(file);
  }, []);

  const handleExportStencil = useCallback(() => {
    const hiResStencil = renderUltraHdAlponaCanvas(
      operations,
      surface,
      CANVAS_SIZE,
      renderOptions,
      PRINT_STENCIL_EXPORT_SIZE,
      true
    );
    exportPrintableStencilPng(hiResStencil, 46, true);
    setExportNotice(
      `Exported crisp 300 DPI Printable Stencil PNG (${PRINT_STENCIL_EXPORT_SIZE} × ${PRINT_STENCIL_EXPORT_SIZE} px).`
    );
    setTimeout(() => setExportNotice(null), 2800);
  }, [operations, surface, renderOptions]);

  const handleExportSvg = useCallback(() => {
    const svg = generateAlponaSvg(operations, surface, CANVAS_SIZE, renderOptions);
    downloadAlponaSvg(svg, 'alpona-studio-vector.svg');
    setExportNotice(
      'Exported infinite-resolution Vector SVG (ready for print, Cricut & laser cutting).'
    );
    setTimeout(() => setExportNotice(null), 2800);
  }, [operations, surface, renderOptions]);

  const handleExportReel = useCallback(async () => {
    if (operations.length === 0 || reelProgress !== null) return;
    setIsReplaying(false);
    setReelProgress(1);
    setExportNotice('Recording 1080×1080 HD Timelapse Reel (.webm)...');
    try {
      const result = await exportAlponaTimelapseReel(
        operations,
        surface,
        CANVAS_SIZE,
        renderOptions,
        {
          size: 1080,
          fps: 30,
          durationSec: 4.5,
          titleText: greetingCard.enabled
            ? `${greetingCard.headline} · Alpona Studio`
            : 'Alpona Studio · 2D/3D Vector & Raster Suite',
          onProgress: (pct) => setReelProgress(pct),
        }
      );
      setExportNotice(
        `Exported ${result.width}×${result.height} HD Timelapse Reel (${result.filename}).`
      );
    } catch (err) {
      setExportNotice(
        err instanceof Error
          ? err.message
          : 'Unable to record HD Timelapse Reel in this browser.'
      );
    } finally {
      setReelProgress(null);
      setTimeout(() => setExportNotice(null), 3200);
    }
  }, [operations, reelProgress, surface, renderOptions, greetingCard]);

  const handleStampBezierMotif = useCallback(
    (stampId: string) => {
      const stamp = BENGALI_BEZIER_STAMPS.find((s) => s.id === stampId);
      if (!stamp) return;
      setIsReplaying(false);
      const ops = stamp
        .build(
          CANVAS_SIZE,
          bezierRingFactor,
          color,
          thickness,
          symmetry,
          showDeCasteljau
        )
        .map((op) => ({ ...op, group: 'Motifs' }));
      mutateOperationsWithHistory((prev) => [...prev, ...ops]);
      const lastBez = [...ops].reverse().find((o) => o.kind === 'bezier');
      if (lastBez) {
        setSelectedLayerId(lastBez.id);
      }
      setExportNotice(
        `Stamped ${stamp.name} (${stamp.bengali}) across ${symmetry.sectors} sectors.`
      );
      setTimeout(() => setExportNotice(null), 2400);
    },
    [
      bezierRingFactor,
      color,
      thickness,
      symmetry,
      showDeCasteljau,
      mutateOperationsWithHistory,
    ]
  );

  const handleComposeProcedural = useCallback(
    (opts: {
      seed: number;
      includePhyllotaxis: boolean;
      includeRhodonea: boolean;
      includeLSystemVine: boolean;
      append: boolean;
    }) => {
      setIsReplaying(false);
      const accentHex =
        color.toLowerCase() === '#dc2626' ? '#F59E0B' : '#DC2626';
      const composed = composeProceduralAlpona(CANVAS_SIZE, {
        seed: opts.seed,
        sectors: symmetry.sectors,
        includePhyllotaxis: opts.includePhyllotaxis,
        includeRhodonea: opts.includeRhodonea,
        includeLSystemVine: opts.includeLSystemVine,
        primaryColor: color,
        accentColor: accentHex,
        thickness,
      });
      setSymmetry(composed.symmetry);
      mutateOperationsWithHistory((prev) =>
        opts.append ? [...prev, ...composed.operations] : composed.operations
      );
      setActiveMotifId(null);
      setExportNotice(
        `Composed procedural Alpona (seed #${opts.seed}, ${composed.operations.length} strokes, ${composed.phyllotaxisDots} phyllotaxis seeds).`
      );
      setTimeout(() => setExportNotice(null), 3000);
    },
    [color, symmetry.sectors, thickness, mutateOperationsWithHistory]
  );

  const handleComposeKolam = useCallback(
    (opts: {
      rows: number;
      cols: number;
      symmetry: KolamSymmetry;
      mirrorDensity: number;
      seed: number;
      requireSingleLoop: boolean;
      showDots: boolean;
      colorEachLoop: boolean;
      append: boolean;
    }) => {
      setIsReplaying(false);
      const accentHex =
        color.toLowerCase() === '#f59e0b' ? '#DC2626' : '#F59E0B';
      // Colour each loop differently (skipping pigments that vanish on the current floor).
      const hiddenOnSurface = surface.isDark ? '#18181b' : '#faf8f2';
      const loopColors = opts.colorEachLoop
        ? [
            color,
            ...ALPONA_PALETTE.map((swatch) => swatch.hex).filter(
              (hex) =>
                hex.toLowerCase() !== color.toLowerCase() &&
                hex.toLowerCase() !== hiddenOnSurface
            ),
          ]
        : [color];
      const composed = composeKolam(CANVAS_SIZE, {
        rows: opts.rows,
        cols: opts.cols,
        mirrorDensity: opts.mirrorDensity,
        seed: opts.seed,
        symmetry: opts.symmetry,
        requireSingleLoop: opts.requireSingleLoop,
        loopColors,
        dotColor: accentHex,
        thickness,
        showDots: opts.showDots,
        smoothingIterations: 2,
      });
      mutateOperationsWithHistory((prev) =>
        opts.append ? [...prev, ...composed.operations] : composed.operations
      );
      setActiveMotifId(null);
      const loopText = composed.isSingleLoop
        ? 'one continuous stroke'
        : `${composed.loopCount} loops`;
      setExportNotice(
        `Drew ${composed.rows}×${composed.cols} kolam: ${loopText}, ${composed.innerMirrorCount} mirrors (seed #${composed.seedUsed}).`
      );
      setTimeout(() => setExportNotice(null), 3200);
      return composed;
    },
    [color, surface.isDark, thickness, mutateOperationsWithHistory]
  );

  const handleExportPng = useCallback(() => {
    const hiResCanvas = renderUltraHdAlponaCanvas(
      operations,
      surface,
      CANVAS_SIZE,
      renderOptions,
      ULTRA_HD_EXPORT_SIZE,
      false
    );
    const result = exportAlponaPng(hiResCanvas, surface, greetingCard);
    setExportNotice(
      greetingCard.enabled
        ? `Exported 300 DPI Greeting Card PNG (${result.width} × ${result.height} px, anti-aliased).`
        : `Exported 4K Ultra-HD PNG (${result.width} × ${result.height} px, anti-aliased).`
    );
    setTimeout(() => setExportNotice(null), 3200);
  }, [operations, surface, renderOptions, greetingCard]);

  // Keyboard shortcuts matching the C++ FreeGLUT application
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      const key = e.key.toLowerCase();
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setHelpOpen(false);
      } else if (key === 'f') setTool('freehand');
      else if (key === 'l') setTool('line');
      else if (key === 'o') setTool('circle');
      else if (key === 'p') setTool('polygon');
      else if (key === 'c') setTool('bezier');
      else if (key === 'v') setTool('edit');
      else if (key === 'b') setTool('fill');
      else if (key === 'e') setTool('eraser');
      else if (key === 'a') setTool('group-select');
      else if (key === 'r') setSymmetry((s) => ({ ...s, reflect: !s.reflect }));
      else if (key === 'g') setShowGuides((g) => !g);
      else if (key === 'x') setShowSymmetryAxes((v) => !v);
      else if (key === 's')
        setSnapConfig((c) => ({ ...c, snapToAxis: !c.snapToAxis }));
      else if (key === '4') setSymmetry((s) => ({ ...s, sectors: 4 }));
      else if (key === '6') setSymmetry((s) => ({ ...s, sectors: 6 }));
      else if (key === '8') setSymmetry((s) => ({ ...s, sectors: 8 }));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  return (
    <div className="studio-grid-bg flex min-h-screen flex-col text-zinc-900">
      <StudioSplashOverlay />
      <HeaderBar
        activeView={activeView}
        labMode={labMode}
        docsOpen={docsOpen}
        savedProjectsCount={galleryProjects.length}
        onChangeView={handleChangeView}
        onToggleLabMode={handleToggleLabMode}
        onToggleDocs={() => setDocsOpen((prev) => !prev)}
        onOpenGallery={() => setGalleryOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onExportPng={handleExportPng}
      />

      {exportNotice && (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-zinc-200 bg-white/95 px-4 py-2 text-center text-xs font-medium text-zinc-800"
        >
          {exportNotice}
        </div>
      )}

      <main className="flex-1">
        <motion.div
          key={activeView}
          data-testid="view-continuity-stage"
          data-active-view={activeView}
          data-from-view={viewContinuity.fromView}
          data-transition-dir={viewContinuity.direction}
          data-continuity-label={viewContinuity.continuityLabel}
          className="canvas-continuity-stage"
          initial={{
            opacity: 0.72,
            x: viewContinuity.offsetX,
            y: viewContinuity.offsetY,
            scale: viewContinuity.initialScale,
            rotateX: viewContinuity.initialRotateXDeg,
          }}
          animate={{
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            rotateX: 0,
          }}
          transition={{
            duration: viewContinuity.durationSec,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
        {activeView === 'studio' && (
          <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8">
            {restoredDraftInfo && (
              <div className="mb-4">
                <DraftRecoveryBanner
                  savedAt={restoredDraftInfo.savedAt}
                  strokesCount={restoredDraftInfo.strokesCount}
                  onResetDefault={handleResetDefaultDraft}
                  onDismiss={() => setRestoredDraftInfo(null)}
                />
              </div>
            )}

            {/* Quick-Start Studio Templates Bar for First-Time / Consumer Users */}
            <section
              aria-label="Quick-Start Studio Templates"
              data-testid="studio-quick-start-bar"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200/90 bg-white px-3.5 py-2.5 shadow-2xs"
            >
              <div className="flex items-center gap-2 text-xs text-zinc-600">
                <span className="font-semibold text-zinc-900">
                  Quick-Start Canvas
                </span>
                <span aria-hidden="true">·</span>
                <span className="hidden sm:inline">
                  Pick a curated folk art template or start from a blank stage
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {STUDIO_QUICK_START_TEMPLATES.map((tpl) => {
                  const isCurrent =
                    (tpl.motifId !== null && activeMotifId === tpl.motifId) ||
                    (tpl.motifId === null &&
                      (activeMotifId === 'blank-canvas' ||
                        operations.length === 0));
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      data-testid={`quick-start-${tpl.id}`}
                      aria-pressed={isCurrent}
                      title={tpl.subtitle}
                      onClick={() => handleApplyQuickStartTemplate(tpl)}
                      className={`inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        isCurrent
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-300 bg-[#FAF9F5] text-zinc-700 hover:border-zinc-400 hover:bg-white hover:text-zinc-950'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-xs border border-black/15"
                        style={{ backgroundColor: tpl.accentHex }}
                      />
                      <span>{tpl.title}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_356px]">
              {/* Primary Interactive Raster Stage */}
              <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
                <AlponaCanvas
                  canvasRef={canvasRef}
                  surface={surface}
                  tool={tool}
                  polygonShape={polygonShape}
                  bezierCurvature={bezierCurvature}
                  showDeCasteljau={showDeCasteljau}
                  color={color}
                  thickness={thickness}
                  stabilizerLevel={stabilizerLevel}
                  taperedBrush={taperedBrush}
                  symmetry={symmetry}
                  symmetricFill={symmetricFill}
                  showGuides={showGuides}
                  showSymmetryAxes={showSymmetryAxes}
                  snapConfig={snapConfig}
                  referenceUnderlay={referenceUnderlay}
                  lineAlgorithm={lineAlgorithm}
                  clippingWindow={clippingWindow}
                  transform2D={transform2D}
                  operations={displayedOperations}
                  totalOperationsCount={operations.length}
                  isReplaying={isReplaying}
                  canUndo={pastSnapshots.length > 0 || operations.length > 0}
                  canRedo={futureSnapshots.length > 0}
                  greetingCard={greetingCard}
                  projectError={projectError}
                  selectedLayerId={selectedLayerId}
                  selectedGroupName={activeSelectedGroupName}
                  selectedGroupLayerIds={selectedGroupLayerIds}
                  hdPreview={hdPreview}
                  onToggleHdPreview={() => setHdPreview((v) => !v)}
                  onSelectLayer={(id) => {
                    setSelectedGroupName(null);
                    setSelectedLayerId(id);
                  }}
                  onSelectGroup={handleSelectGroup}
                  onCommitBezierHandle={handleCommitBezierHandle}
                  onCommitLayerTransform={handleCommitLayerTransform}
                  onCommitOperation={(op) => {
                    setIsReplaying(false);
                    handleCommitOperation(op);
                  }}
                  onDeleteOperation={handleDeleteLayer}
                  onUndo={() => {
                    setIsReplaying(false);
                    handleUndo();
                  }}
                  onRedo={() => {
                    setIsReplaying(false);
                    handleRedo();
                  }}
                  onClear={() => {
                    setIsReplaying(false);
                    handleClear();
                  }}
                  onToggleGuides={() => setShowGuides((g) => !g)}
                  onToggleSymmetryAxes={() => setShowSymmetryAxes((v) => !v)}
                  onChangeSnapConfig={setSnapConfig}
                  onToggleReplay={handleToggleReplay}
                  onSaveProject={handleSaveProject}
                  onLoadProjectFile={handleLoadProjectFile}
                  onExportStencil={handleExportStencil}
                  onExportSvg={handleExportSvg}
                  onExportReel={handleExportReel}
                  reelProgress={reelProgress}
                  onChangeGreetingCard={setGreetingCard}
                  onMetricsUpdate={setMetrics}
                />

                {/* Concise Contextual Craft Note beneath Stage */}
                <div className="mx-auto max-w-[680px] border-t border-zinc-200/80 pt-4 text-xs leading-relaxed text-zinc-600">
                  Paint freehand rice-paste curves, geometric spokes, concentric
                  rings, star petals, or Kalka/Shankha flourishes across{' '}
                  <span className="font-mono font-medium text-zinc-900">
                    {symmetry.reflect
                      ? `${symmetry.sectors * 2} mirrored`
                      : `${symmetry.sectors} rotational`}
                  </span>{' '}
                  sectors. Switch to{' '}
                  <strong className="font-medium text-zinc-800">
                    Floor &amp; Print
                  </strong>{' '}
                  for 4-corner courtyard photo try-on, 3D Pitha mold stamps, and
                  printable A4 chalk stencils.
                </div>
              </div>

              {/* Control Deck */}
              <ControlDeck
                tool={tool}
                onChangeTool={setTool}
                polygonShape={polygonShape}
                onChangePolygonShape={setPolygonShape}
                bezierCurvature={bezierCurvature}
                onChangeBezierCurvature={setBezierCurvature}
                bezierRingFactor={bezierRingFactor}
                onChangeBezierRingFactor={setBezierRingFactor}
                showDeCasteljau={showDeCasteljau}
                onChangeShowDeCasteljau={setShowDeCasteljau}
                onStampBezierMotif={handleStampBezierMotif}
                selectedLayerId={selectedLayerId}
                selectedGroupName={activeSelectedGroupName}
                selectedGroupLayerIds={selectedGroupLayerIds}
                onClearGroupSelection={() => setSelectedGroupName(null)}
                hasBezierOps={operations.some(
                  (op) => !op.hidden && op.kind === 'bezier'
                )}
                labMode={labMode}
                symmetry={symmetry}
                onChangeSymmetry={setSymmetry}
                showSymmetryAxes={showSymmetryAxes}
                onChangeShowSymmetryAxes={setShowSymmetryAxes}
                onSyncAllStrokes={handleSyncAllStrokes}
                hasStrokes={operations.length > 0}
                symmetricFill={symmetricFill}
                onChangeSymmetricFill={setSymmetricFill}
                color={color}
                onChangeColor={setColor}
                thickness={thickness}
                onChangeThickness={setThickness}
                surfaceId={surfaceId}
                onChangeSurface={setSurfaceId}
                lineAlgorithm={lineAlgorithm}
                onChangeLineAlgorithm={setLineAlgorithm}
                clippingWindow={clippingWindow}
                onChangeClippingWindow={setClippingWindow}
                transform2D={transform2D}
                onChangeTransform2D={setTransform2D}
                activeMotifId={activeMotifId}
                onSelectMotif={(id) => {
                  setIsReplaying(false);
                  handleSelectMotif(id);
                }}
                stabilizerLevel={stabilizerLevel}
                onChangeStabilizerLevel={setStabilizerLevel}
                taperedBrush={taperedBrush}
                onChangeTaperedBrush={setTaperedBrush}
                extractedPalette={extractedPalette}
                onApplyColorway={handleApplyColorway}
                onExtractPhotoColorway={handleExtractPhotoColorway}
                onComposeProcedural={handleComposeProcedural}
                onComposeKolam={handleComposeKolam}
                operations={operations}
                onToggleLayerVisibility={handleToggleLayerVisibility}
                onToggleLayerLock={handleToggleLayerLock}
                onChangeLayerOpacity={handleChangeLayerOpacity}
                onToggleGroupVisibility={handleToggleGroupVisibility}
                onAssignLayerGroup={handleAssignLayerGroup}
                onEditLayer={handleEditLayer}
                onShowAllLayers={handleShowAllLayers}
                onMoveLayerOrder={handleMoveLayerOrder}
                onRecolorLayer={handleRecolorLayer}
                onDeleteLayer={handleDeleteLayer}
                onMirrorSelectedLayer={handleMirrorSelectedLayer}
                referenceUnderlay={referenceUnderlay}
                onChangeReferenceUnderlay={setReferenceUnderlay}
              />
            </div>
          </div>
        )}

        {activeView === 'image-lab' && (
          <ImageLabView
            operations={operations}
            surface={surface}
            renderOptions={renderOptions}
            onReturnToStudio={() => handleChangeView('studio')}
          />
        )}

        {activeView === '3d-view' && (
          <Projection3DView
            defaultSectors={symmetry.sectors}
            operations={operations}
            surface={surface}
            renderOptions={renderOptions}
            onReturnToStudio={() => handleChangeView('studio')}
          />
        )}

        {activeView === 'floor-print' && (
          <FloorPrintView
            operations={operations}
            surface={surface}
            renderOptions={renderOptions}
            sectors={symmetry.sectors}
            onReturnToStudio={() => handleChangeView('studio')}
          />
        )}

        {activeView === 'algorithms' && (
          <AlgorithmsView
            symmetry={symmetry}
            metrics={metrics}
            lineAlgorithm={lineAlgorithm}
            clippingWindow={clippingWindow}
            transform2D={transform2D}
            onReturnToStudio={() => handleChangeView('studio')}
          />
        )}

        {activeView === 'cpp' && (
          <CppSourceView onReturnToStudio={() => handleChangeView('studio')} />
        )}
        </motion.div>
      </main>

      <footer className="mt-10 border-t border-zinc-200/90 bg-[#F6F5F1] py-5">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 px-4 text-xs text-zinc-500 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-zinc-800">
              Alpona Studio
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Commercial 2D/3D Vector, Multi-Layer Compositing &amp; Spatial
              Projection Suite
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Enterprise Graphics Core</span>
            <span aria-hidden="true">·</span>
            <span>4K Ultra-HD PNG, Vector SVG &amp; 3D Binary STL</span>
            {labMode && (
              <>
                <span aria-hidden="true">·</span>
                <span>C++11 OpenGL Desktop &amp; CLI Engine</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <div
              data-testid="footer-version-sync-group"
              className="inline-flex items-center gap-2"
            >
              <span
                data-testid="footer-build-version"
                className="font-mono text-[11px] text-zinc-400"
              >
                v1.4.2
              </span>
              {draftSyncIndicator.visible && (
                <span
                  key={draftSyncIndicator.lastSyncedAt}
                  role="status"
                  aria-live="polite"
                  data-testid="footer-draft-sync-indicator"
                  data-sync-pulsing={
                    draftSyncIndicator.isPulsing ? 'true' : 'false'
                  }
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-600"
                >
                  <span aria-hidden="true" className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                  </span>
                  <span>{draftSyncIndicator.label}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </footer>
      <ProjectGalleryModal
        open={galleryOpen}
        projects={galleryProjects}
        currentStrokesCount={operations.length}
        onClose={() => setGalleryOpen(false)}
        onSaveCurrent={handleSaveToGallery}
        onLoadProject={handleLoadFromGallery}
        onRenameProject={handleRenameGalleryProject}
        onDeleteProject={handleDeleteGalleryProject}
      />
      <ShortcutsHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
      <DocumentationSidebar
        open={docsOpen}
        activeTab={docsTab}
        onChangeTab={setDocsTab}
        onClose={() => setDocsOpen(false)}
      />
    </div>
  );
}
