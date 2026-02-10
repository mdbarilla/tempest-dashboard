#!/bin/bash
# Test that POST /api/weather/atmosphere/feedback stores to the JSONL file.
# Prerequisites: backend running (e.g. on 3001). Dashboard uses /api/weather
# which may proxy to the backend; for this script we call the backend directly.
#
# Usage: ./scripts/test-atmosphere-feedback.sh [base_url]
# Example: ./scripts/test-atmosphere-feedback.sh
#          ./scripts/test-atmosphere-feedback.sh http://localhost:3001/api/weather

set -e
BASE="${1:-http://localhost:3001/api/weather}"
URL="${BASE}/atmosphere/feedback"

echo "POST $URL"
RES=$(curl -s -w "\n%{http_code}" -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d '{"label":"down","description":"Test: overcast and dull.","condition":"Overcast","generatedAt":1737811200,"tempF":34,"humidity":88,"nwsAlerts":[{"event":"Winter Storm Warning","headline":"Heavy snow expected."}],"conditionCorrected":"Snow","conditionOriginal":"Partly Cloudy","windSpeed":12,"windGust":20,"precipToday":0.1,"precipManualInches":0.25,"solarRadiation":85,"uv":2}')

BODY=$(echo "$RES" | head -n -1)
CODE=$(echo "$RES" | tail -n 1)
echo "HTTP $CODE"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

if [ "$CODE" = "200" ]; then
  echo ""
  echo "To verify it was stored, run:"
  echo "  tail -1 backend/data/llm_feedback.jsonl"
  echo "(Or: tail -1 data/llm_feedback.jsonl from the backend directory.)"
fi
