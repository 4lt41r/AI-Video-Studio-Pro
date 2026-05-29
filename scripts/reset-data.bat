@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: AI Video Studio Pro — Reset Data
:: Clears all user data: projects, exports, cache, temp, DB.
:: Config, scripts, and dependencies are NOT affected.
:: ============================================================

set "ROOT=%~dp0.."
set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

echo.
echo ============================================================
echo   AI Video Studio Pro — Reset Data
echo ============================================================
echo.
echo   WARNING: This will permanently delete:
echo     - projects\         (all projects and media)
echo     - exports\          (all rendered videos)
echo     - cache\            (thumbnails and proxies)
echo     - temp\             (processing workspace)
echo     - database\         (app database)
echo.
echo   This CANNOT be undone.
echo   Config, scripts, and app code are NOT affected.
echo.
echo ============================================================
set /p CONFIRM=Type RESET to confirm:
if not "!CONFIRM!"=="RESET" (
    echo Cancelled — nothing was changed.
    pause
    exit /b 0
)

echo.
echo Resetting...

:: ── Delete data directories ───────────────────────────────
set ERRORS=0

for %%d in (projects exports cache temp database) do (
    if exist "%%d" (
        rmdir /s /q "%%d"
        if errorlevel 1 (
            echo [FAIL] Could not remove %%d\  (may be in use)
            set /a ERRORS+=1
        ) else (
            echo [OK]   Removed %%d\
        )
    ) else (
        echo [SKIP] %%d\ not found.
    )
)

:: ── Recreate empty directories ────────────────────────────
echo.
echo Recreating directories...
for %%d in (projects exports cache temp database logs) do (
    if not exist "%%d" (
        mkdir "%%d"
        echo [OK]   Created %%d\
    )
)

:: ── Done ──────────────────────────────────────────────────
echo.
echo ============================================================
if %ERRORS% gtr 0 (
    echo   Reset completed with %ERRORS% error(s).
    echo   Close any running app instances and try again.
    echo [%date% %time%] Data reset completed — %ERRORS% errors >> "%ROOT%\logs\build-log.md"
) else (
    echo   Reset complete. All user data has been cleared.
    echo   The app will start fresh on next launch.
    echo [%date% %time%] Data reset completed cleanly >> "%ROOT%\logs\build-log.md"
)
echo ============================================================
echo.
pause
exit /b 0
