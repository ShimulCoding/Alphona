# Alpona Studio Pro (v1.4.2) — Commercial 2D/3D Vector, Multi-Layer & Spatial Projection Suite

**Release Version:** `v1.4.2` · **Architecture:** Dual Interactive Web Studio (`localhost:3000`) & C++11 OpenGL Desktop / CLI Engine (`cpp-alpona-studio/`)

---

## Quick Start — How to Run This Project (Complete & Runnable Source Code)

You can run and use this project in **two complete, interactive ways** depending on your environment:

### Option 1: Run the Full Interactive Web Studio (Recommended — Complete 2D/3D Studio, Image Lab, Floor & Print)
- **Windows 1-Click Launcher:** Double-click **`RUN_STUDIO_WEB.bat`** in the root folder. It automatically runs `npm install` (first time only), starts the local server, and opens `http://localhost:3000`.
- **Or from any Terminal (VS Code / PowerShell / macOS / Linux):**
  ```bash
  npm install
  npm run dev
  ```
  Then open **`http://localhost:3000`** in your browser.
  - Use the top navigation bar to switch between **Studio**, **Image Lab**, **3D View**, and **Floor & Print**.
  - Click **Documentation** in the top bar for the non-modal PDF-style **Quick Start** & **Advanced Techniques** manuals, **C++ & Specs** to inspect live transformation matrices and the C++11 source code explorer, or **Run & Keys (`?`)** for keyboard shortcuts.

### Option 2: Run the Native C++11 OpenGL / FreeGLUT Desktop Application (Code::Blocks IDE)
- **Windows (Code::Blocks IDE):**
  1. Open **`cpp-alpona-studio/AlponaStudio.cbp`** in Code::Blocks (with MinGW & FreeGLUT) — or double-click **`RUN_CPP_DESKTOP.bat`**.
  2. Press **F9 (Build and Run)**.
  3. The 1000×796 OpenGL desktop studio opens with **37 clickable point-and-click buttons** across the Top Toolbar and Left Studio Dock, including live **2D Studio**, **Image Lab NPR**, **3D Courtyard**, and **Night Diya 3D** workspace views!
- **Linux / macOS Terminal:**
  ```bash
  cd cpp-alpona-studio
  make && ./AlponaStudio
  ```

### Option 3: Run Automated Verification Suites & Headless C++11 CLI (Zero OpenGL Required)
```bash
# 1. Run 53/53 TypeScript Graphics Engine Unit Tests
npx --yes tsx --test src/graphics/graphics.test.ts

# 2. Run 43/43 C++11 Unit Tests & Standalone Headless AlponaCLI
cd cpp-alpona-studio
make test
make cli
./AlponaCLI --motif padma --export-png padma.png --export-svg padma.svg --export-stl padma_pitha.stl --mode pitha --export-weave padma_loom.csv --export-stencil padma_stencil.png
```

---

### Core Engineering Team (68 Modular Alternating Milestone Cycles)
> *Release workflow architecture:* The repository history is structured into 68 modular milestone commits alternating between both core engineers so each subsystem (C++11 OpenGL desktop GUI, headless CLI pipeline, TypeScript Web Studio, and automated verification suites) is independently verifiable.

- **Shimul Chowdhury** (`@ShimulCoding`, `shimulc17@gmail.com`) — *Lead Graphics & Systems Engineer (Odd Cycles 1, 3, 5, …, 65, 67: Rasterizer Core, Motifs & Stencil Export, Studio UI & `.alpona.json`, 3D Live Courtyard Projection, Cubic Bézier & Motif Stamps, 3×3 Homography Virtual Floor Try-On & A4 Blueprint, Phong/Gouraud Diya Lighting Studio, 1080p HD Timelapse Reel Exporter, Auto-Bridged Laser/Cricut Stencil Island Detector, Chaikin Stroke Stabilizer & Pressure-Sensitive Brush, Jamdani Handloom & Nakshi Kantha Weave Chart Generator, Natural Media NPR Renderer, Interactive Stroke Layer Stack & Hit-Test Eraser, Tracing Reference Photo Underlay, `localStorage` Autosave & Crash Recovery, 3-Tab Studio Dock & Post-Placement Cubic Bézier Handle Editor, Universal On-Canvas Layer Transform Overlay, IndexedDB Multi-Project Gallery Engine, Multi-View 37-Button C++11 OpenGL Desktop GUI, Branded Startup Splash Engine, PDF Documentation Guides Engine, 43-Test C++11 Suite)*
- **Gobindo Debnath Dipro** (`@dipro20debnath`, `diprodebnath200@gmail.com`) — *Lead Geometry, DSP & Fabrication Engineer (Even Cycles 2, 4, 6, …, 66, 68: Symmetry/Transforms & Weiler-Atherton Clipping, FreeGLUT Desktop Shell, Image Lab + Binary Morphology Gap Sealer, 16× Pixel-Grid Stepper, Vector SVG & 4K UHD PNG Exporters, Street-Photo Perspective Unwarper & Polar Symmetry Restorer, Darkroom Projector & 4-Stage Floor Tracing, Saree Paar Border & 90° Corner Frieze Studio, Photo K-Means Colorway Remapper & Ritual Stamps, 3D-Printable Relief Mold & Woodblock Stamp `.STL`/`.OBJ` Exporter, Procedural L-System & Phyllotaxis Composer, Magnetic Snap-to-Axis & Compass Arc Lock, Precision Canvas Zoom/Pan & Viewport Camera, Committed Framebuffer Cache, Standalone C++11 Headless `AlponaCLI`, Universal Layer Transform + Porter-Duff Alpha/Lock Engine, Multi-Touch Tablet Gestures, Visual Projects Gallery Modal + 2× Retina HD Preview, Quick-Start Studio Template Bar, Zero-Flash Pre-Hydration Splash, Pulsing Local Storage Sync Indicator, 1-Click Launchers, Quick-Run Guide Modal, Non-Modal PDF Documentation Sidebar & Alpona Studio Pro Commercial Branding, 53-Test TypeScript Suite)*

---

## Core Graphics Engine Architecture (Subsystems CORE-1 to CORE-6)

| Subsystem | Pipeline Tier | Implemented Algorithms & Capabilities | Modules (C++11 & TypeScript) |
| --- | --- | --- | --- |
| **CORE-1** | Stage I | Color Spaces (RGB/HSV/CMYK), Porter-Duff Alpha Compositing, K-Means Quantization, Dithering, DDA & Bresenham Line, Iterative Seed Fill | `rasterizer.cpp/.ts`, `canvas_buffer.h`, `floodfill.cpp/.ts`, `colorModels.ts`, `colorway_remap.cpp/.ts`, `weave_chart.cpp/.ts` (Bayer & Floyd-Steinberg) |
| **CORE-2** | Stage II | Midpoint Circle, Parametric Cubic Bézier (de Casteljau + P0–P3 Edit), Universal Layer Transforms, Chaikin Subdivision, Pressure Taper, L-Systems & 2D Homogeneous Transforms | `rasterizer.cpp/.ts`, `bezier.cpp/.ts`, `layer_transform.cpp/.ts`, `stroke_craft.cpp/.ts`, `generative_composer.cpp/.ts`, `canvas_assist.cpp/.ts`, `viewport_camera.cpp/.ts`, `frame_cache.cpp/.ts`, `transforms.cpp/.ts` ($3\times3$ $T \cdot R \cdot Sh \cdot S$ & $M^{-1}$) |
| **CORE-3** | Stage III | Line Clipping (Cohen-Sutherland, Liang-Barsky), Polygon Clipping (Sutherland-Hodgman & Weiler-Atherton) & Lock-Aware Hit-Test Picking | `transforms.cpp/.ts`, `layer_stack.cpp/.ts` + Diamond & Concave Star Petal Clipping Window |
| **CORE-4** | Stage IV | 3D Spatial Transformations, Parallel vs. Perspective Projection, Manifold 3D Relief Meshes, 1D Frieze Groups & 3×3 Projective Homography | `projection3d.cpp/.ts`, `stl_stamp.cpp/.ts`, `homography.cpp/.ts`, `photo_unwarper.cpp/.ts` & `frieze_border.cpp/.ts` (7 Frieze Groups + 90° Miter) |
| **CORE-5** | Stage V | Hidden Surface Removal (Painter's Algorithm, Z-Buffer), Phong/Gouraud BRDF Illumination & Procedural NPR Shading | `projection3d.cpp/.ts` (Z-Buffer, Depth Map), `phong_lighting.cpp/.ts` (Sobel Normal Map + Point Lights) & `natural_media.cpp/.ts` (fBm + Sobel Impasto) |
| **CORE-6** | Stage VI | Spatial & Frequency Domain DSP, BFS Connectivity ($N_4, N_8, D_e$), 2D Radix-2 FFT Filters, Polar Symmetry & Binary Morphology | `image_processing.cpp/.ts` (2D FFT, Binary Closing, 2×2 SSAA), `photo_unwarper.cpp/.ts` & `stencil_bridger.cpp/.ts` (BFS Island Bridger) |

### Commercial Product Highlights
- **Focused Artist Workspace & Engine Specs Mode**: Launches directly into a clean consumer design studio with a 1-click Quick-Start Template Bar and branded startup splash transition, while offering an optional **C++ & Specs** mode for inspecting live matrices, pipeline telemetry, and C++11 source modules.
- **Universal Per-Layer On-Canvas Transform (`Move`, `Scale`, `Rotate`), Lock & Porter-Duff Opacity (`10%–100%`)**: Every layer type (Circle, Line, Polygon, Freehand, Bézier, Fill) can be locked against edits/erasing, blended with uniform zero-double-darkening Porter-Duff Source-Over opacity (and SVG `stroke-opacity`), and transformed directly on canvas (`LayerTransformOverlay.tsx` + `BezierHandleOverlay.tsx`) with full C++11 parity (`layer_transform.cpp`).
- **2× Retina HD Software Raster Preview (`1× 720` ↔ `2× HD 1440×1440`) & Committed Framebuffer Cache**: Toggle crisp 1440×1440 Retina software rasterization live on canvas, backed by `CommittedFrameCache` ($O(W\cdot H)$ base blit) for fluid 60fps preview drags.
- **Multi-Touch Tablet Gestures, Pulsing Local Storage Auto-Save & IndexedDB Projects Gallery**: Two-finger pinch-to-zoom, two-finger pan, and two-finger tap to Undo (`touchGestures.ts`), paired with a local IndexedDB Projects Gallery (`projectGallery.ts`, `ProjectGalleryModal.tsx`) and a debounced 450ms auto-save with a live **Synced to Local Storage** pulsing status indicator alongside the `v1.4.2` footer build label.
- **Multi-View Point-and-Click C++11 OpenGL Desktop GUI (`main.cpp` + `desktop_gui.cpp`) & Headless CLI (`AlponaCLI`)**:
  - `AlponaStudio.cbp` / `make` builds a 1000×796 OpenGL/FreeGLUT desktop studio with 37 clickable toolbar and left-dock buttons (including live **2D Studio**, **Image Lab NPR**, **3D Courtyard**, and **Night Diya 3D** workspace views), startup splash overlay, and `v1.4.2 · Synced` status bar.
  - `make cli` compiles zero-OpenGL `AlponaCLI` exposing `--motif`, `--procedural`, `--export-png`, `--export-svg`, `--export-stl` (`woodblock|pitha|coaster`), `--export-weave`, `--export-frieze`, `--export-stencil`, and `--export-natural`.
