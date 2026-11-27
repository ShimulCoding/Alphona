# Alpona Studio Pro (v1.4.2) — C++11 OpenGL Desktop Suite & Headless CLI

**Release Version:** `v1.4.2` · **Architecture:** C++11 / OpenGL / FreeGLUT 37-Button Multi-View Desktop GUI & Zero-OpenGL Headless Batch Pipeline

---

## Quick Start — How to Run the C++11 Project

### 1. Run in Code::Blocks IDE (Windows — 1-Click OpenGL Desktop GUI)
1. Open **`AlponaStudio.cbp`** in Code::Blocks (with MinGW & FreeGLUT installed) — or double-click **`../RUN_CPP_DESKTOP.bat`**.
2. Press **F9 (Build and Run)**.
3. Use your mouse to click any of the **37 interactive buttons** in the Top Toolbar and Left Studio Dock:
   - **Drawing Tools:** Freehand (`F`), Line (`L`), Circle (`O`), Star/Polygon (`P`), Cubic Bézier (`C`), Seed Fill (`B`), Eraser (`E`), Undo, Redo, Clear
   - **Quick-Start Templates:** Padma Lotus, Boishakhi Sun, Kalka Rosette, Procedural L-System
   - **Workspace Views (Live inside OpenGL):** **2D Studio**, **Image Lab NPR**, **3D Courtyard**, **Night Diya 3D**
   - **1-Click Exports:** PNG, Vector SVG, 3D Pitha `.STL`, Jamdani Weave `.CSV`

### 2. Build & Run from Linux / macOS Terminal
```bash
make && ./AlponaStudio
```

### 3. Run Automated C++11 Unit Tests (43/43 Assertions, Zero Warnings)
```bash
make test
```

### 4. Build & Run Standalone C++11 Headless CLI (`AlponaCLI`, Zero OpenGL Required)
```bash
make cli
./AlponaCLI --motif padma --export-png padma.png --export-svg padma.svg --export-stl padma_pitha.stl --mode pitha --export-weave padma_loom.csv --export-stencil padma_stencil.png
```

---

### Core Engineering Team (68 Modular Alternating Milestone Cycles)
- **Shimul Chowdhury** (`@ShimulCoding`, `shimulc17@gmail.com`) — *Lead Graphics & Systems Engineer (Odd Cycles 1, 3, 5, …, 65, 67)*
- **Gobindo Debnath Dipro** (`@dipro20debnath`, `diprodebnath200@gmail.com`) — *Lead Geometry, DSP & Fabrication Engineer (Even Cycles 2, 4, 6, …, 66, 68)*

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
