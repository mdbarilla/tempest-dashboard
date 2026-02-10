#!/bin/bash
# Reset local backends: stop processes on 3000 (dashboard), 3001 (Node backend), and optionally 5000 (weather bridge if run locally).
# Use before ./scripts/run-local.sh for a clean 1.4.2 debug session. Does not affect the Pi (towerhill.local).
#
# Usage: ./scripts/reset-backends.sh [--include-5000]

set -e
INCLUDE_5000=false
for a in "$@"; do
  if [ "$a" = "--include-5000" ]; then INCLUDE_5000=true; break; fi
done

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Stopping process(es) on port $port: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
  else
    echo "Port $port: nothing to stop"
  fi
}

kill_port 3001
kill_port 3000
if [ "$INCLUDE_5000" = true ]; then
  kill_port 5000
fi

echo "Done. Start with: ./scripts/run-local.sh"
