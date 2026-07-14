#!/usr/bin/env bash
# Runs every test page in a headless browser and reports pass/fail.
#
# Needs only python3 and a chromium binary — no node, no npm install. Each page
# sets document.title to ALLPASS or FAIL when it finishes; we dump the rendered
# DOM and read that. --virtual-time-budget lets the pages run their frame loops
# to completion without wall-clock waiting.
set -uo pipefail

PORT="${PORT:-8088}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CHROME=""
for c in chromium chromium-browser google-chrome chrome; do
  if command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
done
if [ -z "$CHROME" ]; then
  echo "error: no chromium binary found (tried chromium, chromium-browser, google-chrome, chrome)" >&2
  exit 127
fi

# Only start a server if nothing is already serving the port.
STARTED_SERVER=0
if ! curl -fsS -o /dev/null "http://localhost:$PORT/index.html" 2>/dev/null; then
  python3 -m http.server "$PORT" --directory "$ROOT" >/dev/null 2>&1 &
  SERVER_PID=$!
  STARTED_SERVER=1
  trap 'kill $SERVER_PID 2>/dev/null' EXIT
  for _ in $(seq 1 40); do
    curl -fsS -o /dev/null "http://localhost:$PORT/index.html" 2>/dev/null && break
    sleep 0.25
  done
fi

# page:virtual-time-budget-ms
PAGES=(
  "boot.html:15000"
  "headless.html:60000"
  "mechanics.html:25000"
  "reach.html:30000"
  "maptest.html:15000"
  "stomp_repro.html:15000"
  "content.html:15000"
  "input.html:15000"
  "save.html:15000"
  "music.html:15000"
  "touch.html:15000"
)

FAILED=()
for entry in "${PAGES[@]}"; do
  page="${entry%%:*}"
  budget="${entry##*:}"
  printf '%-20s' "$page"

  # --autoplay-policy lets pages build an AudioContext without a real gesture,
  # so the music scheduler can be driven headlessly.
  dom=$("$CHROME" --headless --disable-gpu --no-sandbox \
        --autoplay-policy=no-user-gesture-required \
        --virtual-time-budget="$budget" --dump-dom \
        "http://localhost:$PORT/test/$page" 2>/dev/null)

  title=$(printf '%s' "$dom" | sed -n 's/.*<title>\(.*\)<\/title>.*/\1/p' | head -1)

  if [ "$title" = "ALLPASS" ]; then
    echo "ok"
  else
    echo "FAIL (title: ${title:-none})"
    FAILED+=("$page")
    printf '%s' "$dom" \
      | sed -e 's/<[^>]*>/\n/g' \
      | grep -E '^(FAIL|.*-FAIL)' | head -20 | sed 's/^/    /'
  fi
done

echo
if [ ${#FAILED[@]} -ne 0 ]; then
  echo "FAILED: ${FAILED[*]}"
  exit 1
fi
echo "all test pages passed"
