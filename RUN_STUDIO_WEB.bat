@echo off
title Alpona Studio Pro (v1.4.2) - Interactive Web Studio Launcher
echo ============================================================================
echo   Alpona Studio Pro (v1.4.2) - Interactive Web Studio
echo   Commercial 2D/3D Vector, Multi-Layer Compositing ^& Spatial Projection Suite
echo ============================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js was not found in your PATH.
  echo Please install Node.js 18+ from https://nodejs.org/ and double-click this script again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/2] First-time setup: Installing project dependencies ^(npm install^)...
  call npm install
  if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Please check your internet connection.
    pause
    exit /b 1
  )
)

echo [2/2] Starting Interactive Web Studio on http://localhost:3000 ...
start "" "http://localhost:3000"
call npm run dev
pause
