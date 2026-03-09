#!/bin/bash
# Quick deployment script for weather_bridge.py
# Run this from the project root

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${PROJECT_ROOT}/raspberry-pi/weather_bridge/weather_bridge.py"
HOST="${1:-mbarilla@towerhill.local}"

echo "Deploying weather_bridge.py to Pi..."
echo "Source: $SRC"
echo "Destination: $HOST:~/weather_bridge/weather_bridge.py"
echo ""

# Try towerhill.local first, fall back to IP
if scp "$SRC" "${HOST}:~/weather_bridge/weather_bridge.py" 2>/dev/null; then
    echo "✓ File copied successfully"
elif scp "$SRC" "mbarilla@192.168.1.160:~/weather_bridge/weather_bridge.py" 2>/dev/null; then
    HOST="mbarilla@192.168.1.160"
    echo "✓ File copied successfully (using IP)"
else
    echo "✗ Failed to copy file. Please check SSH connection."
    echo ""
    echo "Manual steps:"
    echo "1. Open SSH connection to Pi in another terminal"
    echo "2. Run: scp $SRC ${HOST}:~/weather_bridge/weather_bridge.py"
    exit 1
fi

echo ""
echo "Restarting weather-bridge service..."
ssh "$HOST" "sudo systemctl restart weather-bridge" || {
    echo "✗ Failed to restart service. Please run manually:"
    echo "  ssh $HOST 'sudo systemctl restart weather-bridge'"
    exit 1
}

echo "✓ Service restarted"
echo ""
echo "Checking status..."
ssh "$HOST" "sudo systemctl status weather-bridge --no-pager -l" | head -15

echo ""
echo "✓ Deployment complete!"
echo ""
echo "View service logs with:"
echo "  ssh $HOST 'sudo journalctl -u weather-bridge -f'"
