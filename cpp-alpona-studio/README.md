# Alpona Studio — C++11 Engine, OpenGL Desktop App & AlponaCLI

This folder is the C++11 version of the Alpona Studio graphics engine (see the main
[README](../README.md) for the web studio and the full project overview). It contains three programs that
share the same engine sources in `src/` and `include/`:

| Program | Entry point | Build | Needs OpenGL? |
| --- | --- | --- | --- |
| **AlponaStudio** — interactive desktop app (1000×796 window, 37 buttons) | `src/main.cpp` | Code::Blocks **F9**, or `make` | Yes (FreeGLUT) |
| **AlponaCLI** — headless exporter (PNG, SVG, STL, CSV…) | `src/cli_pipeline.cpp` | `make cli` | No |
| **test_graphics** — 45 automated tests | `tests/test_graphics.cpp` | `make test` | No |

On Windows, `make` is called **`mingw32-make`** (it comes with Code::Blocks' MinGW) and the programs end in `.exe`.

## 1. Desktop app on Windows (Code::Blocks)

1. Install Code::Blocks with MinGW, and FreeGLUT for MinGW — step-by-step instructions are in the main
   [README, Part B1](../README.md#b1-windows-with-codeblocks).
2. Open **`AlponaStudio.cbp`** and press **F9** (Build and run). The app is built to `bin/Release/AlponaStudio.exe`.
3. Later, double-click **`../RUN_CPP_DESKTOP.bat`** to start it without opening Code::Blocks.

## 2. Desktop app on Linux / macOS

```bash
sudo apt install freeglut3-dev    # Linux only; macOS uses its built-in GLUT
make
./AlponaStudio
```

## 3. Using the desktop app

The window has a **top toolbar** (Brush, Line, Circle, Fill, Undo, Redo, Clear, Save PNG, Save SVG, 3D STL)
and a **left dock** with Quick-Start Templates (Padma Lotus, Boishakhi Sun, Kalka Rosette, Blank Canvas),
Artisan Pigments (Ivory, Sindoor, Turmeric, Alta, Pata, Neel), Courtyard Surface (Courtyard, Red Clay,
Midnight), Symmetry & Assist (4×, 6×, 8×, 12×, Mirror Dₙ/Cₙ, Magnetic Snap, Guide Axes), Canvas Zoom
(Zoom −, 100%, Zoom +) and Workspace Views (**2D Studio, Image Lab NPR, 3D Courtyard, Night Diya 3D**).
Draw by dragging on the canvas; every stroke is repeated around the centre. Press **`K`** to draw a
7×7 pulli kolam with one continuous stroke (each press shows the next design).

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `F` `L` `O` `B` | Brush, Line, Circle, Fill | `4` `6` `8` `2` | 4×, 6×, 8×, 12× symmetry |
| `U` / `Y` / `C` | Undo / Redo / Clear | `R` | Mirror (Dₙ) ↔ rotation (Cₙ) |
| `M` / `N` | Padma Lotus / Boishakhi Sun template | `A` / `X` | Guide axes / Magnetic snap |
| `q` `w` `e` `d` `z` | Ivory, Sindoor, Turmeric, Pata, Neel | `+` `-` `0` | Zoom in / out / 100% |
| `S` / `V` / `T` | Save PNG / SVG / 3D STL | `K` | Pulli kolam (next design on each press) |
| `Esc` | Exit | | |

Exports are written to the current folder as `alpona_export_N.png`, `alpona_vector_N.svg` and
`alpona_pitha_mold_N.stl` (an STL can be opened in any 3D viewer, e.g. Windows *3D Viewer*).

## 4. Tests and AlponaCLI

```bash
make test        # expected: All 45 C++11 Alpona Studio v1.4.2 tests passed!
make cli
./AlponaCLI --help
./AlponaCLI --motif padma --export-png padma.png --export-svg padma.svg \
            --export-stl padma_pitha.stl --mode pitha --export-weave padma_loom.csv \
            --export-stencil padma_stencil.png
./AlponaCLI --procedural 42 --sectors 12 --export-png vine.png --export-natural vine_chalk.png
./AlponaCLI --kolam 7x7 --kolam-symmetry rotational --export-png kolam.png --export-svg kolam.svg
```

| Option | Meaning |
| --- | --- |
| `--motif <padma\|boishakhi\|kalka\|chowk>` | Start from a traditional motif (default `padma`) |
| `--procedural <seed>` / `--sectors <4..16>` | Generate an L-system + phyllotaxis alpona instead |
| `--size <px>` | Canvas size (default 512) |
| `--kolam <rows>x<cols>` | Draw a pulli dot-grid kolam (2..12 dots each way) instead of a motif |
| `--kolam-symmetry <none\|mirror\|rotational>` / `--kolam-density <0..1>` / `--kolam-seed <n>` | Kolam mirror layout; the seed search stops at the first one-stroke design |
| `--kolam-loops` | Keep the given seed even if the kolam has several loops |
| `--export-png` / `--export-svg` | Raster PNG / vector SVG |
| `--export-stl <file> --mode <woodblock\|pitha\|coaster>` | 3D-printable relief mold (binary STL) |
| `--export-weave` | Jamdani / Nakshi Kantha weave chart (CSV) |
| `--export-frieze` / `--export-stencil` / `--export-natural` | Saree border strip / bridged floor stencil / chalk-texture render (PNG) |

`make clean` removes the built programs.

## 5. Source map

| File (`src/*.cpp` + `include/*.h`) | Topic |
| --- | --- |
| `rasterizer`, `floodfill`, `canvas_buffer.h` | DDA & Bresenham lines, midpoint circle, seed fill, alpha compositing |
| `transforms`, `layer_transform`, `viewport_camera` | 2D homogeneous transforms, inverse matrices, symmetry, clipping |
| `bezier`, `stroke_craft`, `canvas_assist` | Cubic Bézier, Chaikin smoothing, pressure taper, snapping |
| `layer_stack`, `frame_cache` | Layers, hit-testing, framebuffer cache |
| `projection3d`, `phong_lighting`, `natural_media` | 3D projection, Z-buffer, Phong/Gouraud lighting, NPR shading |
| `image_processing`, `photo_unwarper`, `homography`, `projector_trace` | Histogram, filters, FFT, morphology, homography |
| `stencil_bridger`, `stl_stamp`, `weave_chart`, `frieze_border`, `colorway_remap` | Stencils, STL export, weave charts, frieze groups, K-means colours |
| `generative_composer`, `motifs`, `timelapse_frames`, `desktop_gui` | L-systems & phyllotaxis, motifs, timelapse, desktop GUI layout |
| `kolam_composer` | Pulli dot-grid kolam: mirror-curve tracing, symmetric mirror placement, one-stroke search |
