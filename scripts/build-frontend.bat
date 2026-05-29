@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: AI Video Studio Pro — Build Frontend
:: Compiles the React app into app\frontend\dist\
:: Run this once before using start-prod.bat.
:: ============================================================

set "ROOT=%~dp0.."
set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

echo.
echo ============================================================
echo   AI Video Studio Pro — Building Frontend
echo ============================================================
echo.

:: Check Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Node.js not found. Install from https://nodejs.org/
    goto :error
)

:: Check frontend deps
if not exist "app\frontend\node_modules" (
    echo [WARN] Frontend packages not installed. Running npm install first...
    cd app\frontend
    call npm install --silent
    if errorlevel 1 (
        echo [FAIL] npm install failed.
        cd /d "%ROOT%"
        goto :error
    )
    cd /d "%ROOT%"
)

:: Build
echo [1/1] Building React app (this takes ~30 seconds)...
cd app\frontend
call npm run build
if errorlevel 1 (
    echo [FAIL] Frontend build failed. Check errors above.
    cd /d "%ROOT%"
    goto :error
)
cd /d "%ROOT%"

:: Verify output
if not exist "app\frontend\dist\index.html" (
    echo [FAIL] Build completed but dist\index.html not found.
    goto :error
)

echo.
echo ============================================================
echo   Build Complete!
echo ============================================================
echo   Output: app\frontend\dist\
echo   Run:    scripts\start-prod.bat
echo ============================================================
echo.
echo [%date% %time%] Frontend build succeeded >> "%ROOT%\logs\build-log.md"

goto :end

:error
echo.
echo ============================================================
echo   Build FAILED — see errors above
echo ============================================================
echo [%date% %time%] Frontend build FAILED >> "%ROOT%\logs\error-log.md"
pause
exit /b 1

:end
pause
exit /b 0
