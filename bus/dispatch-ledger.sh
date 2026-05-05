#!/usr/bin/env bash
# dispatch-ledger.sh — render mozart's open-dispatch ledger.
#
# Walks ~/.cortextos/<instance>/inbox + processed for messages FROM the calling
# agent (default: mozart), shows recipient, dispatched_at, ACK status, last
# reply, staleness highlighting (>4h yellow, >12h red).
#
# Usage:
#   dispatch-ledger.sh [--from <agent>] [--window <hours>] [--instance <id>]
#
# Defaults: --from mozart, --window 72, --instance default

set -euo pipefail

FROM="mozart"
WINDOW=72
INSTANCE="${CTX_INSTANCE_ID:-default}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) FROM="$2"; shift 2 ;;
    --window) WINDOW="$2"; shift 2 ;;
    --instance) INSTANCE="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: dispatch-ledger.sh [--from <agent>] [--window <hours>] [--instance <id>]"
      exit 0 ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

CTX_ROOT="$HOME/.cortextos/$INSTANCE"
exec /usr/bin/env python3 - "$CTX_ROOT" "$FROM" "$WINDOW" <<'PY'
import json, os, sys, glob, time
from datetime import datetime, timezone

ctx_root, from_agent, window_h = sys.argv[1], sys.argv[2], int(sys.argv[3])
now = datetime.now(timezone.utc)
cutoff = now.timestamp() - window_h * 3600

# Find all messages FROM <from_agent>:
#   ~/.cortextos/<inst>/inbox/<recipient>/N-TS-from-<from>-XXX.json  (pending)
#   ~/.cortextos/<inst>/processed/<recipient>/N-TS-from-<from>-XXX.json  (delivered)
dispatches = []  # list of dict: id, to, ts, priority, text, status (pending|processed)

for area, status in [("inbox", "pending"), ("processed", "processed")]:
    pattern = os.path.join(ctx_root, area, "*", f"*-from-{from_agent}-*.json")
    for path in glob.glob(pattern):
        recipient = os.path.basename(os.path.dirname(path))
        if recipient == from_agent:
            continue  # skip self-loops
        try:
            with open(path) as f:
                msg = json.load(f)
        except Exception:
            continue
        ts_iso = msg.get("timestamp") or ""
        try:
            ts = datetime.fromisoformat(ts_iso.replace("Z", "+00:00")).timestamp()
        except Exception:
            continue
        if ts < cutoff:
            continue
        dispatches.append({
            "id": msg.get("id", os.path.basename(path)),
            "to": recipient,
            "ts": ts,
            "priority": msg.get("priority", "normal"),
            "text": (msg.get("text") or "").splitlines()[0][:90],
            "status": status,
            "reply_to": msg.get("reply_to"),
        })

# Find replies addressed back TO <from_agent>: walk inbox/<from> + processed/<from>
replies_by_target = {}  # reply_to_id -> latest reply ts
for area in ("inbox", "processed"):
    pattern = os.path.join(ctx_root, area, from_agent, "*.json")
    for path in glob.glob(pattern):
        try:
            with open(path) as f:
                msg = json.load(f)
        except Exception:
            continue
        rt = msg.get("reply_to")
        if not rt:
            continue
        try:
            rts = datetime.fromisoformat((msg.get("timestamp") or "").replace("Z", "+00:00")).timestamp()
        except Exception:
            continue
        prev = replies_by_target.get(rt, 0)
        if rts > prev:
            replies_by_target[rt] = rts

# Filter to outbound dispatches only (messages that ARE NOT replies themselves)
open_dispatches = [d for d in dispatches if not d["reply_to"]]
open_dispatches.sort(key=lambda d: d["ts"], reverse=True)

# Render
def fmt_age(seconds):
    if seconds < 3600:
        return f"{int(seconds/60)}m"
    if seconds < 86400:
        return f"{seconds/3600:.1f}h"
    return f"{seconds/86400:.1f}d"

def colorize(stale_h, text):
    if stale_h >= 12: return f"\033[31m{text}\033[0m"   # red
    if stale_h >= 4:  return f"\033[33m{text}\033[0m"   # yellow
    return text

print(f"\nDispatch ledger — from {from_agent} — last {window_h}h — {now.strftime('%Y-%m-%d %H:%M UTC')}")
print(f"Found {len(open_dispatches)} dispatches\n")

if not open_dispatches:
    print("  (no dispatches in window)")
    sys.exit(0)

w = (12, 12, 8, 10, 12, 90)
hdr = f"  {'TO':<{w[0]}}{'AGE':<{w[1]}}{'PRI':<{w[2]}}{'STATUS':<{w[3]}}{'REPLY':<{w[4]}}TEXT"
print(hdr)
print("  " + "-" * (sum(w) + 4))

for d in open_dispatches:
    age = now.timestamp() - d["ts"]
    age_h = age / 3600
    reply_ts = replies_by_target.get(d["id"])
    reply_age = (now.timestamp() - reply_ts) if reply_ts else None
    if reply_ts:
        reply_str = f"{fmt_age(reply_age)} ago"
        stale_h = reply_age / 3600
    else:
        reply_str = "NO REPLY"
        stale_h = age_h
    line = f"  {d['to']:<{w[0]}}{fmt_age(age):<{w[1]}}{d['priority']:<{w[2]}}{d['status']:<{w[3]}}{reply_str:<{w[4]}}{d['text']}"
    print(colorize(stale_h, line))

print()
red = sum(1 for d in open_dispatches
          if (replies_by_target.get(d["id"]) is None and (now.timestamp() - d["ts"]) / 3600 >= 12) or
             (replies_by_target.get(d["id"]) is not None and (now.timestamp() - replies_by_target[d["id"]]) / 3600 >= 12))
yellow = sum(1 for d in open_dispatches
             if (replies_by_target.get(d["id"]) is None and 4 <= (now.timestamp() - d["ts"]) / 3600 < 12) or
                (replies_by_target.get(d["id"]) is not None and 4 <= (now.timestamp() - replies_by_target[d["id"]]) / 3600 < 12))
print(f"  STALE >12h: {red}   STALE >4h: {yellow}   FRESH: {len(open_dispatches) - red - yellow}")
PY
