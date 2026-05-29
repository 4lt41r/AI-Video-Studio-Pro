#!/usr/bin/env bash
# AI Video Studio Pro — Portable Setup Script (Unix/Mac)
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo ""
echo "============================================================"
echo "  AI Video Studio Pro — First Time Setup"
echo "============================================================"
echo "  Project Root: $ROOT"
echo "============================================================"
echo ""

# Step 1: Check Python
echo "[1/6] Checking Python..."
if ! command -v python3 &>/dev/null; then
    echo "[FAIL] Python 3 not found. Install Python 3.10+ first."
    exit 1
fi
PYVER=$(python3 --version 2>&1 | cut -d' ' -f2)
echo "[OK]   Python $PYVER found."

# Step 2: Create virtual environment
echo ""
echo "[2/6] Creating Python virtual environment in env/..."
if [ -f "env/bin/python" ]; then
    echo "[OK]   Virtual environment already exists. Skipping."
else
    python3 -m venv env
    echo "[OK]   Virtual environment created."
fi

# Step 3: Install Python packages
echo ""
echo "[3/6] Installing Python packages..."
env/bin/pip install --upgrade pip --quiet
env/bin/pip install -r app/backend/requirements.txt --quiet
echo "[OK]   Python packages installed."

# Step 4: Install frontend packages
echo ""
echo "[4/6] Installing frontend packages..."
if ! command -v node &>/dev/null; then
    echo "[FAIL] Node.js not found. Install Node.js 18+ from https://nodejs.org/"
    exit 1
fi
cd app/frontend && npm install --silent && cd "$ROOT"
echo "[OK]   Frontend packages installed."

# Step 5: Install Electron packages
echo ""
echo "[5/6] Installing Electron packages..."
cd app/desktop && npm install --silent && cd "$ROOT"
echo "[OK]   Electron packages installed."

# Step 6: Check FFmpeg
echo ""
echo "[6/6] Checking FFmpeg..."
FFMPEG_PATH=""
if [ -f "bin/ffmpeg/ffmpeg" ]; then
    FFMPEG_PATH="bin/ffmpeg/ffmpeg"
elif command -v ffmpeg &>/dev/null; then
    FFMPEG_PATH=$(command -v ffmpeg)
    echo "[WARN] Using system FFmpeg at $FFMPEG_PATH"
    echo "       For fully portable setup, copy ffmpeg to bin/ffmpeg/ffmpeg"
fi

if [ -z "$FFMPEG_PATH" ]; then
    echo "[WARN] FFmpeg not found."
    echo "       Copy ffmpeg binary to: bin/ffmpeg/ffmpeg"
    echo "       Copy ffprobe binary to: bin/ffmpeg/ffprobe"
else
    echo "[OK]   FFmpeg found at $FFMPEG_PATH"
fi

echo ""
echo "============================================================"
echo "  Setup Complete!"
echo "============================================================"
echo "  Start the app: bash scripts/start-app.sh"
echo ""

echo "$(date) — Setup completed" >> "$ROOT/logs/build-log.md"
