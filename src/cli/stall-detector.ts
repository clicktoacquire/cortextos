import { Command } from 'commander';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { runStallDetector, stallDetectorLogPath } from '../daemon/stall-detector.js';

/**
 * Build the agentDirs map without touching the live daemon — used by the CLI
 * commands (`status`, `dry-run`) so operators can introspect from the shell.
 * Source of truth is the orgs tree under {CTX_FRAMEWORK_ROOT}/orgs/{org}/agents/{name}.
 */
function discoverAgentDirs(frameworkRoot: string): Map<string, string> {
  const out = new Map<string, string>();
  const orgsRoot = join(frameworkRoot, 'orgs');
  if (!existsSync(orgsRoot)) return out;
  for (const org of readdirSync(orgsRoot)) {
    const agentsDir = join(orgsRoot, org, 'agents');
    if (!existsSync(agentsDir)) continue;
    for (const name of readdirSync(agentsDir)) {
      const agentDir = join(agentsDir, name);
      const cfgPath = join(agentDir, 'config.json');
      if (existsSync(cfgPath)) {
        out.set(name, agentDir);
      }
    }
  }
  return out;
}

function resolveRoots(instance?: string): { ctxRoot: string; frameworkRoot: string } {
  const instanceId = instance || process.env.CTX_INSTANCE_ID || 'default';
  const ctxRoot = join(homedir(), '.cortextos', instanceId);
  const frameworkRoot = process.env.CTX_FRAMEWORK_ROOT || '';
  if (!frameworkRoot) {
    console.error('CTX_FRAMEWORK_ROOT is not set — required to discover agent directories.');
    process.exit(1);
  }
  return { ctxRoot, frameworkRoot };
}

const statusCommand = new Command('status')
  .description('Show recent stall-detector scans + actions')
  .option('--instance <id>', 'Instance ID')
  .option('--lines <n>', 'Number of log lines to show', '20')
  .action((opts: { instance?: string; lines: string }) => {
    const { ctxRoot } = resolveRoots(opts.instance);
    const logPath = stallDetectorLogPath(ctxRoot);
    if (!existsSync(logPath)) {
      console.log(`No stall-detector log yet at ${logPath}.`);
      return;
    }
    const content = readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const n = Math.max(1, parseInt(opts.lines, 10) || 20);
    const tail = lines.slice(-n);
    const mtime = statSync(logPath).mtime.toISOString();
    console.log(`stall-detector log: ${logPath} (last modified ${mtime})`);
    console.log(`showing last ${tail.length} of ${lines.length} lines:\n`);
    for (const line of tail) console.log(line);
  });

const dryRunCommand = new Command('dry-run')
  .description('Scan for stalled agents without restarting any')
  .option('--instance <id>', 'Instance ID')
  .option('--format <format>', 'Output format: json or text', 'text')
  .action(async (opts: { instance?: string; format: string }) => {
    const { ctxRoot, frameworkRoot } = resolveRoots(opts.instance);
    const agentDirs = discoverAgentDirs(frameworkRoot);
    if (agentDirs.size === 0) {
      console.log(`No agents discovered under ${frameworkRoot}/orgs.`);
      return;
    }
    const result = await runStallDetector({
      ctxRoot,
      agentDirs,
      dryRun: true,
      restartAgent: async () => { /* no-op for dry-run */ },
    });
    if (opts.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`Scanned ${agentDirs.size} agents. Stalled: ${result.stalledAgents.length}.\n`);
    for (const d of result.details) {
      const icon = d.reason === 'stalled' ? '🛑' : d.reason === 'skipped' ? '⊘' : '✓';
      console.log(`${icon} ${d.agent.padEnd(14)} ${d.reason.padEnd(8)} ${d.note}`);
      if (d.reason === 'stalled') {
        console.log(`    recent fires: ${d.recentFires.join(', ')}`);
        console.log(`    outbound mtime: ${d.outboundMtime ?? '(none)'}`);
      }
    }
  });

export const stallDetectorCommand = new Command('stall-detector')
  .description('Inspect and dry-run the daemon stall detector')
  .addCommand(statusCommand)
  .addCommand(dryRunCommand);
