@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo   AI Video Studio Pro
echo ============================================================
echo.

:: Auto-launch production mode if dist\ is already built
if exist "app\frontend\dist\index.html" (
    echo   Built frontend detected — launching in production mode.
    echo.
    call scripts\start-prod.bat
    exit /b %errorlevel%
)

:: No dist built yet — offer choices
echo   No built frontend found.
echo.
echo   [1] Development mode  (Vite dev server + hot reload)
echo   [2] Build + Launch    (compile frontend, then start)
echo   [3] First-time setup  (install all dependencies)
echo   [4] Health check
echo   [Q] Quit
echo.
set /p CHOICE=Choose (1-4 or Q):

if /i "!CHOICE!"=="1" call scripts\start-app.bat
if /i "!CHOICE!"=="2" (
    call scripts\build-frontend.bat
    if not errorlevel 1 call scripts\start-prod.bat
)
if /i "!CHOICE!"=="3" call scripts\setup-portable.bat
if /i "!CHOICE!"=="4" call scripts\health-check.bat
if /i "!CHOICE!"=="Q" exit /b 0

exit /b 0
