/**
 * stall-detector.ts — Outbound-frozen PTY watchdog (mozart wedge fix, 2026-06-23).
 *
 * Wedge symptom: opus auto-compact stream-timeout silently freezes the PTY so
 * cron prompts pile into a dead input buffer with no crash event. The
 * `--continue` boot only fires when something tries to read the buffer, which
 * never happens. PM2 sees a live process, the crash-loop guard sees no
 * crashes, and the agent looks online but is effectively dead.
 *
 * Detection signal: cron `last_fire` timestamps in cron-state.json keep
 * advancing while the agent's outbound-messages.jsonl stops growing. A healthy
 * agent that received N cron prompts in the last 30 min should produce *some*
 * outbound traffic (Telegram, agent-to-agent, ack-inbox, even a heartbeat
 * record). If it has produced nothing across ≥2 fires, the buffer is dead.
 *
 * Action: soft `restartAgent()` (preserves history via --continue). The newly
 * spawned PTY drains the queued buffer and resumes.
 *
 * Per-agent overrides in {agentDir}/config.json:
 *   - stall_detector_disabled: true        → skip this agent entirely
 *   - stall_detector_threshold_fires: 2    → min recent fires required (default 2)
 *   - stall_detector_lookback_minutes: 30  → how far back to scan (default 30)
 *
 * Operator log: {CTX_ROOT}/logs/shared/stall-detector.log (one line per scan).
 */

import { existsSync, readFileSync, statSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CronStateEntry {
  name: string;
  last_fire?: string;
  interval?: string;
}

export interface StallScanResult {
  /** Names of agents that are stalled and should be restarted. */
  stalledAgents: string[];
  /** Per-agent diagnostic breakdown (always populated, even if empty). */
  details: StallAgentDetail[];
}

export interface StallAgentDetail {
  agent: string;
  reason: 'stalled' | 'healthy' | 'skipped';
  /** Human-readable explanation for status. */
  note: string;
  /** Recent cron fires inside lookback window (ISO timestamps, ascending). */
  recentFires: string[];
  /** Outbound mtime (ISO) or null if outbound file missing. */
  outboundMtime: string | null;
}

export interface StallDetectorDeps {
  /** Roots: ctxRoot for state + logs; agentDirs map for config.json reads. */
  ctxRoot: string;
  /** Map: agent name → on-disk agent directory (with config.json). */
  agentDirs: Map<string, string>;
  /** Now provider (injectable for tests). */
  now?: () => number;
}

export interface RunStallDetectorDeps extends StallDetectorDeps {
  /** Trigger restart. Required for live runs; pass a stub for dry-run. */
  restartAgent: (name: string, reason: string) => Promise<void>;
  /** When true, never call restartAgent — log "would-restart" only. */
  dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_THRESHOLD_FIRES = 2;
export const DEFAULT_LOOKBACK_MINUTES = 30;
export const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

export function cronStatePath(ctxRoot: string, agent: string): string {
  return join(ctxRoot, 'state', agent, 'cron-state.json');
}

export function outboundLogPath(ctxRoot: string, agent: string): string {
  return join(ctxRoot, 'logs', agent, 'outbound-messages.jsonl');
}

export function stallDetectorLogPath(ctxRoot: string): string {
  return join(ctxRoot, 'logs', 'shared', 'stall-detector.log');
}

// ---------------------------------------------------------------------------
// Config reader (per-agent overrides)
// ---------------------------------------------------------------------------

interface AgentStallConfig {
  disabled: boolean;
  thresholdFires: number;
  lookbackMinutes: number;
}

export function readAgentStallConfig(agentDir: string): AgentStallConfig {
  const cfgPath = join(agentDir, 'config.json');
  if (!existsSync(cfgPath)) {
    return {
      disabled: false,
      thresholdFires: DEFAULT_THRESHOLD_FIRES,
      lookbackMinutes: DEFAULT_LOOKBACK_MINUTES,
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(cfgPath, 'utf-8')) as Record<string, unknown>;
    const disabled = parsed.stall_detector_disabled === true;
    const thresholdFires = typeof parsed.stall_detector_threshold_fires === 'number'
      ? parsed.stall_detector_threshold_fires
      : DEFAULT_THRESHOLD_FIRES;
    const lookbackMinutes = typeof parsed.stall_detector_lookback_minutes === 'number'
      ? parsed.stall_detector_lookback_minutes
      : DEFAULT_LOOKBACK_MINUTES;
    return { disabled, thresholdFires, lookbackMinutes };
  } catch {
    return {
      disabled: false,
      thresholdFires: DEFAULT_THRESHOLD_FIRES,
      lookbackMinutes: DEFAULT_LOOKBACK_MINUTES,
    };
  }
}

// ---------------------------------------------------------------------------
// Core scan
// ---------------------------------------------------------------------------

interface CronStateFile {
  updated_at?: string;
  crons?: CronStateEntry[];
}

export function readCronFires(ctxRoot: string, agent: string): CronStateEntry[] {
  const p = cronStatePath(ctxRoot, agent);
  if (!existsSync(p)) return [];
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as CronStateFile;
    return Array.isArray(parsed.crons) ? parsed.crons : [];
  } catch {
    return [];
  }
}

export function readOutboundMtimeMs(ctxRoot: string, agent: string): number | null {
  const p = outboundLogPath(ctxRoot, agent);
  if (!existsSync(p)) return null;
  try {
    return statSync(p).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Pure scan — given dependency injection of state-readers, return which agents
 * are stalled. Does not perform restart or log writes. Exposed for tests.
 */
export function scanForStalls(deps: StallDetectorDeps): StallScanResult {
  const now = deps.now ? deps.now() : Date.now();
  const details: StallAgentDetail[] = [];
  const stalled: string[] = [];

  for (const [agent, agentDir] of deps.agentDirs) {
    const cfg = readAgentStallConfig(agentDir);

    if (cfg.disabled) {
      details.push({
        agent,
        reason: 'skipped',
        note: 'stall_detector_disabled=true',
        recentFires: [],
        outboundMtime: null,
      });
      continue;
    }

    const lookbackMs = cfg.lookbackMinutes * 60 * 1000;
    const cutoffMs = now - lookbackMs;

    const allFires = readCronFires(deps.ctxRoot, agent);
    const recentFires = allFires
      .map((c) => c.last_fire ? Date.parse(c.last_fire) : NaN)
      .filter((t) => Number.isFinite(t) && t >= cutoffMs)
      .sort((a, b) => a - b);

    const outboundMtime = readOutboundMtimeMs(deps.ctxRoot, agent);

    const baseDetail = {
      agent,
      recentFires: recentFires.map((t) => new Date(t).toISOString()),
      outboundMtime: outboundMtime ? new Date(outboundMtime).toISOString() : null,
    };

    if (recentFires.length < cfg.thresholdFires) {
      details.push({
        ...baseDetail,
        reason: 'healthy',
        note: `only ${recentFires.length} fires in last ${cfg.lookbackMinutes}min (threshold=${cfg.thresholdFires})`,
      });
      continue;
    }

    // The second-most-recent fire — if outbound is older than this, then the
    // most-recent fire arrived after outbound already went silent, confirming
    // the agent is dead in the water.
    const secondToLastFireMs = recentFires[recentFires.length - 2];

    if (outboundMtime === null) {
      // No outbound history at all + N recent fires = stalled. A brand-new
      // agent with no outbound is a corner case the operator can suppress via
      // stall_detector_disabled=true until they bootstrap outbound traffic.
      details.push({
        ...baseDetail,
        reason: 'stalled',
        note: `${recentFires.length} fires in window, no outbound file present`,
      });
      stalled.push(agent);
      continue;
    }

    if (outboundMtime < secondToLastFireMs) {
      details.push({
        ...baseDetail,
        reason: 'stalled',
        note: `${recentFires.length} fires in window, outbound frozen ${Math.round((secondToLastFireMs - outboundMtime) / 1000)}s before second-to-last fire`,
      });
      stalled.push(agent);
      continue;
    }

    details.push({
      ...baseDetail,
      reason: 'healthy',
      note: `${recentFires.length} fires in window, outbound progressing`,
    });
  }

  return { stalledAgents: stalled, details };
}

// ---------------------------------------------------------------------------
// Live runner: scans, logs, restarts.
// ---------------------------------------------------------------------------

/**
 * Append one line to the shared stall-detector log. Best effort — failures
 * are swallowed so the daemon never crashes on a log write.
 */
function appendStallLog(ctxRoot: string, line: string): void {
  try {
    const p = stallDetectorLogPath(ctxRoot);
    mkdirSync(join(ctxRoot, 'logs', 'shared'), { recursive: true });
    appendFileSync(p, line + '\n', 'utf-8');
  } catch {
    /* non-fatal */
  }
}

export async function runStallDetector(deps: RunStallDetectorDeps): Promise<StallScanResult> {
  const result = scanForStalls(deps);
  const now = new Date().toISOString();
  const scannedCount = deps.agentDirs.size;

  const summary = {
    ts: now,
    scanned: scannedCount,
    stalled: result.stalledAgents.length,
    stalled_agents: result.stalledAgents,
    dry_run: deps.dryRun === true,
  };
  appendStallLog(deps.ctxRoot, `[scan] ${JSON.stringify(summary)}`);

  if (result.stalledAgents.length === 0) {
    return result;
  }

  // Action phase.
  for (const agent of result.stalledAgents) {
    const detail = result.details.find((d) => d.agent === agent)!;
    const reason = `stall detector: ${detail.note}`;
    if (deps.dryRun) {
      appendStallLog(deps.ctxRoot, `[dry-run] would-restart agent=${agent} reason=${JSON.stringify(reason)}`);
      continue;
    }
    try {
      await deps.restartAgent(agent, reason);
      appendStallLog(deps.ctxRoot, `[action] restarted agent=${agent} reason=${JSON.stringify(reason)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendStallLog(deps.ctxRoot, `[error] restart-failed agent=${agent} err=${JSON.stringify(msg)}`);
    }
  }

  return result;
}
