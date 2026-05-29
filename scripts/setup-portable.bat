@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: AI Video Studio Pro — Portable Setup Script
:: Sets up all dependencies inside the project folder.
:: Run this once on first use, or after moving the folder.
:: ============================================================

set "ROOT=%~dp0.."
set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

echo.
echo ============================================================
echo   AI Video Studio Pro — First Time Setup
echo ============================================================
echo   Project Root: %ROOT%
echo ============================================================
echo.

:: ── Step 1: Check Python ─────────────────────────────────────
echo [1/6] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Python not found. Please install Python 3.10+ and add it to PATH.
    echo        Download: https://www.python.org/downloads/
    goto :error
)
for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo [OK]   Python %PYVER% found.

:: ── Step 2: Create Python virtual environment ────────────────
echo.
echo [2/6] Creating Python virtual environment in env\...
if exist "env\Scripts\python.exe" (
    echo [OK]   Virtual environment already exists. Skipping creation.
) else (
    python -m venv env
    if errorlevel 1 (
        echo [FAIL] Failed to create virtual environment.
        goto :error
    )
    echo [OK]   Virtual environment created at env\
)

:: ── Step 3: Install Python packages ──────────────────────────
echo.
echo [3/6] Installing Python packages into env\...
echo       This may take several minutes on first run.
"env\Scripts\pip.exe" install --upgrade pip --quiet
"env\Scripts\pip.exe" install -r "app\backend\requirements.txt" --quiet
if errorlevel 1 (
    echo [FAIL] Python package installation failed.
    echo        Check app\backend\requirements.txt and try again.
    goto :error
)
echo [OK]   Python packages installed.

:: ── Step 4: Install Node.js frontend packages ────────────────
echo.
echo [4/6] Installing frontend packages (app\frontend)...
node --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Node.js not found. Please install Node.js 18+ from https://nodejs.org/
    goto :error
)
cd app\frontend
call npm install --silent
if errorlevel 1 (
    echo [FAIL] Frontend npm install failed.
    cd /d "%ROOT%"
    goto :error
)
cd /d "%ROOT%"
echo [OK]   Frontend packages installed.

:: ── Step 5: Install Electron packages ────────────────────────
echo.
echo [5/6] Installing Electron packages (app\desktop)...
cd app\desktop
call npm install --silent
if errorlevel 1 (
    echo [FAIL] Desktop npm install failed.
    cd /d "%ROOT%"
    goto :error
)
cd /d "%ROOT%"
echo [OK]   Electron packages installed.

:: ── Step 6: Verify FFmpeg ─────────────────────────────────────
echo.
echo [6/6] Checking FFmpeg...
if exist "bin\ffmpeg\ffmpeg.exe" (
    "bin\ffmpeg\ffmpeg.exe" -version >nul 2>&1
    if errorlevel 1 (
        echo [WARN] FFmpeg found but may be corrupted. Re-download and replace.
    ) else (
        echo [OK]   FFmpeg found and working.
    )
) else (
    echo [WARN] FFmpeg NOT found at bin\ffmpeg\ffmpeg.exe
    echo.
    echo        ACTION REQUIRED:
    echo        1. Download FFmpeg from https://ffmpeg.org/download.html
    echo           (Get the Windows full build)
    echo        2. Copy ffmpeg.exe to:  bin\ffmpeg\ffmpeg.exe
    echo        3. Copy ffprobe.exe to: bin\ffmpeg\ffprobe.exe
    echo.
    echo        The app will not process video without FFmpeg.
)

:: ── Done ──────────────────────────────────────────────────────
echo.
echo ============================================================
echo   Setup Complete!
echo ============================================================
echo.
echo   To start the app: scripts\start-app.bat
echo   To run health check: scripts\health-check.bat
echo.

:: Log setup completion
echo [%date% %time%] Setup completed successfully >> "%ROOT%\logs\build-log.md"

goto :end

:error
echo.
echo ============================================================
echo   Setup FAILED — see error above
echo ============================================================
echo [%date% %time%] Setup FAILED >> "%ROOT%\logs\error-log.md"
pause
exit /b 1

:end
pause
exit /b 0
