@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: AI Video Studio Pro — Repair Script
:: Re-installs all dependencies. Safe to run at any time.
:: Does NOT touch user data (projects, exports, database).
:: ============================================================

for %%i in ("%~dp0..") do set "ROOT=%%~fi"
cd /d "%ROOT%"

echo.
echo ============================================================
echo   AI Video Studio Pro — Repair
echo ============================================================
echo   This will reinstall Python and Node dependencies.
echo   Your projects and exports will NOT be affected.
echo ============================================================
echo.
set /p CONFIRM=Continue? (Y/N):
if /i not "!CONFIRM!"=="Y" (
    echo Cancelled.
    goto :end
)

set PASS=0
set FAIL=0

:: ── Python environment ────────────────────────────────────
echo.
echo [1/4] Python virtual environment...
if not exist "env\Scripts\python.exe" (
    echo       Creating environment...
    python --version >nul 2>&1
    if errorlevel 1 (
        echo [FAIL] Python not found. Install Python 3.10+ from python.org
        set /a FAIL+=1
        goto :nodecheck
    )
    python -m venv env
    if errorlevel 1 (
        echo [FAIL] Failed to create virtual environment.
        set /a FAIL+=1
        goto :nodecheck
    )
)
echo [OK]   Python environment ready.
set /a PASS+=1

:: ── Python packages ───────────────────────────────────────
echo.
echo [2/4] Python packages...
"env\Scripts\pip.exe" install --upgrade pip --quiet
"env\Scripts\pip.exe" install -r "app\backend\requirements.txt" --quiet
if errorlevel 1 (
    echo [FAIL] Python package install failed.
    set /a FAIL+=1
) else (
    echo [OK]   Python packages installed.
    set /a PASS+=1
)

:: ── Frontend packages ─────────────────────────────────────
:nodecheck
echo.
echo [3/4] Frontend packages...
node --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Node.js not found. Install from nodejs.org
    set /a FAIL+=1
    goto :electroncheck
)
cd app\frontend
call npm install --silent
if errorlevel 1 (
    echo [FAIL] Frontend npm install failed.
    cd /d "%ROOT%"
    set /a FAIL+=1
) else (
    echo [OK]   Frontend packages installed.
    cd /d "%ROOT%"
    set /a PASS+=1
)

:: ── Electron packages ─────────────────────────────────────
:electroncheck
echo.
echo [4/4] Electron packages...
cd app\desktop
call npm install --silent
if errorlevel 1 (
    echo [FAIL] Electron npm install failed.
    cd /d "%ROOT%"
    set /a FAIL+=1
) else (
    echo [OK]   Electron packages installed.
    cd /d "%ROOT%"
    set /a PASS+=1
)

:: ── Summary ───────────────────────────────────────────────
echo.
echo ============================================================
if %FAIL% gtr 0 (
    echo   Repair completed with %FAIL% error(s). See above.
    echo [%date% %time%] Repair completed — %FAIL% failures >> "%ROOT%\logs\build-log.md"
) else (
    echo   Repair complete! All %PASS% steps succeeded.
    echo   Run: scripts\start-app.bat  (dev)
    echo   Run: scripts\start-prod.bat (production)
    echo [%date% %time%] Repair completed successfully >> "%ROOT%\logs\build-log.md"
)
echo ============================================================
echo.

:end
pause
exit /b 0
