#!/usr/bin/env bash
# AI Video Studio Pro — App Launcher (Unix/Mac)
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo ""
echo "============================================================"
echo "  AI Video Studio Pro — Starting..."
echo "============================================================"
echo ""

# Verify environment
if [ ! -f "env/bin/python" ]; then
    echo "[ERROR] Python environment not found. Run: bash scripts/setup-portable.sh"
    exit 1
fi

if [ ! -d "app/frontend/node_modules" ]; then
    echo "[ERROR] Frontend deps not installed. Run: bash scripts/setup-portable.sh"
    exit 1
fi

# Trap to kill child processes on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start backend
echo "[1/3] Starting backend..."
cd "$ROOT/app/backend"
"$ROOT/env/bin/python" main.py &
BACKEND_PID=$!

sleep 2

# Start frontend
echo "[2/3] Starting frontend dev server..."
cd "$ROOT/app/frontend"
npm run dev &
FRONTEND_PID=$!

sleep 3

# Launch Electron
echo "[3/3] Launching Electron..."
cd "$ROOT/app/desktop"
npm run dev

echo "App closed."
