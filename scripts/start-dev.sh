#!/bin/bash
# Start Tempest backend + dashboard locally for development
# Usage: ./scripts/start-dev.sh
# Then open http://localhost:3000/
# Press Ctrl+C to stop both.

set -e
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🌤️  Starting Tempest Development Servers"
echo "=========================================="
echo ""

# Check if backend .env exists
if [ ! -f backend/.env ]; then
  echo "⚠️  backend/.env not found. Copy from backend/.env.example and set:"
  echo "   - TEMPEST_API_TOKEN"
  echo "   - TEMPEST_STATION_ID"
  echo "   - TEMPEST_LATITUDE"
  echo "   - TEMPEST_LONGITUDE"
  echo ""
  echo "   Proceeding anyway; /api/weather/complete may fail without them."
  echo ""
fi

# Install dashboard dependencies if needed
if [ ! -d "apps/dashboard/node_modules" ]; then
  echo "📦 Installing dashboard dependencies (including recharts)..."
  cd apps/dashboard
  npm install
  cd "$PROJECT_ROOT"
  echo ""
fi

# Kill existing processes on ports 3000 and 3001
echo "🧹 Cleaning up existing processes..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1
echo ""

# Start backend in background
echo "🚀 Starting backend on http://localhost:3001 ..."
cd backend
node server.js &
BACKEND_PID=$!
cd "$PROJECT_ROOT"

# Wait for backend to start
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "❌ Backend failed to start. Check backend/.env and try again."
  exit 1
fi

echo "✅ Backend running (PID: $BACKEND_PID)"
echo ""

# Start dashboard
echo "🚀 Starting dashboard on http://localhost:3000 ..."
echo ""
echo "=========================================="
echo "✅ Servers starting!"
echo "=========================================="
echo ""
echo "📱 Dashboard: http://localhost:3000"
echo "🔌 Backend API: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Trap to kill backend on exit
trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID 2>/dev/null; exit" INT TERM

# Start dashboard (this will block)
cd apps/dashboard
REACT_APP_API_URL=http://localhost:3001/api/weather BROWSER=none npm start
