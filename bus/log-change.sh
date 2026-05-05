#!/usr/bin/env bash
# log-change.sh — append a structured entry to a client's change log.
#
# Aligned with Rob's vision pillar 7 (verification + observability).
# Every platform action taken on behalf of a client should leave a trace
# here. If a screenshot or other proof-of-work artifact exists, link it.
#
# Usage:
#   log-change.sh <client-slug> <action-summary> [--proof <path>] [--platform <name>] [--reason <text>]
#
# Reads CTX_AGENT_NAME from env if set, otherwise "?".
# Defaults --platform to "other".

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: log-change.sh <client-slug> <action-summary> [--proof <path>] [--platform <name>] [--reason <text>]" >&2
  exit 2
fi

SLUG="$1"; shift
ACTION="$1"; shift
PROOF=""
PLATFORM="other"
REASON=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --proof) PROOF="$2"; shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --reason) REASON="$2"; shift 2 ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

VAULT="${OBSIDIAN_VAULT:-$HOME/ObsidianVault}"
LOG_FILE="$VAULT/01-Clients/$SLUG/change-log.md"
AGENT="${CTX_AGENT_NAME:-?}"

if [[ ! -f "$LOG_FILE" ]]; then
  echo "ERROR: $LOG_FILE not found. Run onboard-client.sh first." >&2
  exit 3
fi

TS=$(date -u +"%Y-%m-%d %H:%M")
ENTRY="
### $TS — $AGENT — $ACTION
- Platform: $PLATFORM"

if [[ -n "$REASON" ]]; then
  ENTRY="$ENTRY
- Reason: $REASON"
fi
if [[ -n "$PROOF" ]]; then
  ENTRY="$ENTRY
- Proof: $PROOF"
else
  ENTRY="$ENTRY
- Proof: n/a"
fi
ENTRY="$ENTRY
- Reverted? n
"

# Use vault-append-style flock to prevent concurrent-writer interleave.
# (change-log.md is shared across all agents that touch this client.)
LOCK="$LOG_FILE.lock"
exec /usr/bin/env python3 - "$LOG_FILE" "$LOCK" "$ENTRY" <<'PY'
import fcntl, os, sys, time
log_file, lock_path, entry = sys.argv[1], sys.argv[2], sys.argv[3]
lf = open(lock_path, "a+")
deadline = time.time() + 5
while time.time() < deadline:
    try:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        break
    except BlockingIOError:
        time.sleep(0.02)
else:
    print("log-change: lock timeout", file=sys.stderr); sys.exit(3)
try:
    with open(log_file, "a") as f:
        f.write(entry)
finally:
    fcntl.flock(lf.fileno(), fcntl.LOCK_UN); lf.close()
print(f"  Appended to {log_file}")
PY
