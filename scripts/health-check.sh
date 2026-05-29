#!/usr/bin/env bash
# AI Video Studio Pro — Health Check (Unix/Mac)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
WARN=0

echo ""
echo "============================================================"
echo "  AI Video Studio Pro — Health Check"
echo "  $(date)"
echo "============================================================"
echo ""

check_ok()   { echo "  [OK]   $1"; ((PASS++)); }
check_fail() { echo "  [FAIL] $1"; ((FAIL++)); }
check_warn() { echo "  [WARN] $1"; ((WARN++)); }
check_info() { echo "  [INFO] $1"; }

# FFmpeg
echo "Checking FFmpeg..."
FFMPEG_BIN="bin/ffmpeg/ffmpeg"
if [ ! -f "$FFMPEG_BIN" ]; then FFMPEG_BIN="bin/ffmpeg/ffmpeg"; fi
if [ -f "$FFMPEG_BIN" ] && "$FFMPEG_BIN" -version &>/dev/null; then
    check_ok "FFmpeg found at $FFMPEG_BIN"
elif command -v ffmpeg &>/dev/null; then
    check_warn "Using system FFmpeg (not bundled). Copy to bin/ffmpeg/ffmpeg for portability."
else
    check_fail "FFmpeg not found. Place binary at bin/ffmpeg/ffmpeg"
fi

# FFprobe
if [ -f "bin/ffmpeg/ffprobe" ] || command -v ffprobe &>/dev/null; then
    check_ok "FFprobe found."
else
    check_fail "FFprobe not found."
fi

# Python env
echo ""
echo "Checking Python environment..."
if [ -f "env/bin/python" ]; then
    PYVER=$(env/bin/python --version 2>&1 | cut -d' ' -f2)
    check_ok "Python env active: $PYVER"
else
    check_fail "Python env not found. Run: bash scripts/setup-portable.sh"
fi

# Python packages
if [ -f "env/bin/pip" ]; then
    if env/bin/pip show fastapi &>/dev/null; then
        check_ok "FastAPI installed."
    else
        check_fail "FastAPI not installed. Run: bash scripts/setup-portable.sh"
    fi
fi

# Node.js
echo ""
echo "Checking Node.js..."
if command -v node &>/dev/null; then
    check_ok "Node.js $(node --version) found."
else
    check_fail "Node.js not found. Install from https://nodejs.org/"
fi

# Frontend deps
echo ""
echo "Checking frontend dependencies..."
if [ -d "app/frontend/node_modules/react" ]; then
    check_ok "Frontend packages installed."
else
    check_fail "Frontend packages missing. Run: bash scripts/setup-portable.sh"
fi

# Directories
echo ""
echo "Checking directories..."
for dir in projects uploads exports cache temp database logs config models assets bin plugins; do
    if [ -d "$dir" ]; then
        check_ok "$dir/"
    else
        check_fail "$dir/ missing"
    fi
done

# Backend API
echo ""
echo "Checking backend API (if running)..."
if curl -sf "http://127.0.0.1:8000/api/health" &>/dev/null; then
    check_ok "Backend API responding."
else
    check_info "Backend not running (start app first)."
fi

# Summary
echo ""
echo "============================================================"
echo "  Health Check Summary"
echo "  PASSED: $PASS   FAILED: $FAIL   WARNINGS: $WARN"
echo "============================================================"

if [ $FAIL -gt 0 ]; then
    echo "  Status: NEEDS ATTENTION"
    echo "  Run: bash scripts/setup-portable.sh"
    echo "$(date) — Health check FAILED ($FAIL failures)" >> "$ROOT/logs/build-log.md"
    exit 1
else
    echo "  Status: ALL CHECKS PASSED"
    echo "  Start app: bash scripts/start-app.sh"
    echo "$(date) — Health check PASSED" >> "$ROOT/logs/build-log.md"
fi
echo "============================================================"
echo ""
