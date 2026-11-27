/**
 * Commercial Engine Documentation Guides ("Quick Start" & "Advanced Techniques")
 * Pure data & search/filter helper module for the non-modal PDF-style Documentation Sidebar.
 */

export type DocGuideTab = 'quick-start' | 'advanced-techniques';

export interface DocGuideStep {
  stepNumber: string;
  title: string;
  summary: string;
  specRef: string;
  commandOrShortcut?: string;
}

export interface DocGuideDocument {
  id: DocGuideTab;
  documentCode: string;
  edition: string;
  title: string;
  subtitle: string;
  pageCountLabel: string;
  readTimeLabel: string;
  abstractText: string;
  steps: DocGuideStep[];
}

export const ENGINE_DOCUMENTATION_GUIDES: Record<DocGuideTab, DocGuideDocument> = {
  'quick-start': {
    id: 'quick-start',
    documentCode: 'AGRE-MAN-101',
    edition: 'Release v1.4.2 · Rev A',
    title: 'Quick Start Reference Manual',
    subtitle:
      'Foundational 2D Radial Canvas Setup, Dihedral Symmetry, Brush Stabilization & Multi-Format Export Workflow',
    pageCountLabel: 'Pages 1–4',
    readTimeLabel: '3 min read',
    abstractText:
      'This Quick Start manual walks through launching the workspace, selecting a calibrated substrate and dihedral symmetry fold, drawing with Chaikin-stabilized brushes, and exporting production 4K PNG, Vector SVG, or C++11 desktop builds.',
    steps: [
      {
        stepNumber: '01',
        title: 'Initialize Workspace & Select a Quick-Start Template',
        summary:
          'Choose one of the four curated workspace presets from the Quick-Start Canvas bar (Padma Lotus Courtyard, Boishakhi Terracotta Sun, Shankha & Kalka Rosette, or Blank Artisan Canvas) or select one of four calibrated courtyard substrates (Slate, Red Clay, Indigo Night, Archival Paper).',
        specRef: 'CORE-1 · Substrate & Color Space Calibration',
        commandOrShortcut: 'Top Bar → Quick-Start Canvas',
      },
      {
        stepNumber: '02',
        title: 'Configure Dihedral Radial Symmetry & Magnetic Snapping',
        summary:
          'Select 4, 6, 8, 12, or 16 rotational sectors and enable Dihedral (Dn) reflection to mirror every stroke across 2n symmetry axes. Toggle Axis Snap and Ring Snap in the viewport header for exact geometric alignment along concentric guide rings.',
        specRef: 'CORE-2 · Homogeneous 2D Dihedral Group D_n',
        commandOrShortcut: 'Keys: 4 / 6 / 8 · R (Reflect) · S (Snap)',
      },
      {
        stepNumber: '03',
        title: 'Draw Primitives & Tapered Calligraphy Strokes',
        summary:
          'Switch between Freehand Brush (with Chaikin corner-cutting stabilizer levels 0–3), Bresenham/DDA Line Spokes, 8-way Midpoint Circles, Weiler-Atherton Clipped Star Polygons, Parametric Cubic Bézier curves, and 4-Connected Scanline Seed Fill.',
        specRef: 'CORE-1 & CORE-2 · Integer Raster Kernel',
        commandOrShortcut: 'Keys: F (Brush) · L (Line) · O (Circle) · P (Poly) · C (Bézier) · B (Fill)',
      },
      {
        stepNumber: '04',
        title: 'Manage Z-Ordered Stroke Layers & Local Auto-Save',
        summary:
          'Open the Layers dock tab to organize strokes into color-coded collapsible folders (Core, Petals, Border, Motifs), adjust per-layer Porter-Duff Source-Over opacity (10%–100%), or lock completed layers. Every edit automatically syncs to Local Storage within 450ms.',
        specRef: 'CORE-3 · Z-Ordered Layer Compositor & Auto-Save',
        commandOrShortcut: 'Inspector → Layers Tab · Footer Sync Indicator',
      },
      {
        stepNumber: '05',
        title: 'Export 4K Ultra-HD PNG, Vector SVG, or Launch C++11 Desktop',
        summary:
          'Click Export 4K PNG (2880×2880 px), Export SVG for infinite-resolution vector paths, or run RUN_STUDIO_WEB.bat / RUN_CPP_DESKTOP.bat (AlponaStudio.cbp → F9 in Code::Blocks) for the native 37-button C++11 OpenGL desktop application.',
        specRef: 'CORE-4 & CORE-6 · Multi-Target Production Output',
        commandOrShortcut: 'Top Bar → Export 4K PNG · Export SVG · F9 (C++11)',
      },
    ],
  },
  'advanced-techniques': {
    id: 'advanced-techniques',
    documentCode: 'AGRE-TECH-204',
    edition: 'Release v1.4.2 · Rev B',
    title: 'Advanced Techniques & Spatial Pipelines',
    subtitle:
      'On-Canvas Affine Layer Transforms, 2D Radix-2 FFT Frequency Filtering, 3D Phong BRDF Illumination & Watertight .STL Fabrication',
    pageCountLabel: 'Pages 5–9',
    readTimeLabel: '5 min read',
    abstractText:
      'This technical manual covers advanced geometric manipulation, non-photorealistic (NPR) natural media synthesis, 3×3 projective homography floor try-on, frequency-domain DSP, and 3D CAD mesh generation.',
    steps: [
      {
        stepNumber: '01',
        title: 'Universal On-Canvas Layer Transform & Cubic Bézier P0–P3 Editing',
        summary:
          'Activate the Transform tool (V) and click any stroke on canvas to reveal its zoom-compensated bounding box with Move, Corner Scale, and Rotation handles—or drag P0–P3 de Casteljau control handles live at 60fps backed by the Committed Framebuffer Cache.',
        specRef: 'CORE-2 · 3×3 Affine Transform & Framebuffer Cache',
        commandOrShortcut: 'Key: V (Transform) · Key: A (Group Select) · 2× HD Toggle',
      },
      {
        stepNumber: '02',
        title: 'Procedural L-System Composer, K-Means Colorway & Weave Charts',
        summary:
          'In the Craft dock tab, synthesize deterministic Golden-Angle Phyllotaxis (137.508°) and L-System vine borders, extract a 5-color K-Means palette from any reference photo, or quantize your artwork into a Floyd-Steinberg dithered Jamdani/Kantha weave chart (.CSV).',
        specRef: 'CORE-1 & CORE-2 · Generative Grammar & K-Means DSP',
        commandOrShortcut: 'Inspector → Craft Tab → Procedural / Colorway / Loom',
      },
      {
        stepNumber: '03',
        title: 'Image Lab: 2D Radix-2 FFT Spectrum, Morphology & Natural Media NPR',
        summary:
          'Switch to Image Lab to inspect 2D Fast Fourier Transform magnitude spectra, apply Ideal/Gaussian Low-Pass or High-Pass frequency filters, seal stroke micro-gaps via Binary Morphological Closing, or synthesize 3-octave fBm wet impasto relief.',
        specRef: 'CORE-5 & CORE-6 · Frequency DSP & Sobel Impasto NPR',
        commandOrShortcut: 'Top Nav → Image Lab → 2D FFT / Natural Media NPR',
      },
      {
        stepNumber: '04',
        title: '3D View: Z-Buffer Courtyard Turntable & Multi-Diya Phong BRDF',
        summary:
          'Open 3D View to project your 2D vector layers onto a 3D courtyard slab with adjustable Perspective vs. Orthographic projection, Depth Z-Buffer heatmap inspection, and multi-point Phong/Gouraud BRDF illumination with flickering terracotta Diya lamps.',
        specRef: 'CORE-4 & CORE-5 · 3D Projection, Z-Buffer & Phong BRDF',
        commandOrShortcut: 'Top Nav → 3D View → Courtyard 3D / Night Diya Phong',
      },
      {
        stepNumber: '05',
        title: 'Floor & Print: 4-Corner Homography Try-On, Laser Stencil & 3D .STL Mold',
        summary:
          'In Floor & Print, warp your design onto any room photograph via 3×3 Projective Homography, auto-bridge floating stencil islands via 4-connected BFS for laser cutters, or export a watertight binary 3D .STL/.OBJ relief stamp for 3D printing.',
        specRef: 'CORE-4 & CORE-6 · Projective Homography & Manifold .STL CAD',
        commandOrShortcut: 'Top Nav → Floor & Print → Export .STL / Bridged Stencil',
      },
    ],
  },
};

export function getDocumentationGuide(tab: DocGuideTab): DocGuideDocument {
  return ENGINE_DOCUMENTATION_GUIDES[tab] ?? ENGINE_DOCUMENTATION_GUIDES['quick-start'];
}

export function filterDocumentationSteps(
  tab: DocGuideTab,
  query: string
): DocGuideStep[] {
  const doc = getDocumentationGuide(tab);
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return doc.steps;
  return doc.steps.filter(
    (s) =>
      s.title.toLowerCase().includes(trimmed) ||
      s.summary.toLowerCase().includes(trimmed) ||
      s.specRef.toLowerCase().includes(trimmed) ||
      (s.commandOrShortcut &&
        s.commandOrShortcut.toLowerCase().includes(trimmed))
  );
}
