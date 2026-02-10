#!/bin/bash
# Restart Tempest development servers (kill existing, install deps, start fresh)
# Usage: ./scripts/restart-dev.sh

set -e
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🔄 Restarting Tempest Development Servers"
echo "=========================================="
echo ""

# Kill existing processes
echo "🛑 Stopping existing servers..."
lsof -ti:3001 | xargs kill -9 2>/dev/null && echo "✅ Backend stopped" || echo "⚠️  No backend running"
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "✅ Frontend stopped" || echo "⚠️  No frontend running"
sleep 2
echo ""

# Install dashboard dependencies (including recharts)
echo "📦 Installing/updating dashboard dependencies..."
cd apps/dashboard
npm install
cd "$PROJECT_ROOT"
echo ""

# Start servers
echo "🚀 Starting servers..."
./scripts/start-dev.sh
