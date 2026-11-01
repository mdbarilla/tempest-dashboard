#!/bin/bash
# Preview the /eink page on a Mac: screenshot landscape + portrait with headless Chrome,
# then simulate the Inky panel. Outputs land in ./preview/.
#
# Usage: ./preview.sh [base_url] [spectra6|7color]
#   base_url defaults to the dashboard dev server (http://localhost:3000)

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
PANEL="${2:-spectra6}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/preview"
VENV="$HERE/.venv"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

mkdir -p "$OUT"

if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet pillow numpy
fi

capture() {
  local name="$1" size="$2" query="$3"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$size" --virtual-time-budget=15000 \
    --user-data-dir="$(mktemp -d)" \
    --screenshot="$OUT/$name.png" "$BASE_URL/eink$query" >/dev/null 2>&1
  "$VENV/bin/python" "$HERE/simulate.py" "$OUT/$name.png" "$OUT/$name-$PANEL.png" --panel "$PANEL"
  echo "$OUT/$name.png"
  echo "$OUT/$name-$PANEL.png"
}

capture landscape 800,480 ""
capture portrait 480,800 "?orientation=portrait"
