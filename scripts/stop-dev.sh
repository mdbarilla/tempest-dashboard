#!/bin/bash
# Stop Tempest development servers
# Usage: ./scripts/stop-dev.sh

echo "🛑 Stopping Tempest development servers..."
echo ""

# Kill processes on ports 3000 and 3001
PIDS_3001=$(lsof -ti:3001 2>/dev/null)
PIDS_3000=$(lsof -ti:3000 2>/dev/null)

if [ -n "$PIDS_3001" ]; then
  echo "$PIDS_3001" | xargs kill -9 2>/dev/null
  echo "✅ Backend stopped (port 3001)"
else
  echo "⚠️  No backend process found on port 3001"
fi

if [ -n "$PIDS_3000" ]; then
  echo "$PIDS_3000" | xargs kill -9 2>/dev/null
  echo "✅ Frontend stopped (port 3000)"
else
  echo "⚠️  No frontend process found on port 3000"
fi

# Also kill any node processes that might be hanging
# (Be careful - this is aggressive, only use if needed)
# pkill -f "node.*server.js" 2>/dev/null
# pkill -f "react-scripts" 2>/dev/null

echo ""
echo "✅ Done!"
