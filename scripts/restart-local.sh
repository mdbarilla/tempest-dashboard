#!/bin/bash
# Terminate frontend (3000), backend (3001), and LLM/bridge (5000 if local), then restart all.
# Restarts Pi weather-bridge (LLM) via SSH, then starts backend + frontend locally.
# Run from project root. Use your Mac's Terminal (outside Cursor).
#
# Usage: ./scripts/restart-local.sh

set -e
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Stopping frontend (3000), backend (3001), and LLM/bridge (5000) if running..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
sleep 1

echo "Restarting LLM service (weather-bridge on Pi)..."
if ssh -o ConnectTimeout=5 mbarilla@towerhill.local 'sudo systemctl restart weather-bridge' 2>/dev/null; then
  echo "  weather-bridge restarted on Pi."
else
  echo "  (Pi unreachable or bridge not on Pi — skip. If bridge runs locally on 5000, start it manually.)"
fi

echo "Starting backend and frontend..."
exec ./scripts/run-local.sh
