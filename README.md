# Alpona Studio — Interactive 2D/3D Bengali Alpona Symmetry Art & Image Processing Lab

**Course:** CSE 401 & CSE 402 — Computer Graphics & Image Processing Lab
**Institution:** Department of Computer Science and Engineering, Metropolitan University, Sylhet
**Submitted to:** Shrabanti Chowdhury, Senior Lecturer

| Author | Student ID | GitHub |
| --- | --- | --- |
| Shimul Chowdhury | 231-115-087 | [@ShimulCoding](https://github.com/ShimulCoding) |
| Gobindo Debnath Dipro | 231-115-118 | [@dipro20debnath](https://github.com/dipro20debnath) |

Alpona Studio is a design studio for **alpona** — the traditional Bengali floor art drawn with rice paste for
Pohela Boishakh, Ekushey February and pujas. Every stroke is mirrored around a centre point (radial symmetry),
so a few strokes become a complete alpona. All graphics algorithms (Bresenham, midpoint circle, seed fill,
clipping, 2D/3D transformations, projection, Z-buffer, Phong lighting, FFT, morphology…) are implemented
from scratch, **twice**: once in **TypeScript** for the web studio and once in **C++11** for the desktop
app and command-line tool, and both versions are covered by automated tests.

The project contains **two programs**. You can run either one, or both:

| | Program | What you need | Time to first run |
| --- | --- | --- | --- |
| **Part A** | **Web Studio** (the full app, all features) | Node.js | ~3 minutes |
| **Part B** | **C++11 Desktop App** (OpenGL / FreeGLUT) + **AlponaCLI** | Code::Blocks (MinGW) + FreeGLUT | ~10 minutes |
| **Part C** | Automated tests (53 TypeScript + 43 C++11) | Node.js, g++ | ~1 minute |

---

## 0. Download the source code

**Option 1 — ZIP (easiest):** on the GitHub page click the green **`<> Code`** button → **Download ZIP**,
then right-click the ZIP → **Extract All…**. Open the extracted `Alphona-main` folder.

**Option 2 — Git:**
```bash
git clone https://github.com/ShimulCoding/Alphona.git
cd Alphona
```

> Tip for Windows: extract to a short path without special characters, e.g. `C:\Alphona-main`.

---

## Part A — Run the Web Studio (recommended)

### A1. Install Node.js (one time)
Download and install **Node.js 22 LTS** from <https://nodejs.org/> (keep all default options).
Node.js **20.19 or newer** is required; older versions will not work.

To check: open *Command Prompt* and type `node -v` — it should print `v22.x.x` (or `v20.19` or newer).

### A2. Start the app

**Windows (1 click):** double-click **`RUN_STUDIO_WEB.bat`** in the project folder.

- The first time, it installs the dependencies (needs internet, 1–3 minutes).
- Then your browser opens **<http://localhost:3000>** automatically.
- Keep the black window open while you use the app. Close it (or press `Ctrl+C`) to stop.

**Any OS (terminal / VS Code / PowerShell):**
```bash
npm install
npm start
```
`npm start` opens the browser automatically. (`npm run dev` does the same without opening the browser —
then open <http://localhost:3000> yourself.)

No API keys, accounts or `.env` file are needed. After the first install, the app works offline.

### A3. Guided tour — try every feature (follows the demo video)

Each step says what to click and what you should see. Steps 1–6 take about 5 minutes.

**Studio (the drawing page)**

1. **Pick a template.** In the *Quick-Start Canvas* bar at the top, click **Padma Lotus Courtyard**,
   **Boishakhi Terracotta Sun** or **Shankha & Kalka Rosette** → a complete alpona appears.
   Click **Blank Artisan Canvas** to start empty.
2. **Draw with symmetry.** With **Freehand (`F`)** selected, drag on the canvas → your one stroke is copied
   into every sector. In *Radial Symmetry* (right panel) click **4 / 6 / 8 / 12** or move the *Mirror lines*
   slider (3–16); untick **Reflect** to switch from mirror (dihedral Dₙ) to pure rotation (Cₙ).
3. **Other tools.** Line (`L`), Circle (`O`), Polygon (`P`), Bézier (`C`), Transform (`V`),
   Seed Fill (`B` — click inside a closed shape to fill it), Stroke Eraser (`E`), Group Select (`A`).
   Pick colours from *Alpona Pigments* and the floor colour from *Surface*.
4. **Undo / Redo / Clear** with the buttons under the canvas or `Ctrl+Z` / `Ctrl+Y`.
5. **Layers tab** (right panel): every stroke is a layer — hide/show, lock, delete, change opacity,
   bring forward / send backward, and colour-coded groups.
   **Craft tab:** procedural *Compose Alpona* (L-system vines, phyllotaxis, rhodonea petals),
   2D transformation matrix (scale, shear, shift) and the clipping window.
6. **Zoom & snap** (bar above the canvas): zoom −/+, **Pan**, **1× 720 ↔ 2× HD** preview,
   **Axis Snap**, **Ring Snap**, **Compass Lock**.

**Save, open and export** (buttons under the canvas and top-right)

7. **Export SVG** → downloads `alpona-studio-vector.svg`. **Export 4K PNG** (top right) →
   `alpona-studio-4k-uhd.png`. **Print Stencil** → `alpona-printable-stencil-300dpi.png`.
   **Replay Timelapse** replays how the alpona was drawn; **Export Reel** records it as a 1080×1080
   `.webm` video. **Greeting Card** adds a festive frame and caption to the design (included in exports).
8. **Save .alpona** → downloads `alpona-studio-project.alpona.json`. Click **Clear**, then
   **Load .alpona** and choose that file → your drawing comes back.
9. **Projects** (top bar): save several designs in the browser with thumbnails; open, rename or delete them.
   The studio also auto-saves — reload the page and your work is still there.

**The other three views** (top navigation)

10. **Image Lab** — image processing on your current design: point operations (grayscale, negative,
    log, gamma, contrast stretch, **histogram equalization** with live histogram), spatial 3×3 filters,
    morphology and **2D FFT**.
11. **3D View** — your alpona on a 3D courtyard: 1-, 2- and 3-point perspective vs. parallel projection,
    hidden-surface removal (**Wireframe / Painter's / Z-Buffer / Depth Map**), pitch/yaw/roll sliders,
    the live 4×4 matrix, and Night Diya Phong/Gouraud lighting.
12. **Floor & Print** — **Virtual Floor Try-On** (drag the 4 corner pins TL/TR/BR/BL to fit a floor
    photo; 3×3 homography; *Upload Photo* to use your own), **Chalk Blueprint & A4** printing at real
    size, **Saree Border** (frieze groups), **Laser Bridges** (stencil island bridging),
    **Jamdani Weave** chart, **Photo Unwarper** and **Projector & Trace**.

**Help inside the app**

13. **Documentation** — Quick Start & Advanced Techniques manuals (the canvas stays usable beside it).
    **Run & Keys** (or press `?`) — all keyboard shortcuts. **C++ & Specs** — live matrices and a browser
    for the C++11 source files.

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `F` `L` `O` `P` `C` | Freehand, Line, Circle, Polygon, Bézier | `4` `6` `8` | 4, 6 or 8 sectors |
| `V` `B` `E` `A` | Transform, Seed Fill, Eraser, Group Select | `R` | Mirror (reflect) on/off |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo | `G` / `X` | Guides / symmetry axes on/off |
| `?` | Shortcut help | `Esc` | Close help |

---

## Part B — Run the C++11 Desktop App (Code::Blocks + FreeGLUT)

The desktop app is a 1000×796 OpenGL window with **37 clickable buttons**: drawing tools, 4 templates,
6 pigments, 3 floor surfaces, 4×/6×/8×/12× symmetry with mirror, snap and guide axes, zoom, PNG/SVG/STL
export and 4 views (**2D Studio, Image Lab NPR, 3D Courtyard, Night Diya 3D**).

### B1. Windows with Code::Blocks
1. Install **Code::Blocks** with MinGW (the `codeblocks-…mingw-setup.exe` from <https://www.codeblocks.org/downloads/binaries/>).
2. Install **FreeGLUT for MinGW** (one time), if your Code::Blocks does not have it yet:
   1. Download *freeglut 3.0.0 MinGW Package* from <https://www.transmissionzero.co.uk/software/freeglut-devel/>
      and extract it.
   2. Find your MinGW folder, usually `C:\Program Files\CodeBlocks\MinGW`.
   3. Copy `freeglut\include\GL\*` → `MinGW\include\GL\` (create the `GL` folder if needed).
   4. Copy `freeglut\lib\x64\libfreeglut.a` → `MinGW\lib\`
      (use `freeglut\lib\libfreeglut.a` instead if your Code::Blocks/MinGW is 32-bit).
   5. Copy `freeglut\bin\x64\freeglut.dll` → `C:\Windows\System32\`
      (or next to `AlponaStudio.exe` in `cpp-alpona-studio\bin\Release\`).
3. Open **`cpp-alpona-studio\AlponaStudio.cbp`** in Code::Blocks and press **F9** (Build and run).
   The project already links `freeglut`, `opengl32`, `glu32`, `winmm` and `gdi32`.
4. Next time, just double-click **`RUN_CPP_DESKTOP.bat`** — it starts the built app directly
   (if the app is not built yet, it tries `mingw32-make`, and otherwise opens the project in Code::Blocks).

### B2. Linux / macOS terminal
```bash
cd cpp-alpona-studio
make            # Linux: needs  sudo apt install freeglut3-dev ; macOS uses the built-in GLUT
./AlponaStudio
```
(On Windows with MinGW in PATH the same commands are `mingw32-make` and `AlponaStudio.exe`.)

### B3. Using the desktop app
Click the buttons, or use the keys:

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `F` `L` `O` `B` | Brush, Line, Circle, Fill | `4` `6` `8` `2` | 4×, 6×, 8×, 12× symmetry |
| `U` / `Y` / `C` | Undo / Redo / Clear | `R` | Mirror (Dₙ) ↔ rotation (Cₙ) |
| `M` / `N` | Padma Lotus / Boishakhi Sun template | `A` / `X` | Guide axes / Magnetic snap |
| `q` `w` `e` `d` `z` | Ivory, Sindoor, Turmeric, Pata, Neel | `+` `-` `0` | Zoom in / out / 100% |
| `S` / `V` / `T` | Save PNG / SVG / 3D STL | `Esc` | Exit |

Exported files (`alpona_export_N.png`, `alpona_vector_N.svg`, `alpona_pitha_mold_N.stl`) are saved in the
`cpp-alpona-studio` folder. More details: [`cpp-alpona-studio/README.md`](cpp-alpona-studio/README.md).

---

## Part C — Automated tests & the command-line tool

```bash
# TypeScript engine: 53 tests (run in the project folder, after npm install)
npm test

# C++11 engine: 43 tests, no OpenGL needed (Windows: mingw32-make test)
cd cpp-alpona-studio
make test

# Headless C++11 CLI (Windows: mingw32-make cli, then AlponaCLI.exe ...)
make cli
./AlponaCLI --motif padma --export-png padma.png --export-svg padma.svg \
            --export-stl padma_pitha.stl --mode pitha --export-weave padma_loom.csv \
            --export-stencil padma_stencil.png
./AlponaCLI --help
```

Expected: `# pass 53` / `# fail 0` and `All 43 C++11 Alpona Studio v1.4.2 tests passed!`.
Other checks: `npm run lint` (TypeScript type check) and `npm run build` (production build into `dist/`).

---

## Syllabus coverage (CLO-1 to CLO-6)

| CLO | Topics | Where in the code (C++11 `cpp-alpona-studio/src/*.cpp` & TypeScript `src/graphics/*.ts`) |
| --- | --- | --- |
| **CLO-1** | Colour models (RGB/HSV/CMYK), Porter-Duff alpha compositing, K-means quantization, dithering, DDA & Bresenham line, seed fill | `rasterizer`, `canvas_buffer.h`, `floodfill`, `colorModels.ts`, `colorway_remap`, `weave_chart` (Bayer & Floyd–Steinberg) |
| **CLO-2** | Midpoint circle, cubic Bézier (de Casteljau), 2D homogeneous transforms (T·R·Sh·S and inverse), Chaikin subdivision, L-systems | `rasterizer`, `bezier`, `transforms`, `layer_transform`, `stroke_craft`, `generative_composer`, `canvas_assist`, `viewport_camera`, `frame_cache` |
| **CLO-3** | Line clipping (Cohen–Sutherland, Liang–Barsky), polygon clipping (Sutherland–Hodgman, Weiler–Atherton), hit-test picking | `transforms`, `layer_stack` |
| **CLO-4** | 3D transformations, parallel vs. perspective projection, 3D relief meshes (STL), frieze groups, 3×3 homography | `projection3d`, `stl_stamp`, `homography`, `photo_unwarper`, `frieze_border` |
| **CLO-5** | Hidden-surface removal (Painter's, Z-buffer), Phong/Gouraud illumination, NPR shading | `projection3d`, `phong_lighting`, `natural_media` |
| **CLO-6** | Image fundamentals, histogram, BFS connectivity (N₄, N₈), spatial & FFT filters, morphology | `image_processing`, `photo_unwarper`, `stencil_bridger` |

## Project structure

```
Alphona/
├── RUN_STUDIO_WEB.bat        Windows 1-click launcher for the web studio (Part A)
├── RUN_CPP_DESKTOP.bat       Windows launcher for the C++ desktop app (Part B)
├── package.json              Web app dependencies and scripts (npm start / test / build)
├── index.html, src/          Web studio (React + TypeScript + Vite)
│   ├── App.tsx, components/  User interface
│   └── graphics/             Graphics engine + graphics.test.ts (53 tests)
└── cpp-alpona-studio/        C++11 engine
    ├── src/, include/        Engine, main.cpp (FreeGLUT desktop app), cli_pipeline.cpp (AlponaCLI)
    ├── tests/                test_graphics.cpp (43 tests)
    ├── AlponaStudio.cbp      Code::Blocks project
    └── Makefile              make / make cli / make test
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `'node' is not recognized` | Install Node.js 22 LTS (A1), then **close and reopen** Command Prompt / the `.bat` file. |
| `Node.js version is too old` | Install Node.js 22 LTS from <https://nodejs.org/>. |
| `npm install` fails | Check the internet connection. Then delete the `node_modules` folder and try again. |
| Port 3000 is busy | Close the other program using it, or run `npx vite --port=3001 --open`. |
| Browser shows an old version | Press `Ctrl+F5` to reload. |
| Code::Blocks: `GL/freeglut.h: No such file or directory` or `cannot find -lfreeglut` | Do step B1.2 (install FreeGLUT into the MinGW folder). |
| `freeglut.dll was not found` when starting the app | Copy `freeglut.dll` (step B1.2.5) next to `AlponaStudio.exe` or into `C:\Windows\System32`. |
| `make` is not recognized on Windows | Use `mingw32-make` (comes with Code::Blocks MinGW), or use Code::Blocks (B1). |
