@echo off
setlocal
title Alpona Studio - Web Studio Launcher
cd /d "%~dp0"

echo ============================================================
echo   Alpona Studio - Interactive Web Studio
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo         Install Node.js 22 LTS from https://nodejs.org/
  echo         then close this window and double-click this file again.
  pause
  exit /b 1
)

for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo [ERROR] Your Node.js version is too old.
  node -v
  echo         Alpona Studio needs Node.js 20.19 or newer. Install Node.js 22 LTS from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [1/2] First-time setup: installing dependencies. This needs internet and takes 1-3 minutes...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo [2/2] Starting Alpona Studio at http://localhost:3000
echo       Your browser will open automatically when the server is ready.
echo       Keep this window open while using the app. Press Ctrl+C here to stop it.
echo.
call npm start
pause
