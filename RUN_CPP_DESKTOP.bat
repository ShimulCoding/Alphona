@echo off
title Alpona Studio Pro (v1.4.2) - C++11 OpenGL Desktop ^& CLI Launcher
echo ============================================================================
echo   Alpona Studio Pro (v1.4.2) - C++11 Desktop ^& CLI Suite
echo   Directory: cpp-alpona-studio\
echo ============================================================================
echo.

cd /d "%~dp0cpp-alpona-studio"

if exist "AlponaStudio.exe" (
  echo [READY] Found compiled AlponaStudio.exe — Launching OpenGL Desktop Studio...
  start "" "AlponaStudio.exe"
  exit /b 0
)

echo [INFO] To compile and run the interactive C++11 OpenGL Desktop Studio on Windows:
echo   1. Open "cpp-alpona-studio\AlponaStudio.cbp" in Code::Blocks IDE (MinGW + FreeGLUT).
echo   2. Press F9 (Build and Run).
echo.

where g++ >nul 2>nul
if %errorlevel% equ 0 (
  echo [BUILD] g++ compiler detected! Building standalone C++11 Headless CLI ^(AlponaCLI.exe^)...
  g++ -std=c++11 -O2 -Iinclude src/cli_pipeline.cpp src/transforms.cpp src/rasterizer.cpp src/floodfill.cpp src/motifs.cpp src/image_processing.cpp src/projection3d.cpp src/bezier.cpp src/homography.cpp src/photo_unwarper.cpp src/phong_lighting.cpp src/projector_trace.cpp src/timelapse_frames.cpp src/frieze_border.cpp src/stencil_bridger.cpp src/colorway_remap.cpp src/stroke_craft.cpp src/stl_stamp.cpp src/weave_chart.cpp src/generative_composer.cpp src/natural_media.cpp src/canvas_assist.cpp src/layer_stack.cpp src/layer_transform.cpp src/viewport_camera.cpp src/frame_cache.cpp src/desktop_gui.cpp -o AlponaCLI.exe
  if %errorlevel% equ 0 (
    echo [SUCCESS] Built AlponaCLI.exe! Running sample Padma export pipeline...
    AlponaCLI.exe --motif padma --export-png padma.png --export-svg padma.svg --export-stl padma_pitha.stl --mode pitha
    echo.
    echo Generated padma.png, padma.svg, and padma_pitha.stl in cpp-alpona-studio\!
  )
)

if exist "AlponaStudio.cbp" (
  echo.
  echo Opening AlponaStudio.cbp in Code::Blocks...
  start "" "AlponaStudio.cbp"
)
pause
