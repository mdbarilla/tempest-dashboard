#!/bin/bash
# Run Tempest backend + dashboard locally for checking the app.
# Use from your Mac's Terminal (outside Cursor). Cursor's run may block port binding.
#
# Usage: ./scripts/run-local.sh
# Then open http://localhost:3000/
# Press Ctrl+C to stop both.

set -e
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -f backend/.env ]; then
  echo "⚠️  backend/.env not found. Copy from backend/.env.example and set TEMPEST_API_TOKEN, TEMPEST_STATION_ID, etc."
  echo "   Proceeding anyway; /api/weather/complete may fail without them."
  echo ""
fi

# Start backend in background; kill it on exit
echo "Starting backend on http://localhost:3001 ..."
(cd backend && node server.js) &
BACKEND_PID=$!
trap "kill $BACKEND_PID 2>/dev/null" EXIT

sleep 2
echo "Starting dashboard on http://localhost:3000 ..."
echo "  Open: http://localhost:3000/"
echo "  Ctrl+C to stop both."
echo ""
# Use local backend (overrides .env.development.local if it points at Pi)
(cd apps/dashboard && REACT_APP_API_URL=http://localhost:3001/api/weather BROWSER=none npm start)
