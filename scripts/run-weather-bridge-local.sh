#!/bin/bash
# Run the weather bridge (LLM atmosphere) on your Mac on port 5000.
# Use when iterating without the Pi: backend should have AI_BRIDGE_URL=http://localhost:5000.
#
# Usage: ./scripts/run-weather-bridge-local.sh
# Then run ./scripts/run-local.sh in another terminal. Open http://localhost:3000
# Requires: Python 3, Ollama with gemma3:270m (ollama run gemma3:270m "x")
# Press Ctrl+C to stop the bridge.

set -e
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRIDGE_DIR="$PROJECT_ROOT/raspberry-pi/weather_bridge"
cd "$BRIDGE_DIR"

if [ ! -d "venv" ]; then
  echo "Creating venv in $BRIDGE_DIR ..."
  python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt

echo "Starting weather bridge on http://localhost:5000 (USE_MOCK_OBS=1, no Pi needed)"
echo "Backend should have AI_BRIDGE_URL=http://localhost:5000 in backend/.env"
echo ""
USE_MOCK_OBS=1 python3 weather_bridge.py
