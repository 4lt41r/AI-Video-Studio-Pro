@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: AI Video Studio Pro — Health Check Script
:: Verifies all components are installed and working.
:: ============================================================

for %%i in ("%~dp0..") do set "ROOT=%%~fi"
cd /d "%ROOT%"

set PASS=0
set FAIL=0
set WARN=0

echo.
echo ============================================================
echo   AI Video Studio Pro — Health Check
echo   %date% %time%
echo ============================================================
echo.

:: ── FFmpeg ────────────────────────────────────────────────────
echo Checking FFmpeg...
if exist "bin\ffmpeg\ffmpeg.exe" (
    "bin\ffmpeg\ffmpeg.exe" -version >nul 2>&1
    if errorlevel 1 (
        echo   [WARN] ffmpeg.exe found but failed to run.
        set /a WARN+=1
    ) else (
        for /f "tokens=3" %%v in ('"bin\ffmpeg\ffmpeg.exe" -version 2^>^&1 ^| findstr /i "ffmpeg version"') do (
            echo   [OK]   FFmpeg found: %%v
        )
        set /a PASS+=1
    )
) else (
    echo   [FAIL] FFmpeg NOT found at bin\ffmpeg\ffmpeg.exe
    echo          Download from https://ffmpeg.org and place in bin\ffmpeg\
    set /a FAIL+=1
)

:: ── FFprobe ───────────────────────────────────────────────────
if exist "bin\ffmpeg\ffprobe.exe" (
    echo   [OK]   FFprobe found.
    set /a PASS+=1
) else (
    echo   [FAIL] FFprobe NOT found at bin\ffmpeg\ffprobe.exe
    set /a FAIL+=1
)

:: ── Python environment ────────────────────────────────────────
echo.
echo Checking Python environment...
if exist "env\Scripts\python.exe" (
    for /f "tokens=2" %%v in ('"env\Scripts\python.exe" --version 2^>^&1') do (
        echo   [OK]   Python env active: %%v
    )
    set /a PASS+=1
) else (
    echo   [FAIL] Python environment not found at env\
    echo          Run: scripts\setup-portable.bat
    set /a FAIL+=1
)

:: ── Python packages ───────────────────────────────────────────
echo.
echo Checking Python packages...
if exist "env\Scripts\pip.exe" (
    "env\Scripts\pip.exe" show fastapi >nul 2>&1
    if errorlevel 1 (
        echo   [FAIL] FastAPI not installed in env\
        echo          Run: scripts\setup-portable.bat
        set /a FAIL+=1
    ) else (
        echo   [OK]   FastAPI installed.
        set /a PASS+=1
    )
) else (
    echo   [FAIL] pip not found in env\
    set /a FAIL+=1
)

:: ── Node.js ───────────────────────────────────────────────────
echo.
echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo   [FAIL] Node.js not found.
    echo          Install from https://nodejs.org/
    set /a FAIL+=1
) else (
    for /f "tokens=*" %%v in ('node --version') do echo   [OK]   Node.js %%v found.
    set /a PASS+=1
)

:: ── Frontend node_modules ─────────────────────────────────────
echo.
echo Checking frontend dependencies...
if exist "app\frontend\node_modules\react" (
    echo   [OK]   Frontend packages installed.
    set /a PASS+=1
) else (
    echo   [FAIL] Frontend packages missing.
    echo          Run: scripts\setup-portable.bat
    set /a FAIL+=1
)

:: ── Electron ─────────────────────────────────────────────────
echo.
echo Checking Electron...
if exist "app\desktop\node_modules\.bin\electron.cmd" (
    echo   [OK]   Electron installed.
    set /a PASS+=1
) else (
    echo   [FAIL] Electron not installed.
    echo          Run: scripts\setup-portable.bat
    set /a FAIL+=1
)

:: ── Required directories ──────────────────────────────────────
echo.
echo Checking directories...
for %%d in (projects uploads exports cache temp database logs config models assets bin plugins) do (
    if exist "%%d" (
        echo   [OK]   %%d\
        set /a PASS+=1
    ) else (
        echo   [FAIL] %%d\ missing
        set /a FAIL+=1
    )
)

:: ── Backend health (optional — only if running) ───────────────
echo.
echo Checking backend API (if running)...
curl -s -f "http://127.0.0.1:8000/api/health" >nul 2>&1
if errorlevel 1 (
    echo   [INFO] Backend not running (start app first).
) else (
    echo   [OK]   Backend API responding.
    set /a PASS+=1
)

:: ── Summary ───────────────────────────────────────────────────
echo.
echo ============================================================
echo   Health Check Summary
echo   PASSED: %PASS%   FAILED: %FAIL%   WARNINGS: %WARN%
echo ============================================================

if %FAIL% gtr 0 (
    echo   Status: NEEDS ATTENTION
    echo   Run scripts\setup-portable.bat to fix failed checks.
    echo.
    echo [%date% %time%] Health check FAILED (%FAIL% failures) >> "%ROOT%\logs\build-log.md"
) else (
    echo   Status: ALL CHECKS PASSED
    echo   App is ready. Run: scripts\start-app.bat
    echo.
    echo [%date% %time%] Health check PASSED >> "%ROOT%\logs\build-log.md"
)
echo ============================================================
echo.
pause
exit /b 0
