#!/usr/bin/env bash
# Multi-cycle Git commit & push script (40 Alternating CSE 401/402 Cycles)
# Repository: https://github.com/ShimulCoding/Alphona
# Odd Cycles  (1, 3, 5, ..., 37, 39): ShimulCoding <shimulc17@gmail.com>
# Even Cycles (2, 4, 6, ..., 38, 40): dipro20debnath <diprodebnath200@gmail.com>
#
# Run in GitHub Codespaces or Git Bash from the project root:
#   bash cpp-alpona-studio/push_to_github.sh --codespace

set -euo pipefail

FORCE_PUSH=""
NO_PUSH=""
REPO_URL="https://github.com/ShimulCoding/Alphona.git"

for arg in "$@"; do
  if [ "$arg" = "--codespace" ] || [ "$arg" = "--force" ]; then
    FORCE_PUSH="--force"
  elif [ "$arg" = "--no-push" ]; then
    NO_PUSH="1"
  elif [[ "$arg" == http* ]] || [[ "$arg" == git@* ]]; then
    REPO_URL="$arg"
  fi
done

SHIMUL_NAME="ShimulCoding"
SHIMUL_EMAIL="shimulc17@gmail.com"
DIPRO_NAME="dipro20debnath"
DIPRO_EMAIL="diprodebnath200@gmail.com"

if [ "$FORCE_PUSH" = "--force" ] && [ -d ".git" ]; then
  rm -rf .git
fi

if [ ! -d ".git" ]; then
  git init -b main
fi

git config --global --add safe.directory "$(pwd)" >/dev/null 2>&1 || true
git config user.name "$SHIMUL_NAME"
git config user.email "$SHIMUL_EMAIL"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

add_if_exists() {
  for f in "$@"; do
    if [ -e "$f" ]; then
      git add "$f"
    fi
  done
}

commit_as() {
  local name="$1"
  local email="$2"
  local message="$3"
  GIT_AUTHOR_NAME="$name" \
  GIT_AUTHOR_EMAIL="$email" \
  GIT_COMMITTER_NAME="$name" \
  GIT_COMMITTER_EMAIL="$email" \
  git commit -m "$message"
}

# Keep root README.md synced with the full CSE 401/402 CLO 1-6 README
cp cpp-alpona-studio/README.md README.md

# Cycle 1 (ShimulCoding): Project setup, canvas buffer, Bresenham/DDA & Midpoint Circle + Stepper traces (CLO-1/2)
add_if_exists .gitignore .env.example \
  cpp-alpona-studio/Makefile cpp-alpona-studio/AlponaStudio.cbp \
  cpp-alpona-studio/include/canvas_buffer.h \
  cpp-alpona-studio/include/rasterizer.h cpp-alpona-studio/src/rasterizer.cpp \
  src/graphics/types.ts src/graphics/rasterizer.ts
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 1: Set up Alpona Studio project with Bresenham, DDA & midpoint circle rasterizers

Implement custom integer Bresenham line (8 octants), DDA line, concave star
petal polygon builder, midpoint circle, and step-by-step algorithm tracers
in C++11 and TypeScript (CLO-1/2)."

# Cycle 2 (dipro20debnath): 2D symmetry, 3x3 homogeneous transforms + inverse, color models & clipping (CLO-2/3/5)
add_if_exists cpp-alpona-studio/include/transforms.h cpp-alpona-studio/src/transforms.cpp \
  src/graphics/transforms.ts src/graphics/colorModels.ts src/graphics/engine.ts
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 2: Add 2D symmetry, 3x3 homogeneous transforms, color models & Weiler-Atherton clipping

Support C_n/D_n radial symmetry, 3x3 homogeneous matrix + analytic inverse,
RGB/HSV/CMYK color models, Cohen-Sutherland, Liang-Barsky, Sutherland-Hodgman,
and Weiler-Atherton concave polygon clipping (CLO-2/3/5)."

# Cycle 3 (ShimulCoding): Iterative seed fill, Bengali Alpona motifs, Greeting Card & Printable Stencil PNG export
add_if_exists cpp-alpona-studio/include/floodfill.h cpp-alpona-studio/src/floodfill.cpp \
  cpp-alpona-studio/include/motifs.h cpp-alpona-studio/src/motifs.cpp \
  cpp-alpona-studio/include/png_writer.h \
  src/graphics/floodfill.ts src/graphics/motifs.ts src/graphics/exportCard.ts
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 3: Implement iterative seed fill, Bengali Alpona motifs & stencil PNG export

Add non-recursive span seed fill with bounds checking, four traditional
Bengali Alpona starter motifs, standalone RGBA PNG export, and printable
black-and-white stencil extraction."

# Cycle 4 (dipro20debnath): OpenGL/FreeGLUT desktop canvas shell
add_if_exists cpp-alpona-studio/src/main.cpp
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 4: Complete FreeGLUT desktop canvas window

Add interactive mouse/keyboard OpenGL/FreeGLUT application with undo/redo,
live radial symmetry guides, motif loading, and PNG export."

# Cycle 5 (ShimulCoding): Interactive Alpona Studio web interface, .alpona.json Save/Load & Timelapse Replay
add_if_exists index.html metadata.json package.json tsconfig.json vite.config.ts \
  favicon.ico public/favicon.ico \
  src/main.tsx src/index.css src/App.tsx \
  src/graphics/projectFile.ts \
  src/components/HeaderBar.tsx src/components/AlponaCanvas.tsx \
  src/components/ControlDeck.tsx
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 5: Build Studio UI, Concave Star clipping controls, .alpona.json Save/Load & Timelapse Replay

Add interactive Studio canvas with Diamond & Concave Star polygon shapes,
Sutherland-Hodgman vs. Weiler-Atherton clipping toggle, animated stroke
timelapse replay, Printable Stencil export, and .alpona.json Save/Load."

# Cycle 6 (dipro20debnath): CLO-6 Image Processing, 2D FFT, Photo-to-Stencil, Pixel Relationships & Binary Morphology
add_if_exists cpp-alpona-studio/include/image_processing.h cpp-alpona-studio/src/image_processing.cpp \
  src/graphics/imageProcessing.ts src/components/ImageLabView.tsx
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 6: Add Image Lab, 2D FFT, Photo-to-Stencil, Pixel Relationships & Binary Morphology (CLO-6)

Implement gray-level point processing, 256-bin histogram & CDF equalization,
3x3 spatial convolution, 2D Radix-2 FFT filters, photo upload to Printable
Stencil, Week 13 N_4/N_8/D_4/D_8/D_e inspector, and Binary Morphology
Closing (Flood-Gap Sealer), Opening, Dilation & Erosion."

# Cycle 7 (ShimulCoding): CLO-4/5 3D Live Courtyard Floor Projection, Perspective Anomalies & HSR
add_if_exists cpp-alpona-studio/include/projection3d.h cpp-alpona-studio/src/projection3d.cpp \
  src/graphics/projection3d.ts src/components/Projection3DView.tsx
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 7: Add 3D Live Courtyard Floor projection, Perspective Anomalies & Z-Buffer HSR (CLO-4/5)

Implement perspective-correct texture-mapped Live Courtyard Floor projection
with terracotta corner diyas, Week 11 perspective presets & View Confusion
(z <= -d) anomaly demo, Painter's Algorithm, and software Z-Buffer Depth Map."

# Cycle 8 (dipro20debnath): CLO-2 16x Zoomed Pixel-Grid Algorithm Stepper & CLO 1-6 Matrix Inspector
add_if_exists src/components/PixelStepperCard.tsx src/components/AlgorithmsView.tsx
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 8: Add 16x Zoomed Pixel-Grid Algorithm Stepper & CLO 1-6 pipeline inspector

Add interactive step-by-step 16x16 pixel grid visualizer for Bresenham Line,
DDA Line, and Midpoint Circle with live decision parameter readouts alongside
the 3x3 homogeneous transformation matrix and CLO 1-6 pipeline table."

# Cycle 9 (ShimulCoding): Parametric Cubic Bezier, de Casteljau Hull & Bengali Folk Motif Stamps
add_if_exists cpp-alpona-studio/include/bezier.h cpp-alpona-studio/src/bezier.cpp \
  src/graphics/bezier.ts
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 9: Add Parametric Cubic Bezier, de Casteljau hull & Bengali Folk Motif Stamps

Implement Cubic Bezier evaluation, de Casteljau recursive subdivision overlay,
and one-click Kalka Paisley, Shankha Conch, Shapla Bud & Scallop Vine stamps
in C++11 and TypeScript."

# Cycle 10 (dipro20debnath): True Infinite-Resolution Vector SVG & 4K Ultra-HD Anti-Aliased PNG Exporters
add_if_exists cpp-alpona-studio/include/svg_writer.h src/graphics/svgExport.ts src/graphics/highResExport.ts
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 10: Add Vector SVG & 4K Ultra-HD (2880x2880) Anti-Aliased PNG Exporters

Add standalone vector SVG exporters plus a 4K UHD (2880x2880) anti-aliased
PNG renderer, 300 DPI Greeting Card & Stencil exports, and 2x2 SSAA."

# Cycle 11 (ShimulCoding): 4-Corner 3x3 Projective Homography Virtual Floor Try-On & Chalk-Grid A4 Blueprint
add_if_exists cpp-alpona-studio/include/homography.h cpp-alpona-studio/src/homography.cpp \
  src/graphics/homography.ts src/graphics/floorBlueprint.ts \
  src/components/FloorPrintView.tsx
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 11: Add Virtual Floor Try-On (3x3 Homography) & Chalk-Grid Tiled A4 Blueprint

Implement 4-corner 3x3 projective homography solver (8x8 Gaussian elimination)
and inverse-perspective bilinear warp onto custom floor photos (1920x1320 HD export),
plus real-world chalk compass radii, pigment volume, and 300 DPI tiled A4 stencils."

# Cycle 12 (dipro20debnath): Street-Photo Alpona Unwarper & Polar Symmetry Restorer (CLO-4/6)
add_if_exists cpp-alpona-studio/include/photo_unwarper.h cpp-alpona-studio/src/photo_unwarper.cpp \
  src/graphics/photoUnwarper.ts src/components/PhotoUnwarperPanel.tsx
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 12: Add Street-Photo Alpona Unwarper & Polar Symmetry Restorer (CLO-4/6)

Implement 4-corner inverse 3x3 homography rectification, Polar Angular
Autocorrelation fold detection (4/6/8/12), D_n symmetry restoration for
scuffed street Alpona photos, and printable B&W stencil export in C++11 and TS."

# Cycle 13 (ShimulCoding): Interactive Phong / Gouraud Night-Courtyard Diya Lighting Studio (CLO-4/5)
add_if_exists cpp-alpona-studio/include/phong_lighting.h cpp-alpona-studio/src/phong_lighting.cpp \
  src/graphics/phongLighting.ts src/components/DiyaLightingPanel.tsx
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 13: Add Interactive Phong / Gouraud Night-Courtyard Diya Lighting Studio (CLO-4/5)

Implement Sobel 3x3 stroke-relief normal mapping, draggable earthen diya point
lights with presets, live Phong vs. Gouraud vs. Normal Map comparison, and
1440px HD Night Poster export in C++11 and TypeScript."

# Cycle 14 (dipro20debnath): Darkroom Projector & Step-by-Step Ring-by-Ring Floor Tracing Mode
add_if_exists cpp-alpona-studio/include/projector_trace.h cpp-alpona-studio/src/projector_trace.cpp \
  src/graphics/projectorTrace.ts src/components/ProjectorTracePanel.tsx
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 14: Add Darkroom Projector & Step-by-Step Ring-by-Ring Floor Tracing Mode

Partition Alponas into 4 physical floor-chalking stages, render pitch-black
darkroom tracing guides with compass nail rings, keystone tilt warp (-25..+25 deg),
fullscreen projector overlay, and 2160px stage PNG export in C++11 and TS."

# Cycle 15 (ShimulCoding): One-Click 1080p HD Timelapse Video Reel Exporter (.webm)
add_if_exists cpp-alpona-studio/include/timelapse_frames.h cpp-alpona-studio/src/timelapse_frames.cpp \
  src/graphics/videoReelExport.ts
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 15: Add One-Click 1080p HD Timelapse Video Reel Exporter (.webm)

Implement parametric 1080x1080 30fps MediaRecorder timelapse reel export with
smooth line, circle, polygon, freehand & de Casteljau Cubic Bezier growth plus
matching C++11 progressive timelapse frame synthesis."

# Cycle 16 (dipro20debnath): Saree Paar Border & 90-Degree Anchal Corner Frieze Studio (7 Groups)
add_if_exists cpp-alpona-studio/include/frieze_border.h cpp-alpona-studio/src/frieze_border.cpp \
  src/graphics/friezeBorder.ts src/components/FriezeBorderPanel.tsx
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 16: Add Saree Paar Border & 90-degree Anchal Corner Frieze Studio (7 Groups)

Implement Polar-to-Cartesian circular Alpona ring unwrapping, all 7 mathematical
1D Frieze symmetry groups (p1..p2mm), seamless repeating strip renderer, and
45-degree mitered 90-degree corner generator in C++11 and TypeScript."

# Cycle 17 (ShimulCoding): Auto-Bridged Laser / Cricut Stencil Island Detector & Fixer (CSE 402 BFS)
add_if_exists cpp-alpona-studio/include/stencil_bridger.h cpp-alpona-studio/src/stencil_bridger.cpp \
  src/graphics/stencilBridger.ts src/components/StencilBridgerPanel.tsx
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 17: Add Auto-Bridged Laser / Cricut Stencil Island Detector & Fixer (CSE 402 BFS)

Implement 8-connected BFS floating island detection, multi-source BFS shortest
Euclidean (D_e) material auto-bridging to zero floating islands, and 2-layer
zero-bridge stencil split with registration crosshairs in C++11 and TypeScript."

# Cycle 18 (dipro20debnath): Photo K-Means Colorway Remapper & Authentic Bengali Ritual Stamps
add_if_exists cpp-alpona-studio/include/colorway_remap.h cpp-alpona-studio/src/colorway_remap.cpp \
  src/graphics/colorwayRemap.ts
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 18: Add Photo K-Means Colorway Remapper & Bengali Ritual Motif Stamps

Implement deterministic RGB K-Means (k=5) palette extraction from uploaded
saree/room photos, 4 curated Bengali festival colorways, and Lokkhir Paa,
Pyacha Owl, Mangal Ghat & Dhaner Shish Cubic Bezier stamps in C++11 and TS."

# Cycle 19 (ShimulCoding): Chaikin Stroke Stabilizer & Tapered Rice-Paste Calligraphy Brush
add_if_exists cpp-alpona-studio/include/stroke_craft.h cpp-alpona-studio/src/stroke_craft.cpp \
  src/graphics/strokeCraft.ts
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 19: Add Chaikin Stroke Stabilizer & Tapered Rice-Paste Calligraphy Brush

Implement moving-average + Chaikin corner-cutting subdivision stabilizer
(levels 0..3) and arc-length tapered Chaler Guro brush across the live
pixel rasterizer, 4K UHD exporter, and C++11 engine."

# Cycle 20 (dipro20debnath): 3D-Printable Pitha Mold & Woodblock Stamp Exporter (.STL & .OBJ)
add_if_exists cpp-alpona-studio/include/stl_stamp.h cpp-alpona-studio/src/stl_stamp.cpp \
  src/graphics/stlStampExporter.ts src/components/StlStampPanel.tsx
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 20: Add 3D-Printable Pitha Mold & Woodblock Stamp Exporter (.STL & .OBJ)

Implement 3x3 Gaussian draft-angle relief heightfield, watertight binary .STL
and Wavefront .OBJ mesh serialization, optional grip handle, and software Phong
turntable preview in C++11 and TypeScript."

# Cycle 21 (ShimulCoding): Jamdani Handloom & Nakshi Kantha Weave Graph Generator
add_if_exists cpp-alpona-studio/include/weave_chart.h cpp-alpona-studio/src/weave_chart.cpp \
  src/graphics/weaveChart.ts src/components/WeaveChartPanel.tsx
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 21: Add Jamdani Handloom & Nakshi Kantha Weave Graph Generator

Implement area-averaged warp x weft grid resampling, Nearest / 4x4 Bayer /
Floyd-Steinberg dithering, curated Bengali thread palettes, thread meter
calculations, and numbered PNG + loom CSV export in C++11 and TypeScript."

# Cycle 22 (dipro20debnath): Procedural Lata-Pata L-System & Phyllotaxis Alpona Composer
add_if_exists cpp-alpona-studio/include/generative_composer.h cpp-alpona-studio/src/generative_composer.cpp \
  src/graphics/generativeComposer.ts
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 22: Add Procedural Lata-Pata L-System & Phyllotaxis Alpona Composer

Implement deterministic 32-bit LCG Alpona synthesis combining Golden-Angle
Phyllotaxis (137.508 deg), Polar Rhodonea Lotus rings, and L-System curling
Lata-Pata vine borders in C++11 and TypeScript."

# Cycle 23 (ShimulCoding): Natural Media Chaler Guro & Mati Courtyard NPR Renderer
add_if_exists cpp-alpona-studio/include/natural_media.h cpp-alpona-studio/src/natural_media.cpp \
  src/graphics/naturalMedia.ts src/components/NaturalMediaPanel.tsx
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 23: Add Natural Media Chaler Guro & Mati Courtyard NPR Renderer

Synthesize 3-octave fBm Mati mud, Ekushey street asphalt, Tant cotton, and
Patachitra paper substrates with Sobel wet rice-paste impasto relief, dry-brush
bristle grain, chalk speckle, and 1440px PNG export in C++11 and TypeScript."

# Cycle 24 (dipro20debnath): Magnetic Snap-to-Axis, Guide Ring Snap & Compass Arc Lock
add_if_exists cpp-alpona-studio/include/canvas_assist.h cpp-alpona-studio/src/canvas_assist.cpp \
  src/graphics/canvasAssist.ts
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 24: Add Magnetic Snap-to-Axis, Guide Ring Snap & Compass Arc Lock

Implement orthogonal projection onto D_n mirror lines and C_n sector rays,
concentric guide ring snapping (120/240/330 px), exact axis-ring intersections,
and constant-radius Compass Arc Lock in C++11 and TypeScript."

# Cycle 25 (ShimulCoding): Interactive Stroke Layer Stack & Symmetric Hit-Test Eraser
add_if_exists cpp-alpona-studio/include/layer_stack.h cpp-alpona-studio/src/layer_stack.cpp \
  src/graphics/layerStack.ts src/components/LayerStackPanel.tsx
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 25: Add Interactive Stroke Layer Stack & Symmetric Hit-Test Eraser

Add z-ordered stroke layer controls (visibility toggle, reorder up/down,
active-pigment recolor, selective delete) and symmetric Euclidean hit-test
stroke eraser (E) in C++11 and TypeScript."

# Cycle 26 (dipro20debnath): Precision Canvas Zoom (1x-4x), Space-Drag Pan & Viewport Camera
add_if_exists cpp-alpona-studio/include/viewport_camera.h cpp-alpona-studio/src/viewport_camera.cpp \
  src/graphics/viewportCamera.ts src/components/CanvasViewportBar.tsx
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 26: Add Precision Canvas Zoom (1x-4x), Space-Drag Pan & Viewport Camera

Implement anchored zoom-at-point (100%-400%), Spacebar/Hand drag panning,
bounded viewport clamping, exact screen-to-canvas coordinate inversion, and
CanvasViewportBar controls in C++11 and TypeScript."

# Cycle 27 (ShimulCoding): Tracing Reference Photo Underlay & Alignment Controls
add_if_exists src/components/ReferenceUnderlayPanel.tsx
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 27: Add Tracing Reference Photo Underlay & Alignment Controls

Add uploadable reference photo tracing underlay plus built-in Shantiniketan
Lotus sketch with opacity, scale, and rotation controls kept strictly excluded
from PNG/SVG/Stencil exports."

# Cycle 28 (dipro20debnath): Committed Framebuffer Cache (60fps Software Rasterization)
add_if_exists cpp-alpona-studio/include/frame_cache.h cpp-alpona-studio/src/frame_cache.cpp \
  src/graphics/frameCache.ts
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 28: Add Committed Framebuffer Cache for 60fps Software Rasterization

Cache committed base RGBA pixels in C++11 and TypeScript so live pointer drag
previews and Bezier handle edits reuse the base framebuffer via O(W*H) memcpy."

# Cycle 29 (ShimulCoding): Automatic localStorage Draft Persistence & Crash Recovery
add_if_exists src/graphics/draftStorage.ts src/components/DraftRecoveryBanner.tsx
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 29: Add Automatic localStorage Draft Persistence & Crash Recovery Banner

Autosave active strokes, surface, symmetry, clipping, and transforms with a
450ms debounce and non-intrusive DraftRecoveryBanner with 1-click Reset Default."

# Cycle 30 (dipro20debnath): Standalone Zero-OpenGL C++11 CLI Pipeline (AlponaCLI)
add_if_exists cpp-alpona-studio/src/cli_pipeline.cpp
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 30: Add Standalone Zero-OpenGL C++11 CLI Pipeline (AlponaCLI)

Expose batch PNG, Vector SVG, Binary 3D .STL Pitha Mold/Woodblock, Jamdani Weave
CSV, Frieze Border, Auto-Bridged Stencil, and Natural Media PNG exporters from CLI."

# Cycle 31 (ShimulCoding): Interactive Post-Placement Cubic Bezier Handle Editor & Artist Ergonomics
add_if_exists src/components/BezierHandleOverlay.tsx
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 31: Add Post-Placement Cubic Bezier Handle Editor, Stylus Pressure & Named Layer Groups

Add draggable P0-P3 Bezier control handles (Edit Curves V), PointerEvent.pressure
Chaler Guro scaling, named Core/Petals/Border/Motifs layer groups, and 3-Tab Studio Dock."

# Cycle 32 (dipro20debnath): Universal Per-Layer Transform Engine, Layer Lock & Porter-Duff Opacity
add_if_exists cpp-alpona-studio/include/layer_transform.h cpp-alpona-studio/src/layer_transform.cpp \
  src/graphics/layerTransform.ts
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 32: Add Universal Per-Layer Transform Engine, Layer Lock & Porter-Duff Opacity

Implement bounding-box Move/Scale/Rotate across all 6 primitive types in C++11
and TypeScript, Porter-Duff Source-Over per-layer opacity, and layer lock guards."

# Cycle 33 (ShimulCoding): Interactive On-Canvas Universal Layer Transform Overlay
add_if_exists src/components/LayerTransformOverlay.tsx
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 33: Add Interactive On-Canvas Universal Layer Transform Overlay

Add zoom-compensated SVG move bounding box, corner scale handle, and rotation
handle with 60fps CommittedFrameCache live preview for every stroke primitive."

# Cycle 34 (dipro20debnath): Multi-Touch Tablet Gestures (Pinch-to-Zoom, Pan & Two-Finger Tap Undo)
add_if_exists src/graphics/touchGestures.ts
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 34: Add Multi-Touch Tablet Gestures (Pinch-to-Zoom, Pan & Tap Undo)

Implement pure two-pointer pinch ratio, midpoint pan delta, and quick <260ms
two-finger tap-to-undo detection for touchscreens and tablet styluses."

# Cycle 35 (ShimulCoding): IndexedDB Multi-Project Studio Gallery Persistence Engine
add_if_exists src/graphics/projectGallery.ts
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 35: Add IndexedDB Multi-Project Studio Gallery Persistence Engine

Persist named Alpona projects with live canvas thumbnails in IndexedDB
(alpona-studio-gallery-v1) with automatic localStorage fallback and memory test backend."

# Cycle 36 (dipro20debnath): Visual Multi-Project Gallery Modal, 2x Retina HD Preview & Academic Lab Mode
add_if_exists src/components/ProjectGalleryModal.tsx
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 36: Add Visual Projects Gallery Modal, 2x Retina HD Preview & Academic Lab Mode

Wire thumbnail Projects Gallery modal (Save/Open/Rename/Delete), live 1x 720px <->
2x 1440px Retina software raster toggle, and Artist Mode vs. Lab Mode switch."

# Cycle 37 (ShimulCoding): Expanded C++11 Verification Suite (38/38 Zero-Warning Assertions)
add_if_exists cpp-alpona-studio/tests/test_graphics.cpp
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 37: Expand C++11 automated verification suite to 38 zero-warning tests

Verify Porter-Duff Source-Over alpha blending, layer lock protection, per-layer
opacity, universal layer_transform (bounds/move/scale/rotate) & full CLO 1-6."

# Cycle 38 (dipro20debnath): Expanded TypeScript Verification Suite (45/45 Passing Tests)
add_if_exists src/graphics/graphics.test.ts
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 38: Expand TypeScript automated verification suite to 45 passing tests

Verify uniform layer opacity + SVG stroke-opacity, lock guards, universal
layerTransform, multi-touch pinch/tap, IndexedDB gallery CRUD & 2x HD cache rebuild."

# Cycle 39 (ShimulCoding): Updated C++11 Source Explorer & Synced CSE 401/402 READMEs (40 Cycles)
add_if_exists README.md cpp-alpona-studio/README.md \
  src/data/cppProjectFiles.ts src/components/CppSourceView.tsx
commit_as "$SHIMUL_NAME" "$SHIMUL_EMAIL" "Cycle 39: Update C++11 source explorer & sync CSE 401/402 documentation (40 cycles)

Register layer_transform.cpp in Source Explorer and document all 40 modular
alternating milestone cycles across root and module READMEs."

# Cycle 40 (dipro20debnath): Final 40-Cycle Alternating GitHub Push Scripts (Bash & PowerShell)
add_if_exists cpp-alpona-studio/push_to_github.sh cpp-alpona-studio/push_to_github.ps1
commit_as "$DIPRO_NAME" "$DIPRO_EMAIL" "Cycle 40: Finalize 40-cycle alternating Bash & PowerShell GitHub push scripts

Synchronize all 40 alternating Git commit cycles between ShimulCoding
(odd cycles 1..39) and dipro20debnath (even cycles 2..40) for GitHub push."

echo ""
echo "All 40 alternating CSE 401/402 cycle commits created:"
echo "  Odd  cycles (1, 3, 5, ..., 37, 39): $SHIMUL_NAME <$SHIMUL_EMAIL>"
echo "  Even cycles (2, 4, 6, ..., 38, 40): $DIPRO_NAME <$DIPRO_EMAIL>"

if [ -n "$NO_PUSH" ]; then
  echo "Skipping git push (--no-push)."
  exit 0
fi

echo "Pushing to $REPO_URL ..."
git push $FORCE_PUSH -u origin main
