import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMat3,
  buildHomogeneousTransform2D,
  cohenSutherlandClip,
  computeOutcode,
  computeSymmetryReflectionAxes,
  generateSymmetricPoints,
  generateSymmetricSegments,
  isIdentityTransform2D,
  liangBarskyClip,
  mat3Inverse,
  mat3Multiply,
  mat3Reflect,
  OUTCODE_INSIDE,
  OUTCODE_LEFT,
  OUTCODE_RIGHT,
  reflectPointHorizontal,
  rotatePoint,
  sutherlandHodgmanClip,
  weilerAthertonClip,
} from './transforms';
import {
  buildConcaveStarPetalPolygon,
  buildDiamondPetalPolygon,
  drawBresenhamCircle,
  drawBresenhamLine,
  drawDdaLine,
  traceBresenhamLineSteps,
  traceDdaLineSteps,
  traceMidpointCircleSteps,
  type PixelSurface,
} from './rasterizer';
import { iterativeSeedFill } from './floodfill';
import { clearSurface, renderScene } from './engine';
import { ALPONA_MOTIFS } from './motifs';
import { analyzeHexColor, rgbToCmyk, rgbToHsv } from './colorModels';
import {
  applyFrequencyDomainFilter,
  applyMorphology,
  applyPointOperation,
  applySpatialFilter,
  computeLuminanceHistogram,
  computePixelRelationships,
  downsample2xSSAA,
  extractPrintableStencil,
  fft1d,
} from './imageProcessing';
import { scaleOperations, scaleRenderOptions } from './highResExport';
import {
  buildFriezeBorderStudio,
  mapFriezeCoordinates,
} from './friezeBorder';
import { analyzeAndBridgeStencil } from './stencilBridger';
import {
  extractKMeansPalette,
  FESTIVAL_COLORWAYS,
  remapOperationsColorway,
} from './colorwayRemap';
import {
  computePolylineArcParameters,
  computePressureTaperThickness,
  computeRicePasteTaperThickness,
  resamplePressuresForStabilized,
  stabilizeStrokePoints,
} from './strokeCraft';
import {
  buildStampHeightfield,
  DEFAULT_STL_STAMP_OPTIONS,
  generateStampMesh,
  renderStampTurntablePreview,
  serializeAsciiObj,
  serializeBinaryStl,
} from './stlStampExporter';
import {
  buildWeaveChart,
  exportWeaveChartCsv,
} from './weaveChart';
import {
  composeProceduralAlpona,
  expandLSystem,
} from './generativeComposer';
import {
  DEFAULT_NATURAL_MEDIA_OPTIONS,
  fbm2D,
  renderNaturalMediaAlpona,
} from './naturalMedia';
import {
  DEFAULT_PHONG_PARAMS,
  DIYA_LIGHT_PRESETS,
  renderPhongDiyaLitAlpona,
} from './phongLighting';
import {
  detectRotationalSymmetryOrder,
  generateAngledStreetAlponaPhoto,
  restoreAlponaFromPhoto,
} from './photoUnwarper';
import { partitionTracingStages } from './projectorTrace';
import { computeReelOpProgress } from './videoReelExport';
import {
  BENGALI_BEZIER_STAMPS,
  deCasteljauSubdivision,
  evaluateCubicBezier,
  sampleCubicBezier,
} from './bezier';
import { generateAlponaSvg } from './svgExport';
import {
  applyHomography,
  generateCourtyardFloorPhoto,
  renderVirtualFloorTryOn,
  solveHomographyFromUnitSquare,
} from './homography';
import { computeFloorBlueprint } from './floorBlueprint';
import { CANVAS_SURFACES } from './types';
import {
  buildAlponaMonumentMesh,
  projectPoint3D,
  render3DCourtyardFloor,
  render3DScene,
  type Transform3DParams,
} from './projection3d';
import { parseAlponaProject, serializeAlponaProject } from './projectFile';
import { DEFAULT_TRANSFORM_2D, hexToRgba, type ClipBounds, type DrawOperation } from './types';
import { DEFAULT_SNAP_CONFIG, snapPointToSymmetryGuides } from './canvasAssist';
import {
  areAllGroupsCollapsed,
  assignOperationGroup,
  buildSampleReferenceSketchDataUrl,
  deleteOperationById,
  describeOperation,
  duplicateOperationById,
  findNearestBezierOp,
  getLayerGroupAccent,
  getOperationIdsInGroup,
  groupOperationsByCategory,
  hitTestOperationAtPoint,
  listOperationGroups,
  moveOperationOrder,
  recolorOperation,
  selectGroupAtPoint,
  setAllGroupsCollapsed,
  setAllOperationsVisibility,
  setOperationOpacity,
  toggleGroupCollapsed,
  toggleGroupVisibility,
  toggleOperationLock,
  toggleOperationVisibility,
  updateBezierControlPoint,
} from './layerStack';
import {
  computeOperationBounds,
  mirrorOperation,
  replaceOperationInStack,
  rotateOperationAroundPoint,
  scaleOperationAroundPoint,
  translateOperation,
} from './layerTransform';
import {
  computePinchGesture,
  isTwoFingerQuickTap,
} from './touchGestures';
import {
  createMemoryGalleryBackend,
  deleteGalleryProject,
  listGalleryProjects,
  renameGalleryProject,
  saveGalleryProject,
} from './projectGallery';
import {
  createCommittedFrameCache,
  renderWithFrameCache,
} from './frameCache';
import {
  clearDraftFromStorage,
  loadDraftFromStorage,
  saveDraftToStorage,
  type AlponaDraftPayload,
  type StorageAdapter,
} from './draftStorage';
import {
  canvasToStageNormalized,
  clampCanvasViewport,
  DEFAULT_CANVAS_VIEWPORT,
  panCanvasViewportByScreenDelta,
  screenToCanvasWithViewport,
  zoomCanvasViewportAtPoint,
} from './viewportCamera';

function createSurface(width: number, height: number): PixelSurface {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  };
}

function getPixel(surface: PixelSurface, x: number, y: number): [number, number, number, number] {
  const i = (y * surface.width + x) * 4;
  return [
    surface.data[i],
    surface.data[i + 1],
    surface.data[i + 2],
    surface.data[i + 3],
  ];
}

test('CLO-1: Bresenham and DDA line algorithms rasterize exact endpoints across octants', () => {
  const s = createSurface(50, 50);
  const white = hexToRgba('#FFFFFF');

  const hCount = drawBresenhamLine(s, 5, 10, 15, 10, white, 1);
  assert.equal(hCount, 11);
  assert.deepEqual(getPixel(s, 5, 10), [255, 255, 255, 255]);
  assert.deepEqual(getPixel(s, 15, 10), [255, 255, 255, 255]);

  const ddaCount = drawDdaLine(s, 5, 20, 15, 30, white, 1);
  assert.equal(ddaCount, 11);
  assert.deepEqual(getPixel(s, 10, 25), [255, 255, 255, 255]);
});

test('CLO-1: RGB to HSV and CMYK color model conversions match analytical values', () => {
  const red = analyzeHexColor('#FF0000');
  assert.deepEqual(red.hsv, { h: 0, s: 100, v: 100 });
  assert.deepEqual(red.cmyk, { c: 0, m: 100, y: 100, k: 0 });

  assert.deepEqual(rgbToHsv(0, 255, 0), { h: 120, s: 100, v: 100 });
  assert.deepEqual(rgbToCmyk(0, 0, 0), { c: 0, m: 0, y: 0, k: 100 });
});

test('CLO-1/2: Bresenham midpoint circle maintains exact 8-way octant symmetry', () => {
  const s = createSurface(100, 100);
  const red = hexToRgba('#DC2626');
  const plotted = drawBresenhamCircle(s, 50, 50, 20, red, 1);
  assert.ok(plotted > 100);
  assert.deepEqual(getPixel(s, 70, 50), [220, 38, 38, 255]);
  assert.deepEqual(getPixel(s, 30, 50), [220, 38, 38, 255]);
  assert.deepEqual(getPixel(s, 50, 70), [220, 38, 38, 255]);
  assert.deepEqual(getPixel(s, 50, 30), [220, 38, 38, 255]);
});

test('CLO-2: 2D symmetry transforms and 3x3 homogeneous matrix + inverse round-trip cleanly', () => {
  const center = { x: 100, y: 100 };
  const rotated90 = rotatePoint({ x: 150, y: 100 }, center, Math.PI / 2);
  assert.ok(Math.abs(rotated90.x - 100) < 1e-6);
  assert.ok(Math.abs(rotated90.y - 150) < 1e-6);

  assert.deepEqual(reflectPointHorizontal({ x: 130, y: 80 }, center), { x: 130, y: 120 });

  for (const sectors of [4, 6, 8, 12]) {
    assert.equal(generateSymmetricPoints({ x: 140, y: 110 }, center, { sectors, reflect: false }).length, sectors);
    assert.equal(
      generateSymmetricSegments({ x: 120, y: 105 }, { x: 160, y: 125 }, center, { sectors, reflect: true }).length,
      sectors * 2
    );
  }

  const m = buildHomogeneousTransform2D(
    {
      ...DEFAULT_TRANSFORM_2D,
      translateX: 25,
      translateY: -15,
      scaleX: 1.25,
      scaleY: 0.85,
      rotateDeg: 35,
      shearX: 0.2,
    },
    center
  );
  const inv = mat3Inverse(m);
  assert.ok(inv);
  const prod = mat3Multiply(m, inv);
  assert.ok(Math.abs(prod[0] - 1) < 1e-6 && Math.abs(prod[4] - 1) < 1e-6);

  const orig = { x: 142, y: 78 };
  const roundTrip = applyMat3(inv, applyMat3(m, orig));
  assert.ok(Math.abs(roundTrip.x - orig.x) < 1e-6);
  assert.ok(Math.abs(roundTrip.y - orig.y) < 1e-6);
});

test('CLO-3: Cohen-Sutherland and Liang-Barsky produce identical clipped endpoints', () => {
  const bounds: ClipBounds = { xmin: 20, ymin: 20, xmax: 100, ymax: 100 };

  assert.equal(computeOutcode(50, 50, bounds), OUTCODE_INSIDE);
  assert.equal(computeOutcode(5, 50, bounds), OUTCODE_LEFT);
  assert.equal(computeOutcode(120, 50, bounds), OUTCODE_RIGHT);

  const cs = cohenSutherlandClip({ x: 0, y: 60 }, { x: 140, y: 60 }, bounds);
  const lb = liangBarskyClip({ x: 0, y: 60 }, { x: 140, y: 60 }, bounds);
  assert.ok(cs && lb);
  assert.equal(cs.wasClipped, true);
  assert.equal(lb.wasClipped, true);
  assert.ok(Math.abs(cs.p0.x - lb.p0.x) < 1e-6 && Math.abs(cs.p0.x - 20) < 1e-6);
  assert.ok(Math.abs(cs.p1.x - lb.p1.x) < 1e-6 && Math.abs(cs.p1.x - 100) < 1e-6);

  // Diagonal line clipping agreement
  const csDiag = cohenSutherlandClip({ x: 0, y: 0 }, { x: 120, y: 120 }, bounds);
  const lbDiag = liangBarskyClip({ x: 0, y: 0 }, { x: 120, y: 120 }, bounds);
  assert.ok(csDiag && lbDiag);
  assert.ok(Math.abs(csDiag.p0.x - lbDiag.p0.x) < 1e-6);
  assert.ok(Math.abs(csDiag.p1.y - lbDiag.p1.y) < 1e-6);

  // Fully outside segment rejected by both
  assert.equal(cohenSutherlandClip({ x: 0, y: 0 }, { x: 10, y: 120 }, bounds), null);
  assert.equal(liangBarskyClip({ x: 0, y: 0 }, { x: 10, y: 120 }, bounds), null);
});

test('CLO-3/5: Sutherland-Hodgman clips polygons strictly inside the clipping rectangle', () => {
  const bounds: ClipBounds = { xmin: 20, ymin: 20, xmax: 80, ymax: 80 };
  const diamond = buildDiamondPetalPolygon({ x: 50, y: 5 }, { x: 50, y: 95 });
  const clipped = sutherlandHodgmanClip(diamond, bounds);

  assert.ok(clipped.length >= 4, 'Clipped diamond should produce a closed polygon');
  for (const v of clipped) {
    assert.ok(v.x >= bounds.xmin - 1e-6 && v.x <= bounds.xmax + 1e-6);
    assert.ok(v.y >= bounds.ymin - 1e-6 && v.y <= bounds.ymax + 1e-6);
  }
});

test('CLO-1: Iterative seed fill contains color strictly inside a closed Bresenham boundary', () => {
  const s = createSurface(40, 40);
  clearSurface(s, '#000000');
  const border = hexToRgba('#FFFFFF');
  const gold = hexToRgba('#F59E0B');

  drawBresenhamLine(s, 10, 10, 20, 10, border, 1);
  drawBresenhamLine(s, 20, 10, 20, 20, border, 1);
  drawBresenhamLine(s, 20, 20, 10, 20, border, 1);
  drawBresenhamLine(s, 10, 20, 10, 10, border, 1);

  assert.equal(iterativeSeedFill(s, 15, 15, gold), 81);
  assert.deepEqual(getPixel(s, 15, 15), [245, 158, 11, 255]);
  assert.deepEqual(getPixel(s, 5, 5), [0, 0, 0, 255]);
});

test('CLO-4/5: 3D Projection distinguishes parallel vs perspective and Z-buffer rejects hidden surfaces', () => {
  const mesh = buildAlponaMonumentMesh(8);
  assert.ok(mesh.length > 20);

  const perspParams: Transform3DParams = {
    rotXDeg: 28,
    rotYDeg: 35,
    rotZDeg: 0,
    scale: 1,
    translateX: 0,
    translateY: 0,
    focalLength: 3.2,
    projection: 'perspective',
    hsrMode: 'zbuffer',
  };

  // Nearer point projects larger than farther point under perspective, equal under parallel
  const nearP = projectPoint3D({ x: 1, y: 0, z: -0.5 }, 400, 400, perspParams);
  const farP = projectPoint3D({ x: 1, y: 0, z: 1.5 }, 400, 400, perspParams);
  assert.ok(nearP.x > farP.x, 'Perspective foreshortening must shrink farther points');

  const parallelParams: Transform3DParams = { ...perspParams, projection: 'parallel' };
  const nearPar = projectPoint3D({ x: 1, y: 0, z: -0.5 }, 400, 400, parallelParams);
  const farPar = projectPoint3D({ x: 1, y: 0, z: 1.5 }, 400, 400, parallelParams);
  assert.equal(nearPar.x, farPar.x);

  const s = createSurface(200, 180);
  const res = render3DScene(s, mesh, perspParams);
  assert.ok(res.pixelsShaded > 2000);
  assert.ok(res.zBufferRejects > 100, 'Z-Buffer should reject occluded back-layer pixels');
});

test('CLO-6: Image point processing, spatial Sobel/Gaussian filters, and 2D FFT execute cleanly', () => {
  const s = createSurface(64, 64);
  clearSurface(s, '#16161B');
  drawBresenhamCircle(s, 32, 32, 18, hexToRgba('#FAF8F2'), 2);

  // Image Negative
  const neg = applyPointOperation(s, 'negative');
  assert.equal(neg.data[0], 255 - s.data[0]);

  // Histogram Equalization
  const histBefore = computeLuminanceHistogram(s);
  assert.equal(histBefore.bins.reduce((a, b) => a + b, 0), 64 * 64);
  const eq = applyPointOperation(s, 'hist-equalize');
  assert.equal(eq.data.length, s.data.length);

  // Spatial Sobel Edge Detection
  const sobel = applySpatialFilter(s, 'sobel-edge');
  let maxEdge = 0;
  for (let i = 0; i < sobel.data.length; i += 4) {
    if (sobel.data[i] > maxEdge) maxEdge = sobel.data[i];
  }
  assert.ok(maxEdge > 150, 'Sobel should detect strong circle boundary edges');

  // 1D FFT -> IFFT round-trip accuracy
  const re = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const im = new Float64Array(8);
  fft1d(re, im, false);
  fft1d(re, im, true);
  assert.ok(Math.abs(re[0] - 1) < 1e-6 && Math.abs(re[7] - 8) < 1e-6);

  // 2D Frequency Domain Gaussian Low-Pass Filter
  const freq = applyFrequencyDomainFilter(s, 'gaussian-lowpass', 18, 64);
  assert.equal(freq.filtered.width, 64);
  assert.equal(freq.spectrum.width, 64);
});

test('All Bengali Alpona starter motifs render cleanly under both Cohen-Sutherland and Liang-Barsky', () => {
  for (const motif of ALPONA_MOTIFS) {
    const s = createSurface(240, 240);
    const ops = motif.buildOperations(240);
    const { metrics } = renderScene(s, '#16161B', ops, null, {
      lineAlgorithm: 'bresenham',
      clippingWindow: { enabled: true, inset: 30, algorithm: 'liang-barsky' },
    });
    assert.equal(metrics.operationsCount, ops.length);
    assert.ok(metrics.segmentsSubmitted > 10);
  }
});

test('CLO-3/5: Weiler-Atherton cleanly splits concave U/Shapla polygons into disjoint sub-polygons', () => {
  const bounds: ClipBounds = { xmin: 20, ymin: 20, xmax: 80, ymax: 80 };
  // Concave U-shaped polygon whose left & right prongs enter the top edge separately
  const concaveU = [
    { x: 28, y: 5 },
    { x: 72, y: 5 },
    { x: 72, y: 65 },
    { x: 58, y: 65 },
    { x: 58, y: 12 },
    { x: 42, y: 12 },
    { x: 42, y: 65 },
    { x: 28, y: 65 },
  ];
  const split = weilerAthertonClip(concaveU, bounds);
  assert.ok(split.length >= 2, `Expected >=2 disjoint polygons from concave U, got ${split.length}`);
  for (const poly of split) {
    assert.ok(poly.length >= 3);
    for (const v of poly) {
      assert.ok(v.x >= bounds.xmin - 1e-5 && v.x <= bounds.xmax + 1e-5);
      assert.ok(v.y >= bounds.ymin - 1e-5 && v.y <= bounds.ymax + 1e-5);
    }
  }

  // Concave Shapla star petal builder produces 8 vertices
  const shapla = buildConcaveStarPetalPolygon({ x: 50, y: 10 }, { x: 50, y: 90 });
  assert.equal(shapla.length, 8);
});

test('CLO-6: Pixel Relationships (N4, N8, D4, D8, De, BFS components) and Printable Stencil work accurately', () => {
  const s = createSurface(32, 32);
  clearSurface(s, '#101014');
  // Draw a bright white diagonal bar
  drawBresenhamLine(s, 6, 6, 14, 14, hexToRgba('#FFFFFF'), 1);

  const report = computePixelRelationships(s, { x: 6, y: 6 }, { x: 9, y: 9 }, 20);
  assert.equal(report.d4CityBlock, 6);
  assert.equal(report.d8Chessboard, 3);
  assert.ok(Math.abs(report.deEuclidean - 4.24) < 0.02);
  assert.equal(report.n4OfP1.length, 4);
  assert.equal(report.n8OfP1.length, 8);
  // Diagonal pixels are 8-connected but NOT 4-connected!
  assert.equal(report.connected8Path, true);
  assert.equal(report.connected4Path, false);
  assert.ok(report.component8Size >= 9);

  // Printable stencil yields strictly B&W ink/paper output
  const stencil = extractPrintableStencil(s, 40);
  let hasInk = false;
  let hasPaper = false;
  for (let i = 0; i < stencil.data.length; i += 4) {
    const v = stencil.data[i];
    assert.ok(v === 20 || v === 255, `Stencil pixel must be ink (20) or paper (255), got ${v}`);
    if (v === 20) hasInk = true;
    if (v === 255) hasPaper = true;
  }
  assert.ok(hasInk && hasPaper);
});

test('CLO-4/5: 3D Courtyard Floor projects live Alpona texture and detects View Confusion (z <= -d)', () => {
  const tex = createSurface(64, 64);
  clearSurface(tex, '#2B1615');
  drawBresenhamCircle(tex, 32, 32, 22, hexToRgba('#FAF8F2'), 2);

  const out = createSurface(200, 180);
  const normalParams: Transform3DParams = {
    rotXDeg: 38,
    rotYDeg: 28,
    rotZDeg: 0,
    scale: 1.0,
    translateX: 0,
    translateY: 0,
    focalLength: 2.8,
    projection: 'perspective',
    hsrMode: 'zbuffer',
    allowCopAnomaly: false,
  };
  const normalRes = render3DCourtyardFloor(out, tex, normalParams);
  assert.ok(normalRes.pixelsShaded > 3000);
  assert.equal(normalRes.anomalyVerticesCount, 0);

  const anomalyParams: Transform3DParams = {
    ...normalParams,
    scale: 1.25,
    focalLength: 0.72,
    allowCopAnomaly: true,
  };
  const anomalyRes = render3DCourtyardFloor(out, tex, anomalyParams);
  assert.ok((anomalyRes.anomalyVerticesCount ?? 0) > 0, 'Should detect vertices behind COP (z <= -d)');
});

test('Project JSON save/load and 16x Pixel-Grid Algorithm Stepper traces remain deterministic', () => {
  const ops = ALPONA_MOTIFS[0].buildOperations(720);
  const json = serializeAlponaProject({
    surfaceId: 'courtyard',
    symmetry: { sectors: 8, reflect: true },
    lineAlgorithm: 'bresenham',
    clippingWindow: {
      enabled: true,
      inset: 110,
      algorithm: 'cohen-sutherland',
      polygonAlgorithm: 'weiler-atherton',
    },
    transform2D: DEFAULT_TRANSFORM_2D,
    operations: ops,
  });
  const parsed = parseAlponaProject(json);
  assert.equal(parsed.format, 'alpona-studio-v2');
  assert.equal(parsed.surfaceId, 'courtyard');
  assert.equal(parsed.clippingWindow.polygonAlgorithm, 'weiler-atherton');
  assert.equal(parsed.operations.length, ops.length);
  assert.throws(() => parseAlponaProject('{"bad": true}'));

  const bSteps = traceBresenhamLineSteps(1, 2, 12, 8);
  const dSteps = traceDdaLineSteps(1, 2, 12, 8);
  const cSteps = traceMidpointCircleSteps(8, 8, 5);
  assert.equal(bSteps.length, 12);
  assert.equal(dSteps.length, 12);
  assert.ok(cSteps.length >= 4 && cSteps[0].points.length === 8);
});

test('Parametric Cubic Bezier, de Casteljau subdivision & Bengali folk stamps render cleanly', () => {
  const p0 = { x: 10, y: 10 };
  const p1 = { x: 40, y: 80 };
  const p2 = { x: 80, y: 80 };
  const p3 = { x: 110, y: 10 };

  const evalMid = evaluateCubicBezier(p0, p1, p2, p3, 0.5);
  const dcMid = deCasteljauSubdivision(p0, p1, p2, p3, 0.5);
  assert.ok(Math.abs(evalMid.x - dcMid.point.x) < 1e-6);
  assert.ok(Math.abs(evalMid.y - dcMid.point.y) < 1e-6);

  const sampled = sampleCubicBezier(p0, p1, p2, p3, 24);
  assert.equal(sampled.length, 25);

  const s = createSurface(240, 240);
  const kalkaOps = BENGALI_BEZIER_STAMPS[0].build(
    240,
    0.36,
    '#FAF8F2',
    2,
    { sectors: 8, reflect: true },
    true
  );
  const { metrics } = renderScene(s, '#16161B', kalkaOps);
  assert.ok(metrics.bresenhamLinePixels > 200);
});

test('True Vector SVG exporter outputs valid scalable paths including Cubic Bezier curves', () => {
  const ops = [
    ...ALPONA_MOTIFS[0].buildOperations(720).slice(0, 3),
    ...BENGALI_BEZIER_STAMPS[0].build(720, 0.34, '#FAF8F2', 3, {
      sectors: 6,
      reflect: true,
    }),
  ];
  const svg = generateAlponaSvg(ops, CANVAS_SURFACES[0], 720);
  assert.ok(svg.startsWith('<?xml version="1.0"'));
  assert.ok(svg.includes('<svg ') && svg.includes('</svg>'));
  assert.ok(svg.includes('<path d="M ') && svg.includes(' C '));
});

test('CLO-6 Binary Mathematical Morphology Closing seals 1-2 px micro-gaps cleanly', () => {
  const s = createSurface(32, 32);
  clearSurface(s, '#101014');
  // Horizontal bright stroke (thickness 1) with a deliberate 2-pixel empty gap at x=15,16
  drawBresenhamLine(s, 4, 16, 14, 16, hexToRgba('#FFFFFF'), 1);
  drawBresenhamLine(s, 17, 16, 27, 16, hexToRgba('#FFFFFF'), 1);
  assert.equal(s.data[(16 * 32 + 15) * 4], 16, 'Gap pixel must start dark');

  const closed = applyMorphology(s, 'close', 2, 70);
  assert.ok(closed.gapsBridged >= 2, `Expected >=2 bridged gap pixels, got ${closed.gapsBridged}`);
  // Check bridged pixel at (15, 16) is now foreground (highlighted Sindoor crimson)
  const off = (16 * 32 + 15) * 4;
  assert.equal(closed.surface.data[off], 220);
});

test('4-Corner 3x3 Projective Homography Try-On & Real-World Chalk Floor Blueprint stay accurate', () => {
  const quad = {
    tl: { x: 120, y: 90 },
    tr: { x: 260, y: 100 },
    br: { x: 310, y: 240 },
    bl: { x: 70, y: 230 },
  };
  const hom = solveHomographyFromUnitSquare(quad);
  assert.equal(hom.valid, true);
  // Forward mapping of unit square corners must hit destination quad corners accurately
  const mappedBR = applyHomography(hom.matrix, 1, 1);
  assert.ok(Math.abs(mappedBR.x - quad.br.x) < 1e-4);
  assert.ok(Math.abs(mappedBR.y - quad.br.y) < 1e-4);

  const floor = generateCourtyardFloorPhoto(360, 280);
  const tex = createSurface(64, 64);
  clearSurface(tex, '#16161B');
  drawBresenhamCircle(tex, 32, 32, 22, hexToRgba('#FAF8F2'), 3);
  const tryOn = renderVirtualFloorTryOn(floor, tex, quad, 'chalk-screen', 0.9);
  assert.ok(tryOn.warpedPixels > 200);

  // Blueprint chord math: for diameter 200cm (R4 = 100cm) and 6 sectors, chord c = 2*100*sin(30deg) = 100cm
  const bp = computeFloorBlueprint(tex, '#16161B', 200, 6);
  assert.equal(bp.rings.length, 4);
  assert.ok(Math.abs(bp.rings[3].sectorChordCm - 100) < 0.2);
  assert.ok(bp.pigments.length >= 1);
});

test('4K Ultra-HD export scaling & 2x2 SSAA anti-aliasing downsampler stay exact', () => {
  const ops = ALPONA_MOTIFS[0].buildOperations(720);
  const scaled4x = scaleOperations(ops, 4);
  assert.equal(scaled4x.length, ops.length);
  const firstCircleOrig = ops.find((o) => o.kind === 'circle');
  const firstCircle4x = scaled4x.find((o) => o.kind === 'circle');
  assert.ok(firstCircleOrig && firstCircle4x);
  if (firstCircleOrig.kind === 'circle' && firstCircle4x.kind === 'circle') {
    assert.equal(firstCircle4x.radius, firstCircleOrig.radius * 4);
    assert.equal(firstCircle4x.center.x, firstCircleOrig.center.x * 4);
  }

  const opts4x = scaleRenderOptions(
    {
      clippingWindow: {
        enabled: true,
        inset: 80,
        algorithm: 'cohen-sutherland',
      },
      transform2D: { ...DEFAULT_TRANSFORM_2D, translateX: 15, translateY: -10 },
    },
    4
  );
  assert.equal(opts4x.clippingWindow?.inset, 320);
  assert.equal(opts4x.transform2D?.translateX, 60);
  assert.equal(opts4x.transform2D?.translateY, -40);

  // 2x2 SSAA box filter: 2 white + 2 black pixels in a 2x2 block average to gray (~128)
  const hi = createSurface(4, 4);
  clearSurface(hi, '#000000');
  hi.data[0] = 255; hi.data[1] = 255; hi.data[2] = 255;
  hi.data[4] = 255; hi.data[5] = 255; hi.data[6] = 255;
  const ssaa = downsample2xSSAA(hi);
  assert.equal(ssaa.width, 2);
  assert.equal(ssaa.height, 2);
  assert.equal(ssaa.data[0], 128);
});

test('Street-Photo Alpona Unwarper rectifies angled photo, detects 8-fold symmetry & repairs scuffed quadrant', () => {
  const { surface: streetPhoto, quad } = generateAngledStreetAlponaPhoto(320, 220);
  const res = restoreAlponaFromPhoto(streetPhoto, quad, 'auto', true, 160);
  assert.equal(res.rectified.width, 160);
  assert.equal(res.symmetry.detectedSectors, 8);
  assert.ok(res.symmetry.confidencePercent >= 50);

  // Scuffed quadrant pixel in rectified becomes brighter after dihedral symmetry restoration
  const rawSpot = res.rectified.data[(120 * 160 + 120) * 4];
  const healedSpot = res.restored.data[(120 * 160 + 120) * 4];
  assert.ok(healedSpot >= rawSpot);

  // Explicit symmetry detector sanity check
  const sym2 = detectRotationalSymmetryOrder(res.restored);
  assert.equal(sym2.detectedSectors, 8);
});

test('CSE 401 Phong / Gouraud Night-Courtyard Diya Lighting & Normal Map render accurately', () => {
  const art = createSurface(64, 64);
  clearSurface(art, '#18181B');
  drawBresenhamCircle(art, 32, 32, 20, hexToRgba('#FAF8F2'), 2);

  const singleLight = [DIYA_LIGHT_PRESETS['dramatic-rim'].lights[0]];
  const phong = renderPhongDiyaLitAlpona(art, '#18181B', singleLight, {
    ...DEFAULT_PHONG_PARAMS,
    shadingModel: 'phong',
  });
  // Top-left (near diya at 0.18, 0.22) must be significantly warmer/brighter than bottom-right
  const nearR = phong.surface.data[(14 * 64 + 12) * 4];
  const farR = phong.surface.data[(58 * 64 + 58) * 4];
  assert.ok(nearR > farR + 20, `Expected nearR (${nearR}) > farR (${farR}) + 20`);

  const gouraud = renderPhongDiyaLitAlpona(art, '#18181B', singleLight, {
    ...DEFAULT_PHONG_PARAMS,
    shadingModel: 'gouraud',
  });
  assert.equal(gouraud.surface.width, 64);

  const normalMap = renderPhongDiyaLitAlpona(art, '#18181B', singleLight, {
    ...DEFAULT_PHONG_PARAMS,
    shadingModel: 'normal-map',
  });
  // Flat background center should point straight up (0, 0, 1) -> RGB ~(128, 128, 255)
  const centerB = normalMap.surface.data[(32 * 64 + 32) * 4 + 2];
  assert.ok(centerB >= 245);
});

test('Darkroom Projector stage partitioner separates circles, lines/polygons, curves & fills cleanly', () => {
  const ops = [
    ...ALPONA_MOTIFS[0].buildOperations(720),
    ...BENGALI_BEZIER_STAMPS[0].build(720, 0.35, '#FAF8F2', 3, {
      sectors: 8,
      reflect: true,
    }),
  ];
  const stages = partitionTracingStages(ops);
  assert.equal(stages.length, 4);
  assert.ok(stages[0].operations.length > 0, 'Stage 1 should contain compass circles');
  assert.ok(stages[1].operations.length > 0, 'Stage 2 should contain petals/spokes');
  assert.ok(stages[2].operations.length > 0, 'Stage 3 should contain Bezier curves');
  assert.ok(stages[3].operations.length > 0, 'Stage 4 should contain fills');
});

test('HD Timelapse Video Reel parametric progress mapper advances smoothly across strokes', () => {
  const start = computeReelOpProgress(8, 0);
  assert.equal(start.completedCount, 0);
  assert.equal(start.activeIndex, 0);
  assert.equal(start.activeT, 0);

  const mid = computeReelOpProgress(8, 0.3125); // 2.5 / 8
  assert.equal(mid.completedCount, 2);
  assert.equal(mid.activeIndex, 2);
  assert.ok(Math.abs(mid.activeT - 0.5) < 1e-6);

  const end = computeReelOpProgress(8, 1);
  assert.equal(end.completedCount, 8);
  assert.equal(end.activeIndex, -1);
});

test('Saree Paar Frieze Border Studio unwraps circular Alpona and renders 7 frieze groups + 90 deg corner', () => {
  const mappedP2 = mapFriezeCoordinates('p2', 1, 0.25, 0.2);
  assert.ok(Math.abs(mappedP2.tu - 0.75) < 1e-6);
  assert.ok(Math.abs(mappedP2.tv - 0.8) < 1e-6);

  const mappedP2mm = mapFriezeCoordinates('p2mm', 0, 0.75, 0.75);
  assert.ok(Math.abs(mappedP2mm.tu - 0.5) < 1e-6);
  assert.ok(Math.abs(mappedP2mm.tv - 0.5) < 1e-6);

  const surf: PixelSurface = {
    width: 160,
    height: 160,
    data: new Uint8ClampedArray(160 * 160 * 4),
  };
  renderScene(surf, '#2B2B2D', ALPONA_MOTIFS[0].buildOperations(160));
  const res = buildFriezeBorderStudio(
    surf,
    {
      group: 'p2mg',
      innerRadiusFrac: 0.25,
      outerRadiusFrac: 0.9,
      repeatCount: 4,
      trimLines: true,
      trimColorHex: '#FAF8F2',
      fabricHex: '#8C3B2B',
      sectors: 8,
    },
    64,
    48,
    180
  );
  assert.equal(res.tile.width, 64);
  assert.equal(res.tile.height, 48);
  assert.equal(res.strip.width, 64 * 4);
  assert.ok(res.strip.height > 48, 'Double paar trim rails should expand strip height');
  assert.equal(res.corner90.width, 180);
  assert.equal(res.corner90.height, 180);
});

test('Laser/Cricut Stencil Island Detector finds floating BFS islands and bridges them to zero remaining', () => {
  // Synthetic 120x120 dark-ground Alpona containing a closed white ring (creates a floating interior island!)
  const w = 120;
  const h = 120;
  const surf: PixelSurface = {
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
  };
  clearSurface(surf, '#1F1F22');
  drawBresenhamCircle(surf, 60, 60, 32, { r: 250, g: 248, b: 242, a: 255 }, 4);
  drawBresenhamCircle(surf, 60, 60, 14, { r: 250, g: 248, b: 242, a: 255 }, 3);

  const result = analyzeAndBridgeStencil(surf, 5, true, 44);
  assert.ok(
    result.initialIslandCount >= 2,
    `Expected >=2 floating islands inside concentric rings, got ${result.initialIslandCount}`
  );
  assert.equal(
    result.remainingIslandCount,
    0,
    'Auto-bridger must anchor every floating island to zero remaining'
  );
  assert.ok(result.bridges.length >= 2, 'Should add bridges for all islands');
  assert.equal(result.layerA.width, w);
  assert.equal(result.layerB.height, h);
});

test('Photo K-Means Colorway Extractor + Remapper & 8 authentic Bengali Ritual Stamps', () => {
  assert.equal(BENGALI_BEZIER_STAMPS.length, 8);
  const stampIds = BENGALI_BEZIER_STAMPS.map((s) => s.id);
  for (const ritual of ['lokkhir-paa', 'pyacha-owl', 'mangal-ghat', 'dhaner-shish']) {
    assert.ok(stampIds.includes(ritual), `Missing Bengali ritual stamp: ${ritual}`);
    const stamp = BENGALI_BEZIER_STAMPS.find((s) => s.id === ritual)!;
    const ops = stamp.build(720, 0.34, '#FAF8F2', 3, { sectors: 8, reflect: true });
    assert.ok(ops.length >= 2, `Ritual stamp ${ritual} should emit >=2 curves`);
  }

  // Build synthetic 3-color saree photo (red + marigold gold + ivory)
  const photo: PixelSurface = {
    width: 60,
    height: 60,
    data: new Uint8ClampedArray(60 * 60 * 4),
  };
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 60; x++) {
      const off = (y * 60 + x) * 4;
      if (x < 20) {
        photo.data[off] = 190;
        photo.data[off + 1] = 28;
        photo.data[off + 2] = 28;
      } else if (x < 40) {
        photo.data[off] = 245;
        photo.data[off + 1] = 180;
        photo.data[off + 2] = 20;
      } else {
        photo.data[off] = 248;
        photo.data[off + 1] = 244;
        photo.data[off + 2] = 235;
      }
      photo.data[off + 3] = 255;
    }
  }
  const extracted = extractKMeansPalette(photo, 3);
  assert.equal(extracted.length, 3);
  assert.ok(extracted.every((hex) => /^#[0-9A-F]{6}$/.test(hex)));

  const ops = ALPONA_MOTIFS[0].buildOperations(720);
  const remapped = remapOperationsColorway(ops, FESTIVAL_COLORWAYS[1].palette);
  assert.equal(remapped.length, ops.length);
  const allowed = new Set(FESTIVAL_COLORWAYS[1].palette);
  assert.ok(remapped.every((op) => allowed.has(op.color)));
});

test('Chaikin Stroke Stabilizer smooths jitter while preserving endpoints & Rice-Paste Taper swells mid-stroke', () => {
  const jittery = [
    { x: 10, y: 10 },
    { x: 30, y: 24 },
    { x: 50, y: 12 },
    { x: 70, y: 26 },
    { x: 90, y: 14 },
  ];
  const smooth = stabilizeStrokePoints(jittery, 2);
  assert.ok(smooth.length > jittery.length, 'Chaikin subdivision should increase point density');
  assert.deepEqual(smooth[0], jittery[0]);
  assert.deepEqual(smooth[smooth.length - 1], jittery[jittery.length - 1]);

  const params = computePolylineArcParameters(smooth);
  assert.equal(params[0], 0);
  assert.ok(Math.abs(params[params.length - 1] - 1) < 1e-6);

  const tipW = computeRicePasteTaperThickness(6, 0.0);
  const midW = computeRicePasteTaperThickness(6, 0.5);
  const endW = computeRicePasteTaperThickness(6, 1.0);
  assert.ok(midW > tipW, `Expected mid-stroke swell (${midW}) > entry tip (${tipW})`);
  assert.equal(tipW, endW);
});

test('3D Pitha Mold & Woodblock Stamp Exporter generates watertight binary .STL, .OBJ & Phong preview', () => {
  const art = createSurface(96, 96);
  clearSurface(art, '#18181B');
  drawBresenhamCircle(art, 48, 48, 30, hexToRgba('#FAF8F2'), 4);

  const woodOpts = { ...DEFAULT_STL_STAMP_OPTIONS, gridSize: 32, mode: 'woodblock-stamp' as const };
  const hfWood = buildStampHeightfield(art, '#18181B', woodOpts);
  assert.ok(hfWood.activeCells > 400);
  assert.ok(hfWood.maxZ > hfWood.minZ + 1.0, 'Woodblock relief must rise above base');

  const mesh = generateStampMesh(hfWood, woodOpts);
  assert.ok(mesh.triangleCount > 1500);
  assert.ok(mesh.estimatedVolumeCm3 > 5);

  const stlBytes = serializeBinaryStl(mesh);
  assert.equal(stlBytes.length, 84 + mesh.triangleCount * 50, 'Binary STL byte size must match 84 + 50*N');
  const view = new DataView(stlBytes.buffer);
  assert.equal(view.getUint32(80, true), mesh.triangleCount);

  const obj = serializeAsciiObj(mesh);
  assert.ok(obj.includes('o AlponaStamp') && obj.includes('\nf 1 2 3\n'));

  // Pitha Mold inverts relief into recessed cavity
  const pithaOpts = { ...woodOpts, mode: 'pitha-mold' as const, includeHandle: false };
  const hfPitha = buildStampHeightfield(art, '#18181B', pithaOpts);
  const centerIdx = 16 * 32 + 16;
  assert.ok(hfPitha.heightsMm[centerIdx] > hfWood.heightsMm[centerIdx], 'Pitha mold center should be raised while ring is recessed');

  const preview = renderStampTurntablePreview(hfWood, woodOpts, 32, 42, 160, 120);
  assert.equal(preview.width, 160);
  assert.equal(preview.height, 120);
});

test('Jamdani Handloom & Nakshi Kantha Weave Chart quantizes grid, dithers & computes thread meters', () => {
  const art = createSurface(96, 96);
  renderScene(art, '#2B2B2D', ALPONA_MOTIFS[0].buildOperations(96));

  const chart = buildWeaveChart(art, {
    gridSize: 40,
    maxColors: 5,
    ditherMode: 'floyd-steinberg',
    palettePreset: 'jamdani-zari',
    clothCountPerInch: 14,
  });
  assert.equal(chart.gridSize, 40);
  assert.equal(chart.totalStitches, 1600);
  assert.equal(chart.cells.length, 1600);
  assert.equal(chart.threads.length, 5);
  const sumStitches = chart.threads.reduce((acc, t) => acc + t.stitchCount, 0);
  assert.equal(sumStitches, 1600, 'Thread stitch counts must sum exactly to totalStitches');
  assert.ok(chart.finishedSizeCm > 5);

  const csv = exportWeaveChartCsv(chart);
  assert.ok(csv.includes('Jamdani / Nakshi Kantha Weave Chart (40x40)'));
  const dataRows = csv
    .trim()
    .split('\n')
    .filter((l) => !l.startsWith('#'));
  assert.equal(dataRows.length, 40);
});

test('Procedural Lata-Pata L-System, Phyllotaxis & Rhodonea Composer emits deterministic editable Alpona ops', () => {
  const expanded = expandLSystem('F', { F: 'F[+F][-F]F' }, 2);
  assert.ok(expanded.length > 25, '2-iteration L-system expansion should produce branching grammar');

  const cfg = {
    seed: 2026,
    sectors: 8,
    includePhyllotaxis: true,
    includeRhodonea: true,
    includeLSystemVine: true,
    primaryColor: '#FAF8F2',
    accentColor: '#DC2626',
    thickness: 3,
  };
  const a = composeProceduralAlpona(720, cfg);
  const b = composeProceduralAlpona(720, cfg);
  assert.deepEqual(a, b, 'Same seed must produce identical deterministic procedural Alpona');
  assert.ok(a.phyllotaxisDots >= 16);
  assert.ok(a.lSystemAxiomLength > 25);
  assert.ok(a.operations.length >= 25);

  const surf = createSurface(160, 160);
  const { metrics } = renderScene(surf, '#2B2B2D', composeProceduralAlpona(160, cfg).operations);
  assert.ok(metrics.bresenhamLinePixels + metrics.midpointCirclePixels > 300);
});

test('Natural Media Chaler Guro & Mati Courtyard NPR Renderer synthesizes fBm substrates & impasto relief', () => {
  const n1 = fbm2D(3.25, 7.5);
  const n2 = fbm2D(3.25, 7.5);
  assert.equal(n1, n2, 'fBm noise must be deterministic');
  assert.ok(n1 >= 0 && n1 <= 1);

  const art = createSurface(80, 80);
  clearSurface(art, '#18181B');
  drawBresenhamCircle(art, 40, 40, 22, hexToRgba('#FAF8F2'), 3);

  const mati = renderNaturalMediaAlpona(art, '#18181B', {
    ...DEFAULT_NATURAL_MEDIA_OPTIONS,
    substrate: 'mati-mud',
  });
  assert.equal(mati.width, 80);
  // Corner mud pixel should be warm reddish-brown (R > G > B)
  assert.ok(mati.data[0] > mati.data[1] && mati.data[1] > mati.data[2]);

  const cotton = renderNaturalMediaAlpona(art, '#18181B', {
    ...DEFAULT_NATURAL_MEDIA_OPTIONS,
    substrate: 'tant-cotton',
  });
  // Light handloom cotton shifts white rice-paste strokes to crimson Sindoor
  const strokeOff = (40 * 80 + 62) * 4;
  assert.ok(cotton.data[strokeOff] > cotton.data[strokeOff + 1] + 50);
});

test('computeSymmetryReflectionAxes returns exact Dihedral mirror diameters & Cyclic sector rays', () => {
  const size = 720;
  const center = { x: size / 2, y: size / 2 };

  // Dihedral D_4: 4 full edge-to-edge mirror axes at 0, 45, 90, 135 deg
  const d4 = computeSymmetryReflectionAxes(size, { sectors: 4, reflect: true });
  assert.equal(d4.length, 4);
  assert.deepEqual(
    d4.map((a) => a.angleDeg),
    [0, 45, 90, 135]
  );
  for (const axis of d4) {
    assert.equal(axis.isReflectionMirror, true);
    // Midpoint of each diameter must pass through exact canvas center
    assert.ok(Math.abs((axis.x1 + axis.x2) / 2 - center.x) < 1e-6);
    assert.ok(Math.abs((axis.y1 + axis.y2) / 2 - center.y) < 1e-6);
    // Endpoints lie on the canvas boundary [0, size]
    assert.ok(axis.x1 >= -1e-6 && axis.x1 <= size + 1e-6);
    assert.ok(axis.y1 >= -1e-6 && axis.y1 <= size + 1e-6);
    assert.ok(axis.x2 >= -1e-6 && axis.x2 <= size + 1e-6);
    assert.ok(axis.y2 >= -1e-6 && axis.y2 <= size + 1e-6);

    // Every point on axis k must be fixed by its dihedral reflection (reflectHorizontal + rotate 2*alpha)
    const testPt = {
      x: center.x + (axis.x2 - center.x) * 0.4,
      y: center.y + (axis.y2 - center.y) * 0.4,
    };
    const mirrored = rotatePoint(
      reflectPointHorizontal(testPt, center),
      center,
      (2 * axis.angleDeg * Math.PI) / 180
    );
    assert.ok(Math.hypot(mirrored.x - testPt.x, mirrored.y - testPt.y) < 1e-6);
  }

  // Dihedral D_3: 3 full diameters (0, 60, 120 deg)
  const d3 = computeSymmetryReflectionAxes(size, { sectors: 3, reflect: true });
  assert.equal(d3.length, 3);
  assert.deepEqual(
    d3.map((a) => a.angleDeg),
    [0, 60, 120]
  );

  // Cyclic C_6: 6 rays originating from center with isReflectionMirror === false
  const c6 = computeSymmetryReflectionAxes(size, { sectors: 6, reflect: false });
  assert.equal(c6.length, 6);
  for (const ray of c6) {
    assert.equal(ray.isReflectionMirror, false);
    assert.equal(ray.x1, center.x);
    assert.equal(ray.y1, center.y);
  }
});

test('Magnetic Snap-to-Axis, Concentric Ring Snap, Axis-Ring Intersection & Compass Arc Lock stay exact', () => {
  const size = 720;
  const center = { x: 360, y: 360 };
  const sym8 = { sectors: 8, reflect: true };

  // 1. Axis snap near 0 deg horizontal mirror line (y = 360 + 5, within threshold 10)
  const axisSnap = snapPointToSymmetryGuides(
    { x: 540, y: 365 },
    size,
    sym8,
    { ...DEFAULT_SNAP_CONFIG, snapToRing: false }
  );
  assert.equal(axisSnap.wasSnapped, true);
  assert.equal(axisSnap.snappedAxisAngleDeg, 0);
  assert.equal(axisSnap.point.y, 360);

  // 2. Exact axis + guide ring (r = 240) intersection near (360 + 236, 360 + 4)
  const bothSnap = snapPointToSymmetryGuides(
    { x: 596, y: 364 },
    size,
    sym8,
    DEFAULT_SNAP_CONFIG
  );
  assert.equal(bothSnap.wasSnapped, true);
  assert.equal(bothSnap.snappedAxisAngleDeg, 0);
  assert.equal(bothSnap.snappedRingRadius, 240);
  assert.deepEqual(bothSnap.point, { x: 600, y: 360 });

  // 3. Ring-only snap away from mirror axes (angle ~11 deg, radius ~124 -> r=120)
  const ringSnap = snapPointToSymmetryGuides(
    { x: center.x + Math.cos(0.2) * 124, y: center.y + Math.sin(0.2) * 124 },
    size,
    { sectors: 4, reflect: true },
    DEFAULT_SNAP_CONFIG
  );
  assert.equal(ringSnap.wasSnapped, true);
  assert.equal(ringSnap.snappedRingRadius, 120);
  assert.equal(ringSnap.snappedAxisAngleDeg, null);
  const snappedDist = Math.hypot(ringSnap.point.x - center.x, ringSnap.point.y - center.y);
  assert.ok(Math.abs(snappedDist - 120) <= 1.2);

  // 4. Compass Arc Lock pins pointer strictly onto locked radius r = 185
  const lockSnap = snapPointToSymmetryGuides(
    { x: 510, y: 420 },
    size,
    sym8,
    { ...DEFAULT_SNAP_CONFIG, snapToAxis: false, compassArcLock: true },
    185
  );
  assert.equal(lockSnap.wasSnapped, true);
  assert.equal(lockSnap.lockedRadius, 185);
  const lockedDist = Math.hypot(lockSnap.point.x - center.x, lockSnap.point.y - center.y);
  assert.ok(Math.abs(lockedDist - 185) <= 1.2);
});

test('Layer stack CRUD (visibility, reorder, recolor, duplicate, delete) & hidden-op rendering exclusion', () => {
  const ops: DrawOperation[] = [
    {
      id: 'op-1',
      kind: 'circle',
      center: { x: 80, y: 80 },
      radius: 28,
      color: '#FAF8F2',
      thickness: 2,
      symmetry: { sectors: 1, reflect: false },
    },
    {
      id: 'op-2',
      kind: 'line',
      p0: { x: 80, y: 20 },
      p1: { x: 80, y: 60 },
      color: '#DC2626',
      thickness: 2,
      symmetry: { sectors: 4, reflect: false },
    },
  ];

  // Toggle visibility & confirm renderScene skips hidden operations
  const hiddenFirst = toggleOperationVisibility(ops, 'op-1');
  assert.equal(hiddenFirst[0].hidden, true);
  assert.equal(hiddenFirst[1].hidden, undefined);

  const surf = createSurface(160, 160);
  const { metrics } = renderScene(surf, '#16161B', hiddenFirst);
  assert.equal(metrics.operationsCount, 1);
  assert.equal(metrics.midpointCirclePixels, 0);

  // Show all restores visibility
  const shownAll = setAllOperationsVisibility(hiddenFirst, true);
  assert.ok(shownAll.every((o) => o.hidden === false));

  // Reorder up swaps op-1 above op-2
  const reordered = moveOperationOrder(ops, 'op-1', 'up');
  assert.deepEqual(
    reordered.map((o) => o.id),
    ['op-2', 'op-1']
  );

  // Recolor, duplicate, delete, and describe
  const recolored = recolorOperation(reordered, 'op-2', '#F59E0B');
  assert.equal(recolored[0].color, '#F59E0B');
  const duped = duplicateOperationById(recolored, 'op-2');
  assert.equal(duped.length, 3);
  const deleted = deleteOperationById(duped, 'op-1');
  assert.equal(deleted.length, 2);

  const desc = describeOperation(ops[0], 0);
  assert.equal(desc.title, '#1 Circle r=28');
  assert.equal(desc.symmetryTag, 'C1');

  const sketchUrl = buildSampleReferenceSketchDataUrl();
  assert.ok(sketchUrl.startsWith('data:image/svg+xml;charset=utf-8,'));
});

test('Hit-test stroke eraser locates symmetric copies in z-order and skips hidden layers', () => {
  const size = 720;
  const ops: DrawOperation[] = [
    {
      id: 'ring-base',
      kind: 'circle',
      center: { x: 360, y: 360 },
      radius: 180,
      color: '#FAF8F2',
      thickness: 3,
      symmetry: { sectors: 1, reflect: false },
    },
    {
      id: 'spoke-top',
      kind: 'line',
      p0: { x: 360, y: 180 },
      p1: { x: 360, y: 260 },
      color: '#DC2626',
      thickness: 3,
      symmetry: { sectors: 4, reflect: false },
    },
  ];

  // Query on the 90-degree rotated symmetric copy of spoke-top (around x=500, y=360)
  const hitSymCopy = hitTestOperationAtPoint(ops, { x: 500, y: 360 }, size, 14);
  assert.equal(hitSymCopy?.id, 'spoke-top');

  // Query at shared intersection (360, 180) returns topmost z-order layer (spoke-top)
  const hitTop = hitTestOperationAtPoint(ops, { x: 360, y: 180 }, size, 14);
  assert.equal(hitTop?.id, 'spoke-top');

  // Hiding spoke-top causes the same point to hit ring-base underneath
  const hiddenTop = toggleOperationVisibility(ops, 'spoke-top');
  const hitUnder = hitTestOperationAtPoint(hiddenTop, { x: 360, y: 180 }, size, 14);
  assert.equal(hitUnder?.id, 'ring-base');

  // Far empty corner misses everything
  const miss = hitTestOperationAtPoint(ops, { x: 25, y: 25 }, size, 12);
  assert.equal(miss, null);
});

test('Viewport camera zoom-at-point, pan clamping & screen-to-canvas coordinate inversion stay exact', () => {
  const size = 720;
  const stageRect = { left: 100, top: 80, width: 600, height: 600 };

  // Clamping enforces [1.0, 4.0] zoom and zeros pan at 1x
  const clampedLow = clampCanvasViewport({ zoom: 0.4, panX: 120, panY: -90 }, size);
  assert.deepEqual(clampedLow, DEFAULT_CANVAS_VIEWPORT);

  const clampedHigh = clampCanvasViewport({ zoom: 7.5, panX: 999, panY: -999 }, size);
  assert.equal(clampedHigh.zoom, 4.0);
  const maxPan4x = (size * (4 - 1)) / (2 * 4); // 270
  assert.equal(clampedHigh.panX, maxPan4x);
  assert.equal(clampedHigh.panY, -maxPan4x);

  // Zoom-at-point keeps anchor canvas point fixed in normalized stage coordinates
  const anchor = { x: 480, y: 260 };
  const normBefore = canvasToStageNormalized(anchor, DEFAULT_CANVAS_VIEWPORT, size);
  const zoomed = zoomCanvasViewportAtPoint(DEFAULT_CANVAS_VIEWPORT, 2.5, anchor, size);
  const normAfter = canvasToStageNormalized(anchor, zoomed, size);
  assert.ok(Math.abs(normBefore.x - normAfter.x) < 1e-6);
  assert.ok(Math.abs(normBefore.y - normAfter.y) < 1e-6);

  // Screen-to-canvas inverse matches forward canvas-to-stage projection under pan + zoom
  const panned = panCanvasViewportByScreenDelta(zoomed, 45, -30, stageRect.width, size);
  const target = { x: 412, y: 318 };
  const projNorm = canvasToStageNormalized(target, panned, size);
  const clientX = stageRect.left + projNorm.x * stageRect.width;
  const clientY = stageRect.top + projNorm.y * stageRect.height;
  const inverted = screenToCanvasWithViewport(clientX, clientY, stageRect, panned, size);
  assert.deepEqual(inverted, target);
});

test('CommittedFrameCache reuses committed base pixels on live preview drags and invalidates cleanly', () => {
  const size = 240;
  const surfaceCached = createSurface(size, size);
  const surfaceDirect = createSurface(size, size);
  const cache = createCommittedFrameCache();

  const ops: DrawOperation[] = [
    {
      id: 'base-ring',
      kind: 'circle',
      color: '#FAF6EE',
      thickness: 2,
      symmetry: { sectors: 8, reflect: true },
      center: { x: 120, y: 60 },
      radius: 26,
    },
    {
      id: 'base-spoke',
      kind: 'line',
      color: '#D99B26',
      thickness: 2,
      symmetry: { sectors: 8, reflect: false },
      p0: { x: 120, y: 120 },
      p1: { x: 120, y: 40 },
    },
  ];

  // Initial render builds base cache once
  renderWithFrameCache(cache, surfaceCached, '#2A1812', ops, null, {});
  assert.equal(cache.fullRebuilds, 1);
  assert.equal(cache.cacheHits, 0);

  // Two consecutive preview drags reuse the committed base without rebuilding
  const preview1: DrawOperation = {
    id: 'preview',
    kind: 'line',
    color: '#D64531',
    thickness: 2,
    symmetry: { sectors: 8, reflect: true },
    p0: { x: 120, y: 120 },
    p1: { x: 165, y: 75 },
  };
  renderWithFrameCache(cache, surfaceCached, '#2A1812', ops, preview1, {});
  assert.equal(cache.fullRebuilds, 1);
  assert.equal(cache.cacheHits, 1);

  const preview2: DrawOperation = {
    ...preview1,
    p1: { x: 185, y: 95 },
  };
  renderWithFrameCache(cache, surfaceCached, '#2A1812', ops, preview2, {});
  assert.equal(cache.fullRebuilds, 1);
  assert.equal(cache.cacheHits, 2);

  // Pixel-identical to full renderScene with preview2
  renderScene(surfaceDirect, '#2A1812', ops, preview2, {});
  assert.deepEqual(surfaceCached.data, surfaceDirect.data);

  // Changing background invalidates cache and triggers a clean rebuild
  renderWithFrameCache(cache, surfaceCached, '#7A3222', ops, null, {});
  assert.equal(cache.fullRebuilds, 2);
});

test('draftStorage persists, recovers, rejects corrupt JSON, and clears autosaved drafts', () => {
  const store = new Map<string, string>();
  const adapter: StorageAdapter = {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };

  const payload: AlponaDraftPayload = {
    version: 1,
    savedAt: 1730000000000,
    surfaceId: 'terracotta',
    symmetry: { sectors: 12, reflect: true },
    lineAlgorithm: 'bresenham',
    clippingWindow: {
      enabled: false,
      inset: 72,
      algorithm: 'cohen-sutherland',
      polygonAlgorithm: 'sutherland-hodgman',
    },
    transform2D: { ...DEFAULT_TRANSFORM_2D },
    operations: [
      {
        id: 'draft-op-1',
        kind: 'circle',
        color: '#FAF6EE',
        thickness: 2,
        symmetry: { sectors: 12, reflect: true },
        center: { x: 360, y: 200 },
        radius: 40,
        group: 'Core',
      },
    ],
  };

  assert.equal(saveDraftToStorage(adapter, payload), true);
  const loaded = loadDraftFromStorage(adapter);
  assert.ok(loaded);
  assert.equal(loaded.surfaceId, 'terracotta');
  assert.equal(loaded.symmetry.sectors, 12);
  assert.equal(loaded.operations.length, 1);
  assert.equal(loaded.operations[0].group, 'Core');

  // Corrupt JSON fails gracefully as null
  adapter.setItem('alpona-studio-autosave-v1', '{bad-json');
  assert.equal(loadDraftFromStorage(adapter), null);

  // Clearing removes the draft
  saveDraftToStorage(adapter, payload);
  clearDraftFromStorage(adapter);
  assert.equal(loadDraftFromStorage(adapter), null);
});

test('Stylus pressure scaling and resampled pressure arrays preserve natural taper kinematics', () => {
  // Neutral 0.5 pressure matches computeRicePasteTaperThickness exactly
  const base = 4;
  for (const u of [0, 0.25, 0.5, 0.8, 1]) {
    assert.equal(
      computePressureTaperThickness(base, u, 0.5, true),
      computeRicePasteTaperThickness(base, u)
    );
  }

  // Light vs heavy stylus pressure modulates mid-stroke width
  const light = computePressureTaperThickness(4, 0.5, 0.15, true);
  const heavy = computePressureTaperThickness(4, 0.5, 0.95, true);
  assert.ok(heavy > light, `expected heavy (${heavy}) > light (${light})`);

  // Resampling pressures preserves length and endpoints
  const resampled = resamplePressuresForStabilized([0.2, 0.8, 0.5], 5);
  assert.equal(resampled.length, 5);
  assert.ok(Math.abs(resampled[0] - 0.2) < 1e-6);
  assert.ok(Math.abs(resampled[4] - 0.5) < 1e-6);
});

test('Named layer groups and post-placement Cubic Bézier handle updates work immutably', () => {
  const ops: DrawOperation[] = [
    {
      id: 'op-core',
      kind: 'circle',
      color: '#FAF6EE',
      thickness: 2,
      symmetry: { sectors: 8, reflect: true },
      center: { x: 360, y: 360 },
      radius: 40,
      group: 'Core',
    },
    {
      id: 'op-kalka',
      kind: 'bezier',
      color: '#D99B26',
      thickness: 2,
      symmetry: { sectors: 8, reflect: true },
      p0: { x: 360, y: 260 },
      p1: { x: 390, y: 210 },
      p2: { x: 420, y: 240 },
      p3: { x: 360, y: 170 },
      group: 'Petals',
    },
  ];

  // Group listing & assignment
  const groups = listOperationGroups(ops);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, 'Core');
  assert.equal(groups[1].name, 'Petals');

  const reassigned = assignOperationGroup(ops, 'op-kalka', 'Border');
  assert.equal(reassigned[1].group, 'Border');
  assert.equal(ops[1].group, 'Petals'); // immutable

  // Toggle group visibility hides and restores all members of a named group
  const hiddenPetals = toggleGroupVisibility(ops, 'Petals');
  assert.equal(hiddenPetals[1].hidden, true);
  assert.equal(Boolean(hiddenPetals[0].hidden), false);
  const restoredPetals = toggleGroupVisibility(hiddenPetals, 'Petals');
  assert.equal(restoredPetals[1].hidden, false);

  // Nearest Bézier lookup & P1 handle update
  const nearest = findNearestBezierOp(ops, { x: 392, y: 214 }, 720);
  assert.equal(nearest?.id, 'op-kalka');

  const edited = updateBezierControlPoint(ops, 'op-kalka', 'p1', { x: 425, y: 185 });
  const updatedOp = edited[1];
  assert.equal(updatedOp.kind, 'bezier');
  if (updatedOp.kind === 'bezier') {
    assert.deepEqual(updatedOp.p1, { x: 425, y: 185 });
    assert.deepEqual(updatedOp.p0, { x: 360, y: 260 });
  }
});

test('Per-layer opacity composites uniformly via Porter-Duff Source-Over and emits SVG stroke-opacity', () => {
  const surf = createSurface(120, 120);
  const ops: DrawOperation[] = [
    {
      id: 'semi-line',
      kind: 'line',
      p0: { x: 20, y: 60 },
      p1: { x: 100, y: 60 },
      color: '#FFFFFF',
      thickness: 4,
      opacity: 0.5,
      symmetry: { sectors: 1, reflect: false },
    },
  ];
  renderScene(surf, '#000000', ops);
  const [r, g, b, a] = getPixel(surf, 60, 60);
  // Uniform 50% white over black must stay ~128 without brush-stamp double darkening
  assert.ok(r >= 120 && r <= 136, `Expected ~128 R channel, got ${r}`);
  assert.equal(r, g);
  assert.equal(g, b);
  assert.equal(a, 255);

  const svg = generateAlponaSvg(ops, CANVAS_SURFACES[0], 120, {});
  assert.ok(
    svg.includes('stroke-opacity="0.5"'),
    'SVG export must preserve per-layer stroke-opacity'
  );
});

test('Layer lock protection guards recolor, delete, opacity, Bezier edit, transform, and eraser hit-test', () => {
  const ops: DrawOperation[] = [
    {
      id: 'ring-1',
      kind: 'circle',
      center: { x: 360, y: 360 },
      radius: 100,
      color: '#FAF8F2',
      thickness: 3,
      symmetry: { sectors: 1, reflect: false },
    },
    {
      id: 'bez-1',
      kind: 'bezier',
      p0: { x: 360, y: 200 },
      p1: { x: 400, y: 180 },
      p2: { x: 440, y: 220 },
      p3: { x: 360, y: 260 },
      color: '#DC2626',
      thickness: 3,
      symmetry: { sectors: 1, reflect: false },
    },
  ];

  const locked = toggleOperationLock(ops, 'bez-1');
  assert.equal(locked[1].locked, true);

  // Recolor, delete, opacity, Bezier control-point edit, and translate are all blocked on locked layer
  assert.equal(recolorOperation(locked, 'bez-1', '#F59E0B')[1].color, '#DC2626');
  assert.equal(deleteOperationById(locked, 'bez-1').length, 2);
  assert.equal(setOperationOpacity(locked, 'bez-1', 0.3)[1].opacity, undefined);
  const bezCheck = updateBezierControlPoint(locked, 'bez-1', 'p1', { x: 500, y: 100 })[1];
  assert.equal(bezCheck.kind, 'bezier');
  if (bezCheck.kind === 'bezier') {
    assert.deepEqual(bezCheck.p1, { x: 400, y: 180 });
  }
  const translated = translateOperation(locked[1], 40, 40);
  assert.deepEqual(translated, locked[1]);

  // Stroke eraser hit-test with skipLocked=true ignores locked layer
  const hitSkip = hitTestOperationAtPoint(locked, { x: 360, y: 200 }, 720, 14, true);
  assert.equal(hitSkip, null);
  const hitInclude = hitTestOperationAtPoint(locked, { x: 360, y: 200 }, 720, 14, false);
  assert.equal(hitInclude?.id, 'bez-1');

  // Unlocking restores opacity and delete
  const unlocked = toggleOperationLock(locked, 'bez-1');
  const faded = setOperationOpacity(unlocked, 'bez-1', 0.45);
  assert.ok(Math.abs((faded[1].opacity ?? 1) - 0.45) < 1e-6);
  assert.equal(deleteOperationById(faded, 'bez-1').length, 1);
});

test('Universal layerTransform computes bounds and moves, scales, and rotates all primitives', () => {
  const circleOp: DrawOperation = {
    id: 'c-1',
    kind: 'circle',
    center: { x: 360, y: 240 },
    radius: 40,
    color: '#FAF8F2',
    thickness: 3,
    symmetry: { sectors: 8, reflect: true },
  };
  const bounds = computeOperationBounds(circleOp);
  assert.equal(bounds.cx, 360);
  assert.equal(bounds.cy, 240);
  assert.equal(bounds.width, 80);

  const moved = translateOperation(circleOp, 25, -15);
  assert.equal(moved.kind, 'circle');
  if (moved.kind === 'circle') {
    assert.deepEqual(moved.center, { x: 385, y: 225 });
  }

  const scaled = scaleOperationAroundPoint(circleOp, 1.5, { x: 360, y: 240 });
  assert.equal(scaled.kind, 'circle');
  if (scaled.kind === 'circle') {
    assert.equal(scaled.radius, 60);
  }

  const lineOp: DrawOperation = {
    id: 'l-1',
    kind: 'line',
    p0: { x: 400, y: 360 },
    p1: { x: 460, y: 360 },
    color: '#DC2626',
    thickness: 2,
    symmetry: { sectors: 4, reflect: false },
  };
  const rotated = rotateOperationAroundPoint(lineOp, Math.PI / 2, { x: 430, y: 360 });
  assert.equal(rotated.kind, 'line');
  if (rotated.kind === 'line') {
    assert.ok(Math.abs(rotated.p0.x - 430) < 1e-6);
    assert.ok(Math.abs(rotated.p0.y - 330) < 1e-6);
    assert.ok(Math.abs(rotated.p1.x - 430) < 1e-6);
    assert.ok(Math.abs(rotated.p1.y - 390) < 1e-6);
  }

  const stack = replaceOperationInStack([circleOp, lineOp], moved);
  assert.equal(stack[0].kind, 'circle');
  if (stack[0].kind === 'circle') {
    assert.equal(stack[0].center.x, 385);
  }
});

test('Multi-touch pinch-to-zoom, pan delta, and quick two-finger tap undo detection stay accurate', () => {
  const pinch = computePinchGesture(
    { x: 100, y: 200 },
    { x: 200, y: 200 },
    { x: 60, y: 220 },
    { x: 260, y: 220 }
  );
  assert.ok(Math.abs(pinch.scaleRatio - 2.0) < 1e-6);
  assert.equal(pinch.midpointDeltaX, 10);
  assert.equal(pinch.midpointDeltaY, 20);
  assert.deepEqual(pinch.midpoint, { x: 160, y: 220 });

  assert.equal(isTwoFingerQuickTap(140, 6.2), true);
  assert.equal(isTwoFingerQuickTap(360, 2.0), false);
  assert.equal(isTwoFingerQuickTap(120, 22.0), false);
});

test('Multi-project Gallery CRUD lifecycle & CommittedFrameCache 720->1440 HD resolution rebuild', async () => {
  const backend = createMemoryGalleryBackend();
  const basePayload: AlponaDraftPayload = {
    version: 1,
    savedAt: 1730000000000,
    surfaceId: CANVAS_SURFACES[0].id,
    symmetry: { sectors: 8, reflect: true },
    lineAlgorithm: 'bresenham',
    clippingWindow: {
      enabled: false,
      inset: 110,
      algorithm: 'cohen-sutherland',
      polygonAlgorithm: 'weiler-atherton',
    },
    transform2D: { ...DEFAULT_TRANSFORM_2D },
    operations: ALPONA_MOTIFS[0].buildOperations(720),
  };

  const savedA = await saveGalleryProject(backend, {
    id: 'p-1',
    name: 'Pohela Boishakh Lotus',
    thumbnailDataUrl: 'data:image/png;base64,AAAA',
    payload: basePayload,
  });
  const savedB = await saveGalleryProject(backend, {
    id: 'p-2',
    name: 'Saraswati Kalka',
    thumbnailDataUrl: 'data:image/png;base64,BBBB',
    payload: { ...basePayload, surfaceId: 'terracotta' },
  });
  assert.equal(savedA.strokesCount, basePayload.operations.length);
  assert.equal(savedB.surfaceId, 'terracotta');

  const renamed = await renameGalleryProject(backend, 'p-1', 'Boishakh Padma Final');
  assert.equal(renamed?.name, 'Boishakh Padma Final');

  const list = await listGalleryProjects(backend);
  assert.equal(list.length, 2);

  await deleteGalleryProject(backend, 'p-2');
  const afterDelete = await listGalleryProjects(backend);
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, 'p-1');

  // CommittedFrameCache cleanly rebuilds when toggling 1x (160) -> 2x HD (320)
  const cache = createCommittedFrameCache();
  const sdOps = ALPONA_MOTIFS[0].buildOperations(160);
  const hdOps = scaleOperations(sdOps, 2);
  const sdSurf = createSurface(160, 160);
  const hdSurf = createSurface(320, 320);

  renderWithFrameCache(cache, sdSurf, '#1F1F23', sdOps, null, {});
  assert.equal(cache.fullRebuilds, 1);
  renderWithFrameCache(cache, hdSurf, '#1F1F23', hdOps, null, scaleRenderOptions({}, 2));
  assert.equal(cache.fullRebuilds, 2);
});

test('46. Horizontal & Vertical Mirror Flip pipeline, frameCache invalidation, SVG/JSON persistence, and per-layer mirrorOperation', () => {
  // 1. 3x3 homogeneous reflection matrix
  const mx = mat3Reflect(true, false);
  const my = mat3Reflect(false, true);
  const mxy = mat3Reflect(true, true);
  assert.deepEqual(mx, [-1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepEqual(my, [1, 0, 0, 0, -1, 0, 0, 0, 1]);
  assert.deepEqual(mxy, [-1, 0, 0, 0, -1, 0, 0, 0, 1]);

  const center = { x: 100, y: 100 };
  const cfgFlipX = { ...DEFAULT_TRANSFORM_2D, flipX: true };
  const cfgFlipY = { ...DEFAULT_TRANSFORM_2D, flipY: true };
  assert.equal(isIdentityTransform2D(DEFAULT_TRANSFORM_2D), true);
  assert.equal(isIdentityTransform2D(cfgFlipX), false);
  assert.equal(isIdentityTransform2D(cfgFlipY), false);

  const pt = { x: 130, y: 70 };
  const rx = applyMat3(buildHomogeneousTransform2D(cfgFlipX, center), pt);
  assert.ok(Math.abs(rx.x - 70) < 1e-6 && Math.abs(rx.y - 70) < 1e-6);

  const ry = applyMat3(buildHomogeneousTransform2D(cfgFlipY, center), pt);
  assert.ok(Math.abs(ry.x - 130) < 1e-6 && Math.abs(ry.y - 130) < 1e-6);

  // 2. Framebuffer cache invalidates immediately when toggling flipX/flipY and reflects pixels
  const asymOp: DrawOperation = {
    id: 'asym-line',
    kind: 'line',
    p0: { x: 20, y: 20 },
    p1: { x: 40, y: 20 },
    color: '#FAF8F2',
    thickness: 3,
    symmetry: { sectors: 1, reflect: false },
  };
  const surfA = createSurface(100, 100);
  const cache = createCommittedFrameCache();
  renderWithFrameCache(cache, surfA, '#16161B', [asymOp], null, {
    transform2D: DEFAULT_TRANSFORM_2D,
  });
  assert.equal(cache.fullRebuilds, 1);
  // Pixel at (30, 20) lit; mirrored pixel at (70, 20) dark
  assert.ok(surfA.data[(20 * 100 + 30) * 4] > 200);
  assert.ok(surfA.data[(20 * 100 + 70) * 4] < 60);

  renderWithFrameCache(cache, surfA, '#16161B', [asymOp], null, {
    transform2D: cfgFlipX,
  });
  assert.equal(cache.fullRebuilds, 2);
  // After Horizontal Mirror around x=50, (70, 20) is lit and (30, 20) is dark
  assert.ok(surfA.data[(20 * 100 + 70) * 4] > 200);
  assert.ok(surfA.data[(20 * 100 + 30) * 4] < 60);

  renderWithFrameCache(cache, surfA, '#16161B', [asymOp], null, {
    transform2D: cfgFlipY,
  });
  assert.equal(cache.fullRebuilds, 3);
  // After Vertical Mirror around y=50, (30, 80) is lit and (30, 20) is dark
  assert.ok(surfA.data[(80 * 100 + 30) * 4] > 200);
  assert.ok(surfA.data[(20 * 100 + 30) * 4] < 60);

  // 3. SVG export honors flipX reflection
  const svgFlipped = generateAlponaSvg([asymOp], CANVAS_SURFACES[0], 100, {
    transform2D: cfgFlipX,
  });
  assert.ok(svgFlipped.includes('x1="80"') && svgFlipped.includes('x2="60"'));

  // 4. Project file & draft persistence preserve flipX / flipY
  const serialized = serializeAlponaProject({
    surfaceId: 'courtyard',
    symmetry: { sectors: 8, reflect: true },
    lineAlgorithm: 'bresenham',
    clippingWindow: { enabled: false, inset: 110, algorithm: 'cohen-sutherland' },
    transform2D: { ...DEFAULT_TRANSFORM_2D, flipX: true, flipY: true },
    operations: [asymOp],
  });
  const parsedProject = parseAlponaProject(serialized);
  assert.equal(parsedProject.transform2D.flipX, true);
  assert.equal(parsedProject.transform2D.flipY, true);

  // 5. Per-layer mirrorOperation across primitives + locked layer guard
  const lineH = mirrorOperation(asymOp, 'horizontal', { x: 50, y: 50 });
  assert.equal(lineH.kind, 'line');
  if (lineH.kind === 'line') {
    assert.equal(lineH.p0.x, 80);
    assert.equal(lineH.p1.x, 60);
    assert.equal(lineH.p0.y, 20);
  }
  const lineV = mirrorOperation(asymOp, 'vertical', { x: 50, y: 50 });
  if (lineV.kind === 'line') {
    assert.equal(lineV.p0.x, 20);
    assert.equal(lineV.p0.y, 80);
  }

  const bezOp: DrawOperation = {
    id: 'bez-mirror',
    kind: 'bezier',
    p0: { x: 400, y: 200 },
    p1: { x: 440, y: 180 },
    p2: { x: 480, y: 220 },
    p3: { x: 420, y: 260 },
    color: '#F59E0B',
    thickness: 3,
    symmetry: { sectors: 1, reflect: false },
  };
  const bezH = mirrorOperation(bezOp, 'horizontal', { x: 360, y: 360 });
  if (bezH.kind === 'bezier') {
    assert.equal(bezH.p0.x, 320);
    assert.equal(bezH.p1.x, 280);
    assert.equal(bezH.p2.x, 240);
    assert.equal(bezH.p3.x, 300);
    assert.equal(bezH.p0.y, 200);
  }

  // Locked layer remains strictly unchanged
  const lockedOp: DrawOperation = { ...asymOp, locked: true };
  const lockedMirrored = mirrorOperation(lockedOp, 'horizontal', { x: 50, y: 50 });
  assert.deepEqual(lockedMirrored, lockedOp);
});

test('47. Grouped layer stack categories, deterministic group accents, and collapse/expand state transitions', () => {
  const motifOps = ALPONA_MOTIFS[0].buildOperations(720);
  // Padma Lotus has Core (bottom), Petals (middle), Border (top)
  const sections = groupOperationsByCategory(motifOps);
  assert.deepEqual(
    sections.map((s) => s.name),
    ['Border', 'Petals', 'Core']
  );

  // Each group has distinct visual accent colors and accurate counts
  const accents = new Set(sections.map((s) => s.accentHex));
  assert.equal(accents.size, 3);
  assert.equal(getLayerGroupAccent('Core'), '#B91C1C');
  assert.equal(getLayerGroupAccent('Petals'), '#D97706');
  assert.equal(getLayerGroupAccent('Border'), '#2563EB');
  assert.equal(getLayerGroupAccent('Motifs'), '#15803D');
  assert.equal(getLayerGroupAccent('CustomRing'), getLayerGroupAccent('CustomRing'));

  // Entries inside each section are ordered top-most z-index descending
  for (const sec of sections) {
    assert.equal(sec.total, sec.entries.length);
    for (let i = 1; i < sec.entries.length; i++) {
      assert.ok(sec.entries[i - 1].index > sec.entries[i].index);
    }
  }

  // Filter returns only matching category
  const petalsOnly = groupOperationsByCategory(motifOps, 'Petals');
  assert.equal(petalsOnly.length, 1);
  assert.equal(petalsOnly[0].name, 'Petals');

  // Collapse / expand state transitions
  const names = sections.map((s) => s.name);
  let collapsed = new Set<string>();
  assert.equal(areAllGroupsCollapsed(collapsed, names), false);

  collapsed = toggleGroupCollapsed(collapsed, 'Border');
  assert.equal(collapsed.has('Border'), true);
  assert.equal(areAllGroupsCollapsed(collapsed, names), false);

  collapsed = toggleGroupCollapsed(collapsed, 'Border');
  assert.equal(collapsed.has('Border'), false);

  collapsed = setAllGroupsCollapsed(names, true);
  assert.equal(areAllGroupsCollapsed(collapsed, names), true);

  collapsed = setAllGroupsCollapsed(names, false);
  assert.equal(collapsed.size, 0);
  assert.equal(areAllGroupsCollapsed(collapsed, names), false);
});

test('48. Group Select tool (selectGroupAtPoint) selects all same-group operations across symmetric copies and ignores hidden strokes', () => {
  const size = 720;
  const motifOps = ALPONA_MOTIFS[0].buildOperations(size);

  // Padma Lotus outer Border ring has radius ~315 (at x=360+315=675, y=360)
  const borderIds = getOperationIdsInGroup(motifOps, 'Border');
  assert.ok(borderIds.length >= 2);
  const borderHit = selectGroupAtPoint(motifOps, { x: 360 + 315, y: 360 }, size, 22);
  assert.ok(borderHit !== null);
  assert.equal(borderHit.groupName, 'Border');
  assert.equal(borderHit.accentHex, '#2563EB');
  assert.deepEqual(borderHit.operationIds, borderIds);

  // Custom stack verifying symmetric-copy hit, hidden-layer skip, default "Motifs" normalization, and miss
  const customOps: DrawOperation[] = [
    {
      id: 'core-ring',
      kind: 'circle',
      center: { x: 360, y: 360 },
      radius: 50,
      color: '#FAF8F2',
      thickness: 3,
      symmetry: { sectors: 1, reflect: false },
      group: 'Core',
    },
    {
      id: 'motif-untagged-1',
      kind: 'circle',
      center: { x: 360, y: 360 },
      radius: 220,
      color: '#F59E0B',
      thickness: 3,
      symmetry: { sectors: 1, reflect: false },
    },
    {
      id: 'motif-untagged-2',
      kind: 'line',
      p0: { x: 360, y: 140 },
      p1: { x: 360, y: 180 },
      color: '#F59E0B',
      thickness: 3,
      symmetry: { sectors: 4, reflect: false },
      group: '  ',
    },
    {
      id: 'hidden-overlay',
      kind: 'circle',
      center: { x: 360, y: 360 },
      radius: 50,
      color: '#DC2626',
      thickness: 4,
      symmetry: { sectors: 1, reflect: false },
      group: 'Petals',
      hidden: true,
    },
  ];

  // Clicking 90-degree rotated copy of motif-untagged-2 at (560, 360) selects BOTH Motifs operations
  const symHit = selectGroupAtPoint(customOps, { x: 560, y: 360 }, size, 18);
  assert.ok(symHit !== null);
  assert.equal(symHit.groupName, 'Motifs');
  assert.equal(symHit.hitOperationId, 'motif-untagged-2');
  assert.deepEqual(symHit.operationIds, ['motif-untagged-1', 'motif-untagged-2']);

  // Clicking inner ring skips hidden Petals stroke and selects Core
  const coreHit = selectGroupAtPoint(customOps, { x: 410, y: 360 }, size, 18);
  assert.ok(coreHit !== null);
  assert.equal(coreHit.groupName, 'Core');
  assert.deepEqual(coreHit.operationIds, ['core-ring']);

  // Clicking empty corner returns null
  const miss = selectGroupAtPoint(customOps, { x: 18, y: 18 }, size, 18);
  assert.equal(miss, null);
});



