@echo off
setlocal
title Alpona Studio - C++11 Desktop App and CLI Launcher
cd /d "%~dp0cpp-alpona-studio"

echo ============================================================
echo   Alpona Studio - C++11 OpenGL / FreeGLUT Desktop App
echo ============================================================
echo.

rem --- 1. If the desktop app is already built, just start it ---------------
if exist "bin\Release\AlponaStudio.exe" (
  echo [READY] Starting bin\Release\AlponaStudio.exe ^(built by Code::Blocks^)
  start "" /d "%CD%" "bin\Release\AlponaStudio.exe"
  exit /b 0
)
if exist "AlponaStudio.exe" (
  echo [READY] Starting AlponaStudio.exe ^(built by mingw32-make^)
  start "" /d "%CD%" "AlponaStudio.exe"
  exit /b 0
)

rem --- 2. Not built yet: try to build it with MinGW make ------------------
where mingw32-make >nul 2>nul
if not errorlevel 1 (
  echo [BUILD] Building the desktop app with mingw32-make ^(needs FreeGLUT installed in MinGW^)...
  mingw32-make
  if exist "AlponaStudio.exe" (
    echo [SUCCESS] Built AlponaStudio.exe - starting it now.
    start "" /d "%CD%" "AlponaStudio.exe"
    exit /b 0
  )
  echo [INFO] Desktop build failed - FreeGLUT is probably not installed. See README.md, section "Part B".
  echo.
  echo [BUILD] Building the command-line tool AlponaCLI.exe instead ^(no OpenGL needed^)...
  mingw32-make cli
  if exist "AlponaCLI.exe" (
    AlponaCLI.exe --motif padma --export-png padma.png --export-svg padma.svg --export-stl padma_pitha.stl --mode pitha
    echo.
    echo [SUCCESS] Created padma.png, padma.svg and padma_pitha.stl in the cpp-alpona-studio folder.
  )
  echo.
)

rem --- 3. Otherwise open the Code::Blocks project ----------------------------
echo To build the desktop app in Code::Blocks:
echo   1. Code::Blocks will open AlponaStudio.cbp now ^(if Code::Blocks is installed^).
echo   2. Press F9 ^(Build and run^).
echo   3. Next time, double-click this file again and it will start the built app directly.
echo.
if exist "AlponaStudio.cbp" start "" "AlponaStudio.cbp"
pause
