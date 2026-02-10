#!/bin/bash
# Deploy weather_bridge.py to the Pi and restart the weather-bridge service.
# Run from project root. Uses ~/weather_bridge on Pi (see raspberry-pi/weather_bridge/README.md).

set -e
HOST="${1:-mbarilla@towerhill.local}"
SRC="raspberry-pi/weather_bridge/weather_bridge.py"
DEST="${HOST}:~/weather_bridge/weather_bridge.py"

echo "Deploying $SRC -> $DEST"
scp "$SRC" "$DEST"
echo "Restarting weather-bridge on Pi..."
ssh "$HOST" "sudo systemctl restart weather-bridge"
echo "Done. Check: ssh $HOST 'sudo systemctl status weather-bridge'"
echo "Logs: ssh $HOST 'tail -f /home/mbarilla/weather_bridge/.cursor-debug.log'"
