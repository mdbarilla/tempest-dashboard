#!/bin/bash
# Aggressively kill all Tempest-related processes
# Use this if stop-dev.sh doesn't work
# Usage: ./scripts/kill-all.sh

echo "🛑 Force killing all Tempest processes..."
echo ""

# Kill by port
lsof -ti:3001 | xargs kill -9 2>/dev/null && echo "✅ Killed process on port 3001" || true
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "✅ Killed process on port 3000" || true

# Kill by process name
pkill -f "node.*server.js" 2>/dev/null && echo "✅ Killed backend node processes" || true
pkill -f "react-scripts" 2>/dev/null && echo "✅ Killed react-scripts processes" || true
pkill -f "webpack" 2>/dev/null && echo "✅ Killed webpack processes" || true

echo ""
echo "✅ All processes killed!"
echo ""
echo "Wait 2 seconds, then run: ./scripts/start-dev.sh"
