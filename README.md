# Alpona Studio — Interactive 2D/3D Bengali Symmetry Art & Image Processing Lab

**Course:** CSE 401 & CSE 402 — Computer Graphics & Image Processing Lab  
**Institution:** Department of Computer Science and Engineering, Metropolitan University, Sylhet  
**Submitted to:** Shrabanti Chowdhury, Senior Lecturer  

### Authors (40 Modular Alternating Milestone Cycles)
> *Commit workflow transparency:* The repository history is packaged into 40 clean, modular milestone commits alternating between both lab partners so each subsystem (C++11 engine, TypeScript Studio UI, verification tests, and CLI/desktop parity) is clearly attributed and independently inspectable.

- **Shimul Chowdhury** (`@ShimulCoding`, `shimulc17@gmail.com`) — ID: 231-115-087 *(Odd Cycles 1, 3, 5, …, 37, 39: Rasterizer Core, Motifs & Stencil Export, Studio UI & `.alpona.json`, 3D Live Courtyard Projection, Cubic Bézier & Bengali Motif Stamps, 3×3 Homography Virtual Floor Try-On & A4 Blueprint, Phong/Gouraud Diya Lighting Studio, 1080p HD Timelapse Reel Exporter, Auto-Bridged Laser/Cricut Stencil Island Detector, Chaikin Stroke Stabilizer & Pressure-Sensitive Rice-Paste Brush, Jamdani Handloom & Nakshi Kantha Weave Chart Generator, Natural Media Chaler Guro NPR Renderer, Interactive Stroke Layer Stack & Hit-Test Eraser, Tracing Reference Photo Underlay, `localStorage` Autosave & Crash Recovery, 3-Tab Studio Dock & Post-Placement Cubic Bézier Handle Editor, Universal On-Canvas Layer Transform Overlay, IndexedDB Multi-Project Gallery Engine, 38-Test C++11 Suite, Source Explorer & Docs)*
- **Gobindo Debnath Dipro** (`@dipro20debnath`, `diprodebnath200@gmail.com`) — ID: 231-115-118 *(Even Cycles 2, 4, 6, …, 38, 40: Symmetry/Transforms & Weiler-Atherton Clipping, Upgraded FreeGLUT Shell, Image Lab + Binary Morphology Gap Sealer, 16× Pixel-Grid Stepper, Vector SVG & 4K UHD PNG Exporters, Street-Photo Alpona Unwarper & Polar Symmetry Restorer, Darkroom Projector & 4-Stage Floor Tracing, Saree Paar Border & 90° Corner Frieze Studio, Photo K-Means Colorway Remapper & Bengali Ritual Stamps, 3D-Printable Pitha Mold & Woodblock Stamp `.STL`/`.OBJ` Exporter, Procedural Lata-Pata L-System & Phyllotaxis Composer, Magnetic Snap-to-Axis & Compass Arc Lock, Precision Canvas Zoom/Pan & Viewport Camera, Committed Framebuffer Cache, Standalone C++11 Headless `AlponaCLI`, Universal Layer Transform + Porter-Duff Alpha/Lock C++11 & TS Engine, Multi-Touch Tablet Gestures, Visual Projects Gallery Modal + 2× Retina HD Preview + Lab Mode, 45-Test TypeScript Suite, 40-Cycle Git Release Scripts)*

---

## CSE 401 & CSE 402 Syllabus Coverage (CLOs 1–6)

| CLO | Syllabus Topic | Implemented Modules (C++11 & TypeScript) |
| --- | --- | --- |
| **CLO-1** | Color Models (RGB/HSV/CMYK), Porter-Duff Alpha Compositing, K-Means Quantization, Dithering, DDA & Bresenham Line, Seed Fill | `rasterizer.cpp/.ts`, `canvas_buffer.h`, `floodfill.cpp/.ts`, `colorModels.ts`, `colorway_remap.cpp/.ts`, `weave_chart.cpp/.ts` (Bayer & Floyd-Steinberg) |
| **CLO-2** | Midpoint Circle, Parametric Cubic Bézier (de Casteljau + P0–P3 Edit), Universal Layer Transforms, Chaikin Subdivision, Pressure Taper, L-Systems & 2D Homogeneous Transforms | `rasterizer.cpp/.ts`, `bezier.cpp/.ts`, `layer_transform.cpp/.ts`, `stroke_craft.cpp/.ts`, `generative_composer.cpp/.ts`, `canvas_assist.cpp/.ts`, `viewport_camera.cpp/.ts`, `frame_cache.cpp/.ts`, `transforms.cpp/.ts` ($3\times3$ $T \cdot R \cdot Sh \cdot S$ & $M^{-1}$) |
| **CLO-3** | Line Clipping (Cohen-Sutherland, Liang-Barsky), Polygon Clipping (Sutherland-Hodgman & Weiler-Atherton) & Lock-Aware Hit-Test Picking | `transforms.cpp/.ts`, `layer_stack.cpp/.ts` + Diamond & Concave Star Petal Clipping Window |
| **CLO-4** | 3D Transformations, Parallel vs. Perspective Projection, Manifold 3D Relief Meshes, 1D Frieze Groups & 3×3 Homography | `projection3d.cpp/.ts`, `stl_stamp.cpp/.ts`, `homography.cpp/.ts`, `photo_unwarper.cpp/.ts` & `frieze_border.cpp/.ts` (7 Frieze Groups + 90° Miter) |
| **CLO-5** | Hidden Surface Removal (Painter's Algorithm, Z-Buffer), Phong/Gouraud Illumination & Procedural NPR Shading | `projection3d.cpp/.ts` (Z-Buffer, Depth Map), `phong_lighting.cpp/.ts` (Sobel Normal Map + Diya Lights) & `natural_media.cpp/.ts` (fBm + Sobel Impasto) |
| **CLO-6** | Image Fundamentals, BFS Connectivity ($N_4, N_8, D_e$), Spatial/FFT Filters, Polar Symmetry & Morphology | `image_processing.cpp/.ts` (2D FFT, Binary Closing, 2×2 SSAA), `photo_unwarper.cpp/.ts` & `stencil_bridger.cpp/.ts` (BFS Island Bridger) |

### Studio Ergonomics, Performance & Maker Highlights
- **Academic `Lab Mode` vs. Pure `Artist Mode` Toggle**: Defaults to `Lab Mode` (showing all CSE 401/402 syllabus modules, `Algorithms`, `C++ & Git`, Bresenham/DDA selector, Clipping Window, and 2D Matrix controls). One click switches to serene `Artist Mode`, hiding academic chrome for a focused creative workspace.
- **Universal Per-Layer On-Canvas Transform (`Move`, `Scale`, `Rotate`), Lock & Porter-Duff Opacity (`10%–100%`)**: Every layer type (Circle, Line, Polygon, Freehand, Bézier, Fill) can be locked against edits/erasing, blended with uniform zero-double-darkening Porter-Duff Source-Over opacity (and SVG `stroke-opacity`), and transformed directly on canvas (`LayerTransformOverlay.tsx` + `BezierHandleOverlay.tsx`) with full C++11 parity (`layer_transform.cpp`).
- **2× Retina HD Software Raster Preview (`1× 720` ↔ `2× HD 1440×1440`) & Committed Framebuffer Cache**: Keep the authentic 720px integer raster or toggle crisp 1440×1440 Retina software rasterization live on canvas, backed by `CommittedFrameCache` ($O(W\cdot H)$ base blit) for fluid 60fps preview drags.
- **Multi-Touch Tablet Gestures & Local IndexedDB Multi-Project Studio Gallery**: Two-finger pinch-to-zoom, two-finger pan, and Procreate-style quick two-finger tap to Undo (`touchGestures.ts`), paired with a local IndexedDB Projects Gallery (`projectGallery.ts`, `ProjectGalleryModal.tsx`) storing live thumbnails with Save / Open / Rename / Delete plus automatic 450ms crash-recovery autosave.
- **Standalone C++11 Headless CLI (`AlponaCLI`) & Upgraded FreeGLUT Desktop App (`main.cpp`)**:
  - `make cli` compiles zero-OpenGL `AlponaCLI` exposing `--motif`, `--procedural`, `--export-png`, `--export-svg`, `--export-stl` (`woodblock|pitha|coaster`), `--export-weave`, `--export-frieze`, `--export-stencil`, and `--export-natural`.
  - FreeGLUT `main.cpp` integrates `CommittedFrameCache`, dashed OpenGL reflection axes (`A`), magnetic snap (`X`), viewport zoom (`+`/`-`/`0`), SVG (`V`), and 3D `.STL` Pitha Mold (`T`) export.
- **Pro Canvas Craft + Maker Exporters**: Stylus `PointerEvent.pressure` rice-paste taper, Named Layer Groups (`Core`, `Petals`, `Border`, `Motifs`), Magnetic Snap-to-Axis & Compass Arc Lock, Symmetric Hit-Test Eraser (`E`), `1×–4×` Zoom/Pan, 3D-Printable `.STL`/`.OBJ` Pitha Molds & Woodblock Stamps, Jamdani & *Nakshi Kantha* Weave Charts, Procedural *Lata-Pata* L-System & Phyllotaxis Composer, Natural Media *Chaler Guro* NPR, 7-Group Saree *Paar* Frieze Studio, and BFS Auto-Bridged Stencils.

---

## Building & Testing the C++11 Project

### Run Automated C++11 Unit Tests (38/38 Assertions, Zero Warnings)
```bash
cd cpp-alpona-studio
make test
```

### Build & Run Standalone C++11 Headless CLI (`AlponaCLI`, Zero OpenGL Required)
```bash
cd cpp-alpona-studio
make cli
./AlponaCLI --motif padma --export-png padma.png --export-svg padma.svg --export-stl padma_pitha.stl --mode pitha --export-weave padma_loom.csv --export-stencil padma_stencil.png
```

### Run TypeScript Unit Tests (45/45 Suites)
```bash
npx --yes tsx --test src/graphics/graphics.test.ts
```

### Build FreeGLUT Desktop Application
- **Code::Blocks (Windows)**: Open `cpp-alpona-studio/AlponaStudio.cbp` and press **F9**.
- **Command Line**: `make && ./AlponaStudio`

### Push All 40 Alternating Cycles to GitHub (Codespaces / Git Bash)
```bash
bash cpp-alpona-studio/push_to_github.sh --codespace
```
