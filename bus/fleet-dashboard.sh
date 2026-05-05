#!/usr/bin/env bash
# fleet-dashboard.sh — single-pane CLI for fleet health, cost, activity.
#
# Aligned with Rob's vision pillar 5 (internal dashboard) + pillar 7
# (verification/observability). Reads agent state files, context_status,
# heartbeats, inbox/processed/dispatch state, and renders one screen.
#
# Usage:
#   fleet-dashboard.sh              # default: all agents, 24h window
#   fleet-dashboard.sh --window 1   # 1-hour window
#   fleet-dashboard.sh --json       # machine-readable
#   fleet-dashboard.sh --org <org>  # default click-to-acquire
#
# Run from any agent or Rob's shell. No bus daemon dependency.

set -euo pipefail

WINDOW_H=24
JSON=0
INSTANCE="${CTX_INSTANCE_ID:-default}"
ORG="${CTX_ORG:-click-to-acquire}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --window) WINDOW_H="$2"; shift 2 ;;
    --json) JSON=1; shift ;;
    --instance) INSTANCE="$2"; shift 2 ;;
    --org) ORG="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: fleet-dashboard.sh [--window <hours>] [--json] [--instance <id>] [--org <name>]"
      exit 0 ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

CTX_ROOT="$HOME/.cortextos/$INSTANCE"
FRAMEWORK_ROOT="${CTX_FRAMEWORK_ROOT:-/Users/robert/cortextos}"
AGENT_ROOT="$FRAMEWORK_ROOT/orgs/$ORG/agents"

exec /usr/bin/env python3 - "$CTX_ROOT" "$AGENT_ROOT" "$WINDOW_H" "$JSON" <<'PY'
import json, os, sys, glob, time
from datetime import datetime, timezone, timedelta

ctx_root, agent_root, window_h, want_json = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4] == "1"
now = datetime.now(timezone.utc)
cutoff_epoch = now.timestamp() - window_h * 3600

agents = sorted(d for d in os.listdir(agent_root) if os.path.isdir(os.path.join(agent_root, d)))

def safe_json(path):
    try: return json.load(open(path))
    except Exception: return None

def file_age_h(path):
    if not os.path.exists(path): return None
    return (now.timestamp() - os.path.getmtime(path)) / 3600

def count_files_newer_than(d, cutoff):
    if not os.path.isdir(d): return 0
    return sum(1 for f in os.listdir(d) if os.path.getmtime(os.path.join(d, f)) > cutoff)

def color(stale_h, text):
    if stale_h is None: return f"\033[90m{text}\033[0m"  # gray
    if stale_h >= 24:    return f"\033[31m{text}\033[0m"  # red
    if stale_h >= 8:     return f"\033[33m{text}\033[0m"  # yellow
    return f"\033[32m{text}\033[0m"                       # green

rows = []
for a in agents:
    cfg = safe_json(os.path.join(agent_root, a, "config.json")) or {}
    ctx = safe_json(os.path.join(ctx_root, "state", a, "context_status.json")) or {}
    hb_path = os.path.join(ctx_root, "state", a, "heartbeat.json")
    hb_age_h = file_age_h(hb_path)
    palace_dir = os.path.join(agent_root, a, "palace")
    palace_size_mb = 0
    if os.path.isdir(palace_dir):
        for root, _, files in os.walk(palace_dir):
            for f in files:
                try: palace_size_mb += os.path.getsize(os.path.join(root, f))
                except: pass
        palace_size_mb /= (1024*1024)

    # Inbox/processed counts in window
    inbox_dir = os.path.join(ctx_root, "inbox", a)
    proc_dir  = os.path.join(ctx_root, "processed", a)
    pending = count_files_newer_than(inbox_dir, 0) if os.path.isdir(inbox_dir) else 0
    in_window_processed = count_files_newer_than(proc_dir, cutoff_epoch)

    # Crashes in window
    crash_log = os.path.join(ctx_root, "logs", a, "crashes.log")
    crashes_window = 0
    if os.path.exists(crash_log):
        for line in open(crash_log):
            if "CRASH" not in line: continue
            try:
                ts = line[1:line.index(']')]
                e = datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
                if e > cutoff_epoch: crashes_window += 1
            except: pass

    # Daily memory freshness (today's file present?)
    today = now.strftime("%Y-%m-%d")
    daily_today = os.path.exists(os.path.join(agent_root, a, "memory", f"{today}.md"))

    # Token usage approximation from outbound log
    out_log = os.path.join(ctx_root, "logs", a, "outbound-messages.jsonl")
    out_count = 0
    if os.path.exists(out_log):
        for line in open(out_log):
            try:
                m = json.loads(line)
                ts = m.get("timestamp") or ""
                e = datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
                if e > cutoff_epoch: out_count += 1
            except: pass

    rows.append({
        "agent": a,
        "model": cfg.get("model", "?"),
        "ctx_pct": ctx.get("used_percentage"),
        "ctx_window": ctx.get("context_window_size"),
        "hb_age_h": hb_age_h,
        "palace_mb": round(palace_size_mb, 1),
        "pending": pending,
        "processed_window": in_window_processed,
        "outbound_window": out_count,
        "crashes_window": crashes_window,
        "daily_memory_today": daily_today,
    })

if want_json:
    print(json.dumps({
        "generated_at": now.isoformat(),
        "window_hours": window_h,
        "rows": rows,
    }, indent=2, default=str))
    sys.exit(0)

# Pretty print
print(f"\n  Fleet dashboard — {now.strftime('%Y-%m-%d %H:%M UTC')} — window {window_h}h\n")
hdr = f"  {'AGENT':<10}{'MODEL':<26}{'CTX%':>5}{'WIN':>9}{'HB(h)':>7}{'PAL(MB)':>9}{'IN':>4}{'PROC':>6}{'OUT':>5}{'CR':>4} DAILY"
print(hdr)
print("  " + "-"*(len(hdr)-2))

for r in rows:
    ctx_pct = r["ctx_pct"]
    ctx_str = f"{ctx_pct}%" if ctx_pct is not None else "?"
    win_str = f"{int(r['ctx_window']/1000)}k" if r['ctx_window'] else "?"
    hb_str  = f"{r['hb_age_h']:.1f}" if r['hb_age_h'] is not None else "?"
    daily   = "Y" if r["daily_memory_today"] else color(48, "N")  # red N if missing today
    crash_str = color(0 if r["crashes_window"] == 0 else 24, str(r["crashes_window"]))
    line = (f"  {r['agent']:<10}{r['model']:<26}{ctx_str:>5}{win_str:>9}"
            f"{hb_str:>7}{r['palace_mb']:>9}{r['pending']:>4}"
            f"{r['processed_window']:>6}{r['outbound_window']:>5}{crash_str:>4} {daily}")
    print(line)

print()
total_pending = sum(r["pending"] for r in rows)
total_proc    = sum(r["processed_window"] for r in rows)
total_out     = sum(r["outbound_window"] for r in rows)
total_crash   = sum(r["crashes_window"] for r in rows)
no_daily      = sum(1 for r in rows if not r["daily_memory_today"])
print(f"  TOTALS: pending={total_pending} processed={total_proc} outbound={total_out} crashes={total_crash} missing-daily-memory={no_daily}\n")

# Health flags
flags = []
for r in rows:
    if r["pending"] > 5:
        flags.append(f"  ⚠ {r['agent']}: inbox backlog {r['pending']} pending")
    if r["hb_age_h"] is not None and r["hb_age_h"] > 8:
        flags.append(f"  ⚠ {r['agent']}: heartbeat stale {r['hb_age_h']:.1f}h")
    if r["crashes_window"] > 0:
        flags.append(f"  ⚠ {r['agent']}: {r['crashes_window']} crash(es) in window")
    if not r["daily_memory_today"]:
        flags.append(f"  ⚠ {r['agent']}: no daily memory for today ({today})")
if flags:
    print("  HEALTH FLAGS:")
    for f in flags: print(f)
    print()
PY
