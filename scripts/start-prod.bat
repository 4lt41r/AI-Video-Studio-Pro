@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: AI Video Studio Pro — Production Launcher
:: Starts backend + Electron (no Vite dev server).
:: Requires: scripts\build-frontend.bat run first.
:: ============================================================

set "ROOT=%~dp0.."
set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

echo.
echo ============================================================
echo   AI Video Studio Pro — Production Mode
echo ============================================================
echo.

:: ── Verify Python environment ─────────────────────────────
if not exist "env\Scripts\python.exe" (
    echo [ERROR] Python environment not found.
    echo         Run: scripts\setup-portable.bat
    pause
    exit /b 1
)

:: ── Verify built frontend ─────────────────────────────────
if not exist "app\frontend\dist\index.html" (
    echo [ERROR] Frontend not built.
    echo         Run: scripts\build-frontend.bat first.
    pause
    exit /b 1
)

:: ── Verify Electron ───────────────────────────────────────
if not exist "app\desktop\node_modules\.bin\electron.cmd" (
    echo [ERROR] Electron not installed.
    echo         Run: scripts\setup-portable.bat
    pause
    exit /b 1
)

:: ── Launch Electron in production mode ────────────────────
:: (Electron spawns the backend internally — do not start it here)
echo [1/1] Launching app (production mode)...
cd /d "%ROOT%\app\desktop"
set AVSP_PROD=1
call npm run start

echo.
echo ============================================================
echo   App closed.
echo ============================================================
exit /b 0
