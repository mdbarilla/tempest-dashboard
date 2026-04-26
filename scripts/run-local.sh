#!/bin/bash
# Run Tempest backend + dashboard locally for checking the app.
# Use from your Mac's Terminal (outside Cursor). Cursor's run may block port binding.
#
# Usage: ./scripts/run-local.sh
# Then open http://localhost:3000/ (or the port printed if 3000 was in use)
# Press Ctrl+C to stop both.

set -e
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Kill existing processes on 3000 and 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

# Find available port starting from given port
find_available_port() {
  local port=$1
  while lsof -i ":$port" >/dev/null 2>&1; do
    port=$((port + 1))
  done
  echo "$port"
}

BACKEND_PORT=$(find_available_port 3001)
DASHBOARD_PORT=$(find_available_port 3000)
# Ensure dashboard port differs from backend
[ "$DASHBOARD_PORT" = "$BACKEND_PORT" ] && DASHBOARD_PORT=$((BACKEND_PORT + 1))

if [ ! -f backend/.env ]; then
  echo "⚠️  backend/.env not found. Copy from backend/.env.example and set TEMPEST_API_TOKEN, TEMPEST_STATION_ID, etc."
  echo "   Proceeding anyway; /api/weather/complete may fail without them."
  echo ""
fi

# Start backend in background; kill it on exit
echo "Starting backend on http://localhost:$BACKEND_PORT ..."
(cd backend && PORT=$BACKEND_PORT node server.js) &
BACKEND_PID=$!
trap "kill $BACKEND_PID 2>/dev/null" EXIT

sleep 2
echo "Starting dashboard on http://localhost:$DASHBOARD_PORT ..."
echo "  Open: http://localhost:$DASHBOARD_PORT/"
echo "  Ctrl+C to stop both."
echo ""
# Use local backend (overrides .env.development.local if it points at Pi)
(cd apps/dashboard && PORT=$DASHBOARD_PORT REACT_APP_API_URL=http://localhost:$BACKEND_PORT/api/weather BROWSER=none npm start)
