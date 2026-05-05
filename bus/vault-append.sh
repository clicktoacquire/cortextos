#!/usr/bin/env bash
# vault-append.sh — atomic append to a JSONL file in ~/ObsidianVault.
#
# Uses Python fcntl.flock (portable across macOS + Linux; util-linux flock(1)
# is Linux-only). Two writers can race on the same JSONL file (e.g. two agents
# logging decisions). This wrapper serializes appends so concurrent writers
# don't interleave bytes mid-line.
#
# Usage:
#   vault-append.sh <vault-relative-path> <json-line>
#
# Exit codes: 0 ok, 2 bad args, 3 lock failed, 4 invalid JSON.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: vault-append.sh <vault-relative-path> <json-line>" >&2
  exit 2
fi

VAULT="${OBSIDIAN_VAULT:-$HOME/ObsidianVault}"
exec /usr/bin/env python3 - "$VAULT/$1" "$2" <<'PY'
import fcntl, json, os, sys, time

target, line = sys.argv[1], sys.argv[2]

try:
    json.loads(line)
except json.JSONDecodeError as e:
    print(f"vault-append: invalid JSON: {e}", file=sys.stderr)
    sys.exit(4)

os.makedirs(os.path.dirname(target), exist_ok=True)
lock_path = target + ".lock"

# Open lock file; create if missing
lf = open(lock_path, "a+")
deadline = time.time() + 5
acquired = False
while time.time() < deadline:
    try:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        acquired = True
        break
    except BlockingIOError:
        time.sleep(0.02)

if not acquired:
    print(f"vault-append: could not acquire lock on {lock_path} within 5s", file=sys.stderr)
    sys.exit(3)

try:
    with open(target, "a") as f:
        f.write(line.rstrip("\n") + "\n")
finally:
    fcntl.flock(lf.fileno(), fcntl.LOCK_UN)
    lf.close()
PY
