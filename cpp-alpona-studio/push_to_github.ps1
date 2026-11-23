# Multi-cycle Git commit & push script (40 Alternating CSE 401/402 Cycles - PowerShell)
# Repository: https://github.com/ShimulCoding/Alphona
# Odd Cycles  (1, 3, 5, ..., 37, 39): ShimulCoding <shimulc17@gmail.com>
# Even Cycles (2, 4, 6, ..., 38, 40): dipro20debnath <diprodebnath200@gmail.com>
#
# Run from the project root directory:
#   powershell -ExecutionPolicy Bypass -File cpp-alpona-studio\push_to_github.ps1

param(
  [string]$RepoUrl = "https://github.com/ShimulCoding/Alphona.git",
  [switch]$Force,
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"
$ShimulName  = "ShimulCoding"
$ShimulEmail = "shimulc17@gmail.com"
$DiproName   = "dipro20debnath"
$DiproEmail  = "diprodebnath200@gmail.com"

if ($Force -and (Test-Path ".git")) {
  Remove-Item -Recurse -Force ".git"
}

if (-not (Test-Path ".git")) {
  git init -b main
}

git config user.name $ShimulName
git config user.email $ShimulEmail

$existingRemote = git remote 2>$null
if ($existingRemote -contains "origin") {
  git remote set-url origin $RepoUrl
} else {
  git remote add origin $RepoUrl
}

function Add-IfExists {
  param([string[]]$Paths)
  foreach ($p in $Paths) {
    if (Test-Path $p) {
      git add $p
    }
  }
}

function Commit-As {
  param(
    [string]$Name,
    [string]$Email,
    [string]$Message
  )
  $env:GIT_AUTHOR_NAME     = $Name
  $env:GIT_AUTHOR_EMAIL    = $Email
  $env:GIT_COMMITTER_NAME  = $Name
  $env:GIT_COMMITTER_EMAIL = $Email
  git commit -m $Message
}

Copy-Item -Force "cpp-alpona-studio\README.md" "README.md"

# Cycle 1 (ShimulCoding)
Add-IfExists @(
  ".gitignore", ".env.example",
  "cpp-alpona-studio/Makefile", "cpp-alpona-studio/AlponaStudio.cbp",
  "cpp-alpona-studio/include/canvas_buffer.h",
  "cpp-alpona-studio/include/rasterizer.h", "cpp-alpona-studio/src/rasterizer.cpp",
  "src/graphics/types.ts", "src/graphics/rasterizer.ts"
)
Commit-As $ShimulName $ShimulEmail "Cycle 1: Set up Alpona Studio project with Bresenham, DDA & midpoint circle rasterizers`n`nImplement custom integer Bresenham line, DDA line, concave star petal polygon builder, midpoint circle, and step-by-step tracers (CLO-1/2)."

# Cycle 2 (dipro20debnath)
Add-IfExists @(
  "cpp-alpona-studio/include/transforms.h", "cpp-alpona-studio/src/transforms.cpp",
  "src/graphics/transforms.ts", "src/graphics/colorModels.ts", "src/graphics/engine.ts"
)
Commit-As $DiproName $DiproEmail "Cycle 2: Add 2D symmetry, 3x3 homogeneous transforms, color models & Weiler-Atherton clipping`n`nSupport C_n/D_n symmetry, Mat3 + inverse, RGB/HSV/CMYK, Cohen-Sutherland, Liang-Barsky, Sutherland-Hodgman & Weiler-Atherton concave clipping."

# Cycle 3 (ShimulCoding)
Add-IfExists @(
  "cpp-alpona-studio/include/floodfill.h", "cpp-alpona-studio/src/floodfill.cpp",
  "cpp-alpona-studio/include/motifs.h", "cpp-alpona-studio/src/motifs.cpp",
  "cpp-alpona-studio/include/png_writer.h",
  "src/graphics/floodfill.ts", "src/graphics/motifs.ts", "src/graphics/exportCard.ts"
)
Commit-As $ShimulName $ShimulEmail "Cycle 3: Implement iterative seed fill, Bengali Alpona motifs & stencil PNG export`n`nAdd non-recursive span seed fill, four Alpona starter motifs, standalone PNG export, and printable B&W stencil extraction."

# Cycle 4 (dipro20debnath)
Add-IfExists @("cpp-alpona-studio/src/main.cpp")
Commit-As $DiproName $DiproEmail "Cycle 4: Complete FreeGLUT desktop canvas window`n`nAdd interactive FreeGLUT desktop window with undo/redo, live guides, and PNG export."

# Cycle 5 (ShimulCoding)
Add-IfExists @(
  "index.html", "metadata.json", "package.json", "tsconfig.json", "vite.config.ts",
  "favicon.ico", "public/favicon.ico",
  "src/main.tsx", "src/index.css", "src/App.tsx",
  "src/graphics/projectFile.ts",
  "src/components/HeaderBar.tsx", "src/components/AlponaCanvas.tsx",
  "src/components/ControlDeck.tsx"
)
Commit-As $ShimulName $ShimulEmail "Cycle 5: Build Studio UI, Concave Star clipping controls, .alpona.json Save/Load & Timelapse Replay`n`nAdd Studio canvas, Diamond & Concave Star polygon shapes, Weiler-Atherton toggle, timelapse replay, Printable Stencil export & .alpona.json Save/Load."

# Cycle 6 (dipro20debnath)
Add-IfExists @(
  "cpp-alpona-studio/include/image_processing.h", "cpp-alpona-studio/src/image_processing.cpp",
  "src/graphics/imageProcessing.ts", "src/components/ImageLabView.tsx"
)
Commit-As $DiproName $DiproEmail "Cycle 6: Add Image Lab, 2D FFT, Photo-to-Stencil, Pixel Relationships & Binary Morphology (CLO-6)`n`nImplement point ops, histogram equalization, 3x3 spatial convolution, 2D Radix-2 FFT filters, photo upload to Printable Stencil, Week 13 N_4/N_8/D_4/D_8/D_e pixel inspector, and Binary Morphology Flood-Gap Sealer."

# Cycle 7 (ShimulCoding)
Add-IfExists @(
  "cpp-alpona-studio/include/projection3d.h", "cpp-alpona-studio/src/projection3d.cpp",
  "src/graphics/projection3d.ts", "src/components/Projection3DView.tsx"
)
Commit-As $ShimulName $ShimulEmail "Cycle 7: Add 3D Live Courtyard Floor projection, Perspective Anomalies & Z-Buffer HSR (CLO-4/5)`n`nImplement perspective-correct Live Courtyard Floor projection with diyas, Week 11 perspective presets & View Confusion (z <= -d) demo, Painter's Algorithm & Z-Buffer Depth Map."

# Cycle 8 (dipro20debnath)
Add-IfExists @(
  "src/components/PixelStepperCard.tsx", "src/components/AlgorithmsView.tsx"
)
Commit-As $DiproName $DiproEmail "Cycle 8: Add 16x Zoomed Pixel-Grid Algorithm Stepper & CLO 1-6 pipeline inspector`n`nAdd interactive 16x16 pixel grid stepper for Bresenham Line, DDA Line, and Midpoint Circle alongside the 3x3 matrix and CLO 1-6 pipeline table."

# Cycle 9 (ShimulCoding)
Add-IfExists @(
  "cpp-alpona-studio/include/bezier.h", "cpp-alpona-studio/src/bezier.cpp",
  "src/graphics/bezier.ts"
)
Commit-As $ShimulName $ShimulEmail "Cycle 9: Add Parametric Cubic Bezier, de Casteljau hull & Bengali Folk Motif Stamps`n`nImplement Cubic Bezier evaluation, de Casteljau recursive subdivision overlay, and Kalka/Shankha/Shapla/Vine symmetric motif stamps."

# Cycle 10 (dipro20debnath)
Add-IfExists @(
  "cpp-alpona-studio/include/svg_writer.h", "src/graphics/svgExport.ts",
  "src/graphics/highResExport.ts"
)
Commit-As $DiproName $DiproEmail "Cycle 10: Add Vector SVG & 4K Ultra-HD (2880x2880) Anti-Aliased PNG Exporters`n`nAdd standalone vector SVG exporters plus a 4K UHD anti-aliased PNG renderer, 300 DPI Greeting Card & Stencil exports, and 2x2 SSAA."

# Cycle 11 (ShimulCoding)
Add-IfExists @(
  "cpp-alpona-studio/include/homography.h", "cpp-alpona-studio/src/homography.cpp",
  "src/graphics/homography.ts", "src/graphics/floorBlueprint.ts",
  "src/components/FloorPrintView.tsx"
)
Commit-As $ShimulName $ShimulEmail "Cycle 11: Add Virtual Floor Try-On (3x3 Homography) & Chalk-Grid Tiled A4 Blueprint`n`nImplement 4-corner 3x3 projective homography warp onto custom floor photos (1920x1320 HD export) plus chalk compass radii, pigment volume estimates, and 300 DPI tiled A4 stencil sheets."

# Cycle 12 (dipro20debnath)
Add-IfExists @(
  "cpp-alpona-studio/include/photo_unwarper.h", "cpp-alpona-studio/src/photo_unwarper.cpp",
  "src/graphics/photoUnwarper.ts", "src/components/PhotoUnwarperPanel.tsx"
)
Commit-As $DiproName $DiproEmail "Cycle 12: Add Street-Photo Alpona Unwarper & Polar Symmetry Restorer (CLO-4/6)`n`nImplement 4-corner inverse 3x3 homography rectification, polar angular autocorrelation fold detector (4/6/8/12), D_n restoration & B&W stencil export."

# Cycle 13 (ShimulCoding)
Add-IfExists @(
  "cpp-alpona-studio/include/phong_lighting.h", "cpp-alpona-studio/src/phong_lighting.cpp",
  "src/graphics/phongLighting.ts", "src/components/DiyaLightingPanel.tsx"
)
Commit-As $ShimulName $ShimulEmail "Cycle 13: Add Interactive Phong / Gouraud Night-Courtyard Diya Lighting Studio (CLO-4/5)`n`nImplement Sobel 3x3 stroke-relief normal mapping, draggable earthen diya point lights, live Phong vs. Gouraud toggle & 1440px HD night poster export."

# Cycle 14 (dipro20debnath)
Add-IfExists @(
  "cpp-alpona-studio/include/projector_trace.h", "cpp-alpona-studio/src/projector_trace.cpp",
  "src/graphics/projectorTrace.ts", "src/components/ProjectorTracePanel.tsx"
)
Commit-As $DiproName $DiproEmail "Cycle 14: Add Darkroom Projector & Step-by-Step Ring-by-Ring Floor Tracing Mode`n`nPartition Alponas into 4 floor-chalking stages, render pitch-black darkroom guides with compass nail rings, keystone tilt warp & 2160px stage PNG export."

# Cycle 15 (ShimulCoding)
Add-IfExists @(
  "cpp-alpona-studio/include/timelapse_frames.h", "cpp-alpona-studio/src/timelapse_frames.cpp",
  "src/graphics/videoReelExport.ts"
)
Commit-As $ShimulName $ShimulEmail "Cycle 15: Add One-Click 1080p HD Timelapse Video Reel Exporter (.webm)`n`nImplement parametric 1080x1080 30fps MediaRecorder timelapse reel export with smooth de Casteljau curve growth and C++11 frame synthesis parity."

# Cycle 16 (dipro20debnath)
Add-IfExists @(
  "cpp-alpona-studio/include/frieze_border.h", "cpp-alpona-studio/src/frieze_border.cpp",
  "src/graphics/friezeBorder.ts", "src/components/FriezeBorderPanel.tsx"
)
Commit-As $DiproName $DiproEmail "Cycle 16: Add Saree Paar Border & 90-degree Anchal Corner Frieze Studio (7 Groups)`n`nImplement Polar-to-Cartesian Alpona ring unwrapping, all 7 1D Frieze symmetry groups (p1..p2mm), seamless repeating strip & 90-degree mitered corner in C++11 and TS."

# Cycle 17 (ShimulCoding)
Add-IfExists @(
  "cpp-alpona-studio/include/stencil_bridger.h", "cpp-alpona-studio/src/stencil_bridger.cpp",
  "src/graphics/stencilBridger.ts", "src/components/StencilBridgerPanel.tsx"
)
Commit-As $ShimulName $ShimulEmail "Cycle 17: Add Auto-Bridged Laser / Cricut Stencil Island Detector & Fixer (CSE 402 BFS)`n`nImplement 8-connected BFS floating island detection, shortest Euclidean (D_e) auto-bridging to zero islands, and 2-layer zero-bridge stencil split in C++11 and TS."

# Cycle 18 (dipro20debnath)
Add-IfExists @(
  "cpp-alpona-studio/include/colorway_remap.h", "cpp-alpona-studio/src/colorway_remap.cpp",
  "src/graphics/colorwayRemap.ts"
)
Commit-As $DiproName $DiproEmail "Cycle 18: Add Photo K-Means Colorway Remapper & Bengali Ritual Motif Stamps`n`nImplement deterministic RGB K-Means (k=5) palette extractor from saree/room photos, 4 Bengali festival colorways & Lokkhir Paa, Pyacha Owl, Mangal Ghat, Dhaner Shish stamps."

# Cycle 19 (ShimulCoding)
Add-IfExists @(
  "cpp-alpona-studio/include/stroke_craft.h", "cpp-alpona-studio/src/stroke_craft.cpp",
  "src/graphics/strokeCraft.ts"
)
Commit-As $ShimulName $ShimulEmail "Cycle 19: Add Chaikin Stroke Stabilizer & Tapered Rice-Paste Calligraphy Brush`n`nImplement moving-average + Chaikin corner-cutting stabilizer (levels 0..3) and arc-length tapered Chaler Guro brush in live rasterizer, 4K export & C++11."

# Cycle 20 (dipro20debnath)
Add-IfExists @(
  "cpp-alpona-studio/include/stl_stamp.h", "cpp-alpona-studio/src/stl_stamp.cpp",
  "src/graphics/stlStampExporter.ts", "src/components/StlStampPanel.tsx"
)
Commit-As $DiproName $DiproEmail "Cycle 20: Add 3D-Printable Pitha Mold & Woodblock Stamp Exporter (.STL & .OBJ)`n`nImplement 3x3 Gaussian draft-angle relief heightfield, watertight binary .STL & .OBJ mesh serialization, grip handle, and Phong preview in C++11 and TS."

# Cycle 21 (ShimulCoding)
Add-IfExists @(
  "cpp-alpona-studio/include/weave_chart.h", "cpp-alpona-studio/src/weave_chart.cpp",
  "src/graphics/weaveChart.ts", "src/components/WeaveChartPanel.tsx"
)
Commit-As $ShimulName $ShimulEmail "Cycle 21: Add Jamdani Handloom & Nakshi Kantha Weave Graph Generator`n`nImplement area-averaged warp x weft resampling, Nearest / 4x4 Bayer / Floyd-Steinberg dithering, Bengali thread palettes, thread meters & PNG/CSV export."

# Cycle 22 (dipro20debnath)
Add-IfExists @(
  "cpp-alpona-studio/include/generative_composer.h", "cpp-alpona-studio/src/generative_composer.cpp",
  "src/graphics/generativeComposer.ts"
)
Commit-As $DiproName $DiproEmail "Cycle 22: Add Procedural Lata-Pata L-System & Phyllotaxis Alpona Composer`n`nImplement deterministic 32-bit LCG Alpona composer combining Golden-Angle Phyllotaxis (137.508 deg), Polar Rhodonea Lotus rings, and L-System vine borders."

# Cycle 23 (ShimulCoding)
Add-IfExists @(
  "cpp-alpona-studio/include/natural_media.h", "cpp-alpona-studio/src/natural_media.cpp",
  "src/graphics/naturalMedia.ts", "src/components/NaturalMediaPanel.tsx"
)
Commit-As $ShimulName $ShimulEmail "Cycle 23: Add Natural Media Chaler Guro & Mati Courtyard NPR Renderer`n`nSynthesize 3-octave fBm Mati mud, asphalt, Tant cotton & Patachitra substrates with Sobel wet rice-paste impasto relief, bristle grain & 1440px PNG export."

# Cycle 24 (dipro20debnath)
Add-IfExists @(
  "cpp-alpona-studio/include/canvas_assist.h", "cpp-alpona-studio/src/canvas_assist.cpp",
  "src/graphics/canvasAssist.ts"
)
Commit-As $DiproName $DiproEmail "Cycle 24: Add Magnetic Snap-to-Axis, Guide Ring Snap & Compass Arc Lock`n`nImplement orthogonal projection onto D_n mirror lines and C_n sector rays, concentric guide ring snapping (120/240/330 px), exact axis-ring intersections & Compass Arc Lock in C++11 and TS."

# Cycle 25 (ShimulCoding)
Add-IfExists @(
  "cpp-alpona-studio/include/layer_stack.h", "cpp-alpona-studio/src/layer_stack.cpp",
  "src/graphics/layerStack.ts", "src/components/LayerStackPanel.tsx"
)
Commit-As $ShimulName $ShimulEmail "Cycle 25: Add Interactive Stroke Layer Stack & Symmetric Hit-Test Eraser`n`nAdd z-ordered stroke layer controls (visibility toggle, reorder up/down, recolor, selective delete) and symmetric Euclidean hit-test stroke eraser (E) in C++11 and TS."

# Cycle 26 (dipro20debnath)
Add-IfExists @(
  "cpp-alpona-studio/include/viewport_camera.h", "cpp-alpona-studio/src/viewport_camera.cpp",
  "src/graphics/viewportCamera.ts", "src/components/CanvasViewportBar.tsx"
)
Commit-As $DiproName $DiproEmail "Cycle 26: Add Precision Canvas Zoom (1x-4x), Space-Drag Pan & Viewport Camera`n`nImplement anchored zoom-at-point (100%-400%), Spacebar/Hand drag panning, exact screen-to-canvas coordinate inversion & CanvasViewportBar controls in C++11 and TS."

# Cycle 27 (ShimulCoding)
Add-IfExists @("src/components/ReferenceUnderlayPanel.tsx")
Commit-As $ShimulName $ShimulEmail "Cycle 27: Add Tracing Reference Photo Underlay & Alignment Controls`n`nAdd uploadable reference photo tracing underlay plus built-in Shantiniketan Lotus sketch with opacity, scale, and rotation controls kept strictly excluded from exports."

# Cycle 28 (dipro20debnath)
Add-IfExists @(
  "cpp-alpona-studio/include/frame_cache.h", "cpp-alpona-studio/src/frame_cache.cpp",
  "src/graphics/frameCache.ts"
)
Commit-As $DiproName $DiproEmail "Cycle 28: Add Committed Framebuffer Cache for 60fps Software Rasterization`n`nCache committed base RGBA pixels in C++11 and TypeScript so live pointer drag previews and Bezier handle edits reuse the base framebuffer via O(W*H) memcpy."

# Cycle 29 (ShimulCoding)
Add-IfExists @("src/graphics/draftStorage.ts", "src/components/DraftRecoveryBanner.tsx")
Commit-As $ShimulName $ShimulEmail "Cycle 29: Add Automatic localStorage Draft Persistence & Crash Recovery Banner`n`nAutosave active strokes, surface, symmetry, clipping, and transforms with a 450ms debounce and non-intrusive DraftRecoveryBanner with 1-click Reset Default."

# Cycle 30 (dipro20debnath)
Add-IfExists @("cpp-alpona-studio/src/cli_pipeline.cpp")
Commit-As $DiproName $DiproEmail "Cycle 30: Add Standalone Zero-OpenGL C++11 CLI Pipeline (AlponaCLI)`n`nExpose batch PNG, Vector SVG, Binary 3D .STL Pitha Mold/Woodblock, Jamdani Weave CSV, Frieze Border, Auto-Bridged Stencil, and Natural Media PNG exporters from CLI."

# Cycle 31 (ShimulCoding)
Add-IfExists @("src/components/BezierHandleOverlay.tsx")
Commit-As $ShimulName $ShimulEmail "Cycle 31: Add Post-Placement Cubic Bezier Handle Editor, Stylus Pressure & Named Layer Groups`n`nAdd draggable P0-P3 Bezier control handles (Edit Curves V), PointerEvent.pressure Chaler Guro scaling, named Core/Petals/Border/Motifs layer groups, and 3-Tab Studio Dock."

# Cycle 32 (dipro20debnath)
Add-IfExists @(
  "cpp-alpona-studio/include/layer_transform.h", "cpp-alpona-studio/src/layer_transform.cpp",
  "src/graphics/layerTransform.ts"
)
Commit-As $DiproName $DiproEmail "Cycle 32: Add Universal Per-Layer Transform Engine, Layer Lock & Porter-Duff Opacity`n`nImplement bounding-box Move/Scale/Rotate across all 6 primitive types in C++11 and TypeScript, Porter-Duff Source-Over per-layer opacity, and layer lock guards."

# Cycle 33 (ShimulCoding)
Add-IfExists @("src/components/LayerTransformOverlay.tsx")
Commit-As $ShimulName $ShimulEmail "Cycle 33: Add Interactive On-Canvas Universal Layer Transform Overlay`n`nAdd zoom-compensated SVG move bounding box, corner scale handle, and rotation handle with 60fps CommittedFrameCache live preview for every stroke primitive."

# Cycle 34 (dipro20debnath)
Add-IfExists @("src/graphics/touchGestures.ts")
Commit-As $DiproName $DiproEmail "Cycle 34: Add Multi-Touch Tablet Gestures (Pinch-to-Zoom, Pan & Tap Undo)`n`nImplement pure two-pointer pinch ratio, midpoint pan delta, and quick <260ms two-finger tap-to-undo detection for touchscreens and tablet styluses."

# Cycle 35 (ShimulCoding)
Add-IfExists @("src/graphics/projectGallery.ts")
Commit-As $ShimulName $ShimulEmail "Cycle 35: Add IndexedDB Multi-Project Studio Gallery Persistence Engine`n`nPersist named Alpona projects with live canvas thumbnails in IndexedDB (alpona-studio-gallery-v1) with automatic localStorage fallback and memory test backend."

# Cycle 36 (dipro20debnath)
Add-IfExists @("src/components/ProjectGalleryModal.tsx")
Commit-As $DiproName $DiproEmail "Cycle 36: Add Visual Projects Gallery Modal, 2x Retina HD Preview & Academic Lab Mode`n`nWire thumbnail Projects Gallery modal (Save/Open/Rename/Delete), live 1x 720px <-> 2x 1440px Retina software raster toggle, and Artist Mode vs. Lab Mode switch."

# Cycle 37 (ShimulCoding)
Add-IfExists @("cpp-alpona-studio/tests/test_graphics.cpp")
Commit-As $ShimulName $ShimulEmail "Cycle 37: Expand C++11 automated verification suite to 38 zero-warning tests`n`nVerify Porter-Duff Source-Over alpha blending, layer lock protection, per-layer opacity, universal layer_transform (bounds/move/scale/rotate) & full CLO 1-6."

# Cycle 38 (dipro20debnath)
Add-IfExists @("src/graphics/graphics.test.ts")
Commit-As $DiproName $DiproEmail "Cycle 38: Expand TypeScript automated verification suite to 45 passing tests`n`nVerify uniform layer opacity + SVG stroke-opacity, lock guards, universal layerTransform, multi-touch pinch/tap, IndexedDB gallery CRUD & 2x HD cache rebuild."

# Cycle 39 (ShimulCoding)
Add-IfExists @(
  "README.md", "cpp-alpona-studio/README.md",
  "src/data/cppProjectFiles.ts", "src/components/CppSourceView.tsx"
)
Commit-As $ShimulName $ShimulEmail "Cycle 39: Update C++11 source explorer & sync CSE 401/402 documentation (40 cycles)`n`nRegister layer_transform.cpp in Source Explorer and document all 40 modular alternating milestone cycles across root and module READMEs."

# Cycle 40 (dipro20debnath)
Add-IfExists @("cpp-alpona-studio/push_to_github.sh", "cpp-alpona-studio/push_to_github.ps1")
Commit-As $DiproName $DiproEmail "Cycle 40: Finalize 40-cycle alternating Bash & PowerShell GitHub push scripts`n`nSynchronize all 40 alternating Git commit cycles for ShimulCoding and dipro20debnath."

if ($NoPush) {
  Write-Host "Created 40 alternating commits (skipping push due to -NoPush)."
  exit 0
}

Write-Host "Pushing 40 alternating CSE 401/402 cycle commits to $RepoUrl ..."
if ($Force) {
  git push --force -u origin main
} else {
  git push -u origin main
}
