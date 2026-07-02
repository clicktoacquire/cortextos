/**
 * stall-detector — outbound-frozen PTY watchdog (mozart wedge fix 2026-06-23).
 *
 * Covers:
 *  - unit: cron-progressing + outbound-frozen → stalled, restart fires
 *  - regression: cron-progressing + outbound-growing → healthy, no restart
 *  - regression: per-agent stall_detector_disabled override skips agent
 *  - regression: only 1 recent fire (< threshold) → healthy
 *  - integration: real frozen-outbound state on tmpdir → detector fires
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  scanForStalls,
  runStallDetector,
  cronStatePath,
  outboundLogPath,
  stallDetectorLogPath,
  DEFAULT_LOOKBACK_MINUTES,
  DEFAULT_THRESHOLD_FIRES,
} from '../../../src/daemon/stall-detector';

interface Fixture {
  ctxRoot: string;
  agentRoot: string;
  cleanup: () => void;
}

function makeFixture(): Fixture {
  const ctxRoot = mkdtempSync(join(tmpdir(), 'stall-ctx-'));
  const agentRoot = mkdtempSync(join(tmpdir(), 'stall-agents-'));
  return {
    ctxRoot,
    agentRoot,
    cleanup: () => {
      rmSync(ctxRoot, { recursive: true, force: true });
      rmSync(agentRoot, { recursive: true, force: true });
    },
  };
}

function writeAgentConfig(agentRoot: string, name: string, cfg: Record<string, unknown> = {}): string {
  const dir = join(agentRoot, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ name, ...cfg }));
  return dir;
}

function writeCronFires(ctxRoot: string, name: string, fires: string[]): void {
  const p = cronStatePath(ctxRoot, name);
  mkdirSync(join(ctxRoot, 'state', name), { recursive: true });
  const crons = fires.map((ts, i) => ({ name: `cron-${i}`, last_fire: ts }));
  writeFileSync(p, JSON.stringify({ crons }));
}

function writeOutboundAtMtime(ctxRoot: string, name: string, mtimeMs: number): void {
  const p = outboundLogPath(ctxRoot, name);
  mkdirSync(join(ctxRoot, 'logs', name), { recursive: true });
  writeFileSync(p, '{"ts":"x"}\n');
  const seconds = mtimeMs / 1000;
  utimesSync(p, seconds, seconds);
}

describe('stall-detector — scanForStalls (pure)', () => {
  let fx: Fixture;
  beforeEach(() => { fx = makeFixture(); });
  afterEach(() => fx.cleanup());

  it('flags outbound-frozen agent as stalled when 2 recent fires exist', () => {
    const now = Date.parse('2026-06-23T17:00:00Z');
    const agentDir = writeAgentConfig(fx.agentRoot, 'wedged');
    // 2 fires inside 30min window
    writeCronFires(fx.ctxRoot, 'wedged', [
      '2026-06-23T16:35:00Z',
      '2026-06-23T16:55:00Z',
    ]);
    // outbound mtime BEFORE the second-to-last fire (16:35 = first fire here)
    writeOutboundAtMtime(fx.ctxRoot, 'wedged', Date.parse('2026-06-23T16:20:00Z'));

    const result = scanForStalls({
      ctxRoot: fx.ctxRoot,
      agentDirs: new Map([['wedged', agentDir]]),
      now: () => now,
    });

    expect(result.stalledAgents).toEqual(['wedged']);
    expect(result.details[0].reason).toBe('stalled');
    expect(result.details[0].recentFires).toHaveLength(2);
  });

  it('marks healthy when outbound mtime is AFTER second-to-last fire', () => {
    const now = Date.parse('2026-06-23T17:00:00Z');
    const agentDir = writeAgentConfig(fx.agentRoot, 'alive');
    writeCronFires(fx.ctxRoot, 'alive', [
      '2026-06-23T16:35:00Z',
      '2026-06-23T16:55:00Z',
    ]);
    // outbound progressing — after the first fire
    writeOutboundAtMtime(fx.ctxRoot, 'alive', Date.parse('2026-06-23T16:50:00Z'));

    const result = scanForStalls({
      ctxRoot: fx.ctxRoot,
      agentDirs: new Map([['alive', agentDir]]),
      now: () => now,
    });

    expect(result.stalledAgents).toEqual([]);
    expect(result.details[0].reason).toBe('healthy');
  });

  it('skips agents with stall_detector_disabled=true', () => {
    const now = Date.parse('2026-06-23T17:00:00Z');
    const agentDir = writeAgentConfig(fx.agentRoot, 'optout', { stall_detector_disabled: true });
    writeCronFires(fx.ctxRoot, 'optout', [
      '2026-06-23T16:35:00Z',
      '2026-06-23T16:55:00Z',
    ]);
    writeOutboundAtMtime(fx.ctxRoot, 'optout', Date.parse('2026-06-23T15:00:00Z')); // ancient

    const result = scanForStalls({
      ctxRoot: fx.ctxRoot,
      agentDirs: new Map([['optout', agentDir]]),
      now: () => now,
    });

    expect(result.stalledAgents).toEqual([]);
    expect(result.details[0].reason).toBe('skipped');
    expect(result.details[0].note).toMatch(/disabled/);
  });

  it('marks healthy when only 1 fire inside lookback window (below threshold)', () => {
    const now = Date.parse('2026-06-23T17:00:00Z');
    const agentDir = writeAgentConfig(fx.agentRoot, 'quiet');
    writeCronFires(fx.ctxRoot, 'quiet', ['2026-06-23T16:50:00Z']);
    writeOutboundAtMtime(fx.ctxRoot, 'quiet', Date.parse('2026-06-23T14:00:00Z'));

    const result = scanForStalls({
      ctxRoot: fx.ctxRoot,
      agentDirs: new Map([['quiet', agentDir]]),
      now: () => now,
    });

    expect(result.stalledAgents).toEqual([]);
    expect(result.details[0].reason).toBe('healthy');
  });

  it('marks stalled when threshold met but no outbound file exists at all', () => {
    const now = Date.parse('2026-06-23T17:00:00Z');
    const agentDir = writeAgentConfig(fx.agentRoot, 'newby');
    writeCronFires(fx.ctxRoot, 'newby', [
      '2026-06-23T16:35:00Z',
      '2026-06-23T16:55:00Z',
    ]);
    // no outbound file written

    const result = scanForStalls({
      ctxRoot: fx.ctxRoot,
      agentDirs: new Map([['newby', agentDir]]),
      now: () => now,
    });

    expect(result.stalledAgents).toEqual(['newby']);
    expect(result.details[0].reason).toBe('stalled');
    expect(result.details[0].outboundMtime).toBeNull();
  });

  it('respects per-agent stall_detector_threshold_fires override', () => {
    const now = Date.parse('2026-06-23T17:00:00Z');
    const agentDir = writeAgentConfig(fx.agentRoot, 'thresh3', { stall_detector_threshold_fires: 3 });
    // only 2 fires — should be healthy with override=3
    writeCronFires(fx.ctxRoot, 'thresh3', [
      '2026-06-23T16:35:00Z',
      '2026-06-23T16:55:00Z',
    ]);
    writeOutboundAtMtime(fx.ctxRoot, 'thresh3', Date.parse('2026-06-23T14:00:00Z'));

    const result = scanForStalls({
      ctxRoot: fx.ctxRoot,
      agentDirs: new Map([['thresh3', agentDir]]),
      now: () => now,
    });

    expect(result.stalledAgents).toEqual([]);
    expect(result.details[0].reason).toBe('healthy');
  });

  it('drops fires older than the lookback window', () => {
    const now = Date.parse('2026-06-23T17:00:00Z');
    const agentDir = writeAgentConfig(fx.agentRoot, 'oldfires');
    // both fires older than 30min window (16:30 cutoff)
    writeCronFires(fx.ctxRoot, 'oldfires', [
      '2026-06-23T15:00:00Z',
      '2026-06-23T16:00:00Z',
    ]);
    writeOutboundAtMtime(fx.ctxRoot, 'oldfires', Date.parse('2026-06-23T13:00:00Z'));

    const result = scanForStalls({
      ctxRoot: fx.ctxRoot,
      agentDirs: new Map([['oldfires', agentDir]]),
      now: () => now,
    });

    expect(result.stalledAgents).toEqual([]);
    expect(result.details[0].recentFires).toHaveLength(0);
  });
});

describe('stall-detector — runStallDetector (live runner)', () => {
  let fx: Fixture;
  beforeEach(() => { fx = makeFixture(); });
  afterEach(() => fx.cleanup());

  it('integration: real on-disk frozen state triggers restart + log line', async () => {
    const now = Date.parse('2026-06-23T17:00:00Z');
    const agentDir = writeAgentConfig(fx.agentRoot, 'wedged');
    writeCronFires(fx.ctxRoot, 'wedged', [
      '2026-06-23T16:35:00Z',
      '2026-06-23T16:55:00Z',
    ]);
    writeOutboundAtMtime(fx.ctxRoot, 'wedged', Date.parse('2026-06-23T16:20:00Z'));

    const restartCalls: { agent: string; reason: string }[] = [];
    await runStallDetector({
      ctxRoot: fx.ctxRoot,
      agentDirs: new Map([['wedged', agentDir]]),
      now: () => now,
      restartAgent: async (agent, reason) => { restartCalls.push({ agent, reason }); },
    });

    expect(restartCalls).toEqual([
      { agent: 'wedged', reason: expect.stringContaining('stall detector') },
    ]);
    const logContent = readFileSync(stallDetectorLogPath(fx.ctxRoot), 'utf-8');
    expect(logContent).toContain('[scan]');
    expect(logContent).toContain('[action]');
    expect(logContent).toContain('"stalled_agents":["wedged"]');
  });

  it('regression: healthy fleet → no restart, no action log line', async () => {
    const now = Date.parse('2026-06-23T17:00:00Z');
    const agentDir = writeAgentConfig(fx.agentRoot, 'alive');
    writeCronFires(fx.ctxRoot, 'alive', [
      '2026-06-23T16:35:00Z',
      '2026-06-23T16:55:00Z',
    ]);
    writeOutboundAtMtime(fx.ctxRoot, 'alive', Date.parse('2026-06-23T16:58:00Z'));

    const restartCalls: string[] = [];
    await runStallDetector({
      ctxRoot: fx.ctxRoot,
      agentDirs: new Map([['alive', agentDir]]),
      now: () => now,
      restartAgent: async (agent) => { restartCalls.push(agent); },
    });

    expect(restartCalls).toEqual([]);
    const logContent = readFileSync(stallDetectorLogPath(fx.ctxRoot), 'utf-8');
    expect(logContent).toContain('"stalled":0');
    expect(logContent).not.toContain('[action]');
  });

  it('dry-run mode: stalled agent logs would-restart but does NOT call restartAgent', async () => {
    const now = Date.parse('2026-06-23T17:00:00Z');
    const agentDir = writeAgentConfig(fx.agentRoot, 'wedged');
    writeCronFires(fx.ctxRoot, 'wedged', [
      '2026-06-23T16:35:00Z',
      '2026-06-23T16:55:00Z',
    ]);
    writeOutboundAtMtime(fx.ctxRoot, 'wedged', Date.parse('2026-06-23T16:20:00Z'));

    const restartCalls: string[] = [];
    await runStallDetector({
      ctxRoot: fx.ctxRoot,
      agentDirs: new Map([['wedged', agentDir]]),
      now: () => now,
      dryRun: true,
      restartAgent: async (agent) => { restartCalls.push(agent); },
    });

    expect(restartCalls).toEqual([]);
    const logContent = readFileSync(stallDetectorLogPath(fx.ctxRoot), 'utf-8');
    expect(logContent).toContain('[dry-run]');
    expect(logContent).toContain('would-restart agent=wedged');
  });

  it('records [error] log line when restartAgent throws', async () => {
    const now = Date.parse('2026-06-23T17:00:00Z');
    const agentDir = writeAgentConfig(fx.agentRoot, 'wedged');
    writeCronFires(fx.ctxRoot, 'wedged', [
      '2026-06-23T16:35:00Z',
      '2026-06-23T16:55:00Z',
    ]);
    writeOutboundAtMtime(fx.ctxRoot, 'wedged', Date.parse('2026-06-23T16:20:00Z'));

    await runStallDetector({
      ctxRoot: fx.ctxRoot,
      agentDirs: new Map([['wedged', agentDir]]),
      now: () => now,
      restartAgent: async () => { throw new Error('pm2 unreachable'); },
    });

    const logContent = readFileSync(stallDetectorLogPath(fx.ctxRoot), 'utf-8');
    expect(logContent).toContain('[error] restart-failed agent=wedged');
    expect(logContent).toContain('pm2 unreachable');
  });
});

describe('stall-detector — defaults', () => {
  it('exports the defaults mozart spec called for', () => {
    expect(DEFAULT_THRESHOLD_FIRES).toBe(2);
    expect(DEFAULT_LOOKBACK_MINUTES).toBe(30);
  });

  it('cronStatePath + outboundLogPath + stallDetectorLogPath resolve under ctxRoot', () => {
    const root = '/tmp/fake-ctx';
    expect(cronStatePath(root, 'alpha')).toBe('/tmp/fake-ctx/state/alpha/cron-state.json');
    expect(outboundLogPath(root, 'alpha')).toBe('/tmp/fake-ctx/logs/alpha/outbound-messages.jsonl');
    expect(stallDetectorLogPath(root)).toBe('/tmp/fake-ctx/logs/shared/stall-detector.log');
    expect(existsSync(root)).toBe(false); // pure path helpers, no I/O
  });
});
