#!/usr/bin/env bash
# Bing Ads → BQ daily ingest (7-day rolling)
# Runs at 06:00 America/New_York via launchd
# Wrapper for bing-ads-ingest.ts (tsx)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs/bing-ads-ingest"
TS_SCRIPT="$SCRIPT_DIR/bing-ads-ingest.ts"
DATE_STAMP="$(date -u +%Y-%m-%d)"

export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.cortextos/secrets/bigquery-key.json"

mkdir -p "$LOG_DIR"

STDOUT_LOG="$LOG_DIR/stdout.log"
STDERR_LOG="$LOG_DIR/stderr.log"

echo "=== [$DATE_STAMP] bing-ads-ingest starting (7-day rolling) ===" >> "$STDOUT_LOG"

set +e
npx tsx "$TS_SCRIPT" --days 7 \
  >> "$STDOUT_LOG" 2>> "$STDERR_LOG"
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -ne 0 ]; then
  echo "=== [$DATE_STAMP] bing-ads-ingest FAILED (exit $EXIT_CODE) ===" >> "$STDERR_LOG"
  cortextos bus log-event pipeline bing_ingest_failed warning \
    --meta "{\"exit_code\":$EXIT_CODE,\"date\":\"$DATE_STAMP\"}" 2>/dev/null || true
else
  echo "=== [$DATE_STAMP] bing-ads-ingest completed OK ===" >> "$STDOUT_LOG"
  cortextos bus log-event pipeline bing_ingest_success info \
    --meta "{\"date\":\"$DATE_STAMP\"}" 2>/dev/null || true
fi

exit $EXIT_CODE
