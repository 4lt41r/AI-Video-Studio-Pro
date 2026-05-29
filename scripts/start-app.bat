@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: AI Video Studio Pro — App Launcher
:: Starts backend, frontend dev server, and Electron window.
:: ============================================================

for %%i in ("%~dp0..") do set "ROOT=%%~fi"
cd /d "%ROOT%"

echo.
echo ============================================================
echo   AI Video Studio Pro — Starting...
echo ============================================================
echo.

:: ── Verify environment is set up ─────────────────────────────
if not exist "env\Scripts\python.exe" (
    echo [ERROR] Python environment not found.
    echo         Please run: scripts\setup-portable.bat
    pause
    exit /b 1
)

if not exist "app\frontend\node_modules" (
    echo [ERROR] Frontend dependencies not installed.
    echo         Please run: scripts\setup-portable.bat
    pause
    exit /b 1
)

:: ── Start Frontend dev server ─────────────────────────────────
:: (Backend is spawned by Electron — do not start it separately)
echo [1/2] Starting frontend dev server (port 5173)...
start "AVSP-Frontend" /min cmd /c "cd /d "%ROOT%\app\frontend" && npm run dev"

:: Wait for Vite to be ready
timeout /t 3 /nobreak >nul

:: ── Launch Electron window (spawns backend internally) ────────
echo [2/2] Launching Electron window...
cd /d "%ROOT%\app\desktop"
call npm run dev

echo.
echo ============================================================
echo   App closed.
echo ============================================================
exit /b 0
