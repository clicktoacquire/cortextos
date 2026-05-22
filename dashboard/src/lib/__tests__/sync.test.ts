import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ---------------------------------------------------------------------------
// In-memory Postgres mock — must be installed before any module imports
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

const tables: Record<string, Map<string, Row>> = {
  tasks:     new Map(),
  approvals: new Map(),
  events:    new Map(),
  heartbeats:new Map(),
  sync_meta: new Map(),
  cost_entries: new Map(),
};

function clearTable(name: string): void {
  tables[name]?.clear();
}

function clearSyncMeta(): void {
  tables.sync_meta.clear();
}

function queryTable(name: string): Row[] {
  return Array.from(tables[name]?.values() ?? []);
}

function findById(table: string, id: string): Row | undefined {
  return tables[table]?.get(id);
}

function findWhere(table: string, col: string, val: unknown): Row[] {
  return queryTable(table).filter((r) => r[col] === val);
}

// Minimal tagged-template SQL mock
// Supports: INSERT ... ON CONFLICT, SELECT, DELETE FROM
function buildSqlMock() {
  function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]> {
    const query = strings
      .map((s, i) => s + (i < values.length ? `__V${i}__` : ''))
      .join('')
      .trim()
      .replace(/\s+/g, ' ');

    const upperQ = query.toUpperCase();

    // INSERT INTO <table> ... VALUES ... ON CONFLICT (id) DO UPDATE ...
    if (upperQ.startsWith('INSERT INTO')) {
      const tableMatch = query.match(/INSERT INTO\s+(\w+)/i);
      if (!tableMatch) return Promise.resolve([]);
      const tableName = tableMatch[1].toLowerCase();

      const colsMatch = query.match(/\(([^)]+)\)\s*VALUES/i);
      if (!colsMatch) return Promise.resolve([]);
      const cols = colsMatch[1].split(',').map((c) => c.trim());

      const valsMatch = query.match(/VALUES\s*\(([^)]+)\)/i);
      if (!valsMatch) return Promise.resolve([]);
      const valPlaceholders = valsMatch[1].split(',').map((v) => v.trim());

      const row: Row = {};
      for (let i = 0; i < cols.length; i++) {
        const placeholder = valPlaceholders[i] ?? '';
        const m = placeholder.match(/__V(\d+)__/);
        row[cols[i]] = m ? values[parseInt(m[1], 10)] : null;
      }

      const id = String(row.id ?? row.agent ?? row.file_path ?? Math.random());
      const t = tables[tableName];
      if (t) {
        if (upperQ.includes('ON CONFLICT')) {
          t.set(id, { ...(t.get(id) ?? {}), ...row });
        } else {
          t.set(id, row);
        }
      }
      return Promise.resolve([]);
    }

    // DELETE FROM <table> WHERE org = ... AND source_file NOT IN ...
    // DELETE FROM <table> WHERE org = ...
    // DELETE FROM <table>
    if (upperQ.startsWith('DELETE FROM')) {
      const tableMatch = query.match(/DELETE FROM\s+(\w+)/i);
      if (!tableMatch) return Promise.resolve([]);
      const tableName = tableMatch[1].toLowerCase();
      const t = tables[tableName];
      if (!t) return Promise.resolve([]);

      const whereOrgMatch = query.match(/WHERE org = __V(\d+)__/i);
      if (whereOrgMatch) {
        const orgVal = values[parseInt(whereOrgMatch[1], 10)];
        // Check for NOT IN clause
        const notInMatch = query.match(/AND source_file NOT IN __V(\d+)__/i);
        if (notInMatch) {
          const keepPaths = values[parseInt(notInMatch[1], 10)] as string[];
          for (const [k, v] of t.entries()) {
            if (v.org === orgVal && !keepPaths.includes(v.source_file as string)) {
              t.delete(k);
            }
          }
        } else {
          for (const [k, v] of t.entries()) {
            if (v.org === orgVal) t.delete(k);
          }
        }
      } else {
        // No WHERE — truncate
        t.clear();
      }
      return Promise.resolve([]);
    }

    // SELECT mtime FROM sync_meta WHERE file_path = ...
    if (upperQ.startsWith('SELECT')) {
      const tableMatch = query.match(/FROM\s+(\w+)/i);
      if (!tableMatch) return Promise.resolve([]);
      const tableName = tableMatch[1].toLowerCase();
      const t = tables[tableName];
      if (!t) return Promise.resolve([]);

      const whereMatch = query.match(/WHERE\s+(\w+)\s*=\s*__V(\d+)__/i);
      if (whereMatch) {
        const col = whereMatch[1];
        const val = values[parseInt(whereMatch[2], 10)];
        return Promise.resolve(Array.from(t.values()).filter((r) => r[col] === val));
      }
      return Promise.resolve(Array.from(t.values()));
    }

    return Promise.resolve([]);
  }

  // sql(array) form used by sync.ts for NOT IN list: sql(activePaths)
  (sql as unknown as Record<string, unknown>).__isSqlMock = true;
  const proxy = new Proxy(sql, {
    apply(target, thisArg, args) {
      // sql(someArray) — used as sql`... IN ${sql(array)}`
      if (Array.isArray(args[0]) && !('raw' in args[0])) {
        return args[0]; // Return the array as a value; the DELETE handler reads it directly
      }
      return Reflect.apply(target, thisArg, args);
    },
  });

  return proxy;
}

vi.mock('../db', () => ({
  sql: buildSqlMock(),
  initializeSchema: vi.fn().mockResolvedValue(undefined),
  isDatabaseReady: vi.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// Now set CTX_ROOT and dynamically import modules
// ---------------------------------------------------------------------------

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-'));
process.env.CTX_ROOT = tmpDir;

let syncTasks: typeof import('../sync')['syncTasks'];
let syncApprovals: typeof import('../sync')['syncApprovals'];
let syncEvents: typeof import('../sync')['syncEvents'];
let syncHeartbeat: typeof import('../sync')['syncHeartbeat'];
let syncAll: typeof import('../sync')['syncAll'];
let syncFile: typeof import('../sync')['syncFile'];
let extractOrgFromPath: typeof import('../sync')['extractOrgFromPath'];
let extractOrgAndAgentFromEventPath: typeof import('../sync')['extractOrgAndAgentFromEventPath'];
let extractAgentFromStatePath: typeof import('../sync')['extractAgentFromStatePath'];
let CTX_ROOT: string;

beforeAll(async () => {
  const syncMod = await import('../sync');
  syncTasks = syncMod.syncTasks;
  syncApprovals = syncMod.syncApprovals;
  syncEvents = syncMod.syncEvents;
  syncHeartbeat = syncMod.syncHeartbeat;
  syncAll = syncMod.syncAll;
  syncFile = syncMod.syncFile;
  extractOrgFromPath = syncMod.extractOrgFromPath;
  extractOrgAndAgentFromEventPath = syncMod.extractOrgAndAgentFromEventPath;
  extractAgentFromStatePath = syncMod.extractAgentFromStatePath;

  const configMod = await import('../config');
  CTX_ROOT = configMod.CTX_ROOT;

  expect(CTX_ROOT).toBe(tmpDir);
});

function writeJSON(relPath: string, data: unknown): string {
  const fullPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
  return fullPath;
}

function writeText(relPath: string, content: string): string {
  const fullPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return fullPath;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('syncTasks', () => {
  beforeEach(() => {
    clearTable('tasks');
    clearSyncMeta();
  });

  it('syncs a task JSON file into SQLite', async () => {
    writeJSON('orgs/testorg/tasks/task-1.json', {
      id: 'task-1',
      title: 'Test Task',
      status: 'pending',
      priority: 'high',
      created_at: '2025-01-01T00:00:00Z',
    });

    const count = await syncTasks('testorg');
    expect(count).toBe(1);

    const row = findById('tasks', 'task-1');
    expect(row).toBeTruthy();
    expect(row!.title).toBe('Test Task');
    expect(row!.status).toBe('pending');
    expect(row!.priority).toBe('high');
    expect(row!.org).toBe('testorg');
  });

  it('skips unchanged files on re-sync (mtime check)', async () => {
    writeJSON('orgs/testorg2/tasks/task-2.json', {
      id: 'task-2',
      title: 'Skip Me',
      status: 'pending',
      created_at: '2025-01-01T00:00:00Z',
    });

    const first = await syncTasks('testorg2');
    expect(first).toBe(1);

    const second = await syncTasks('testorg2');
    expect(second).toBe(0);
  });

  it('re-syncs when file is modified', async () => {
    const fp = writeJSON('orgs/testorg3/tasks/task-3.json', {
      id: 'task-3',
      title: 'Original',
      status: 'pending',
      created_at: '2025-01-01T00:00:00Z',
    });

    await syncTasks('testorg3');

    await new Promise((r) => setTimeout(r, 50));
    fs.writeFileSync(
      fp,
      JSON.stringify({
        id: 'task-3',
        title: 'Updated',
        status: 'in_progress',
        created_at: '2025-01-01T00:00:00Z',
      }),
    );

    const count = await syncTasks('testorg3');
    expect(count).toBe(1);

    const row = findById('tasks', 'task-3');
    expect(row!.title).toBe('Updated');
    expect(row!.status).toBe('in_progress');
  });

  it('handles missing task dir gracefully', async () => {
    const count = await syncTasks('nonexistent-org');
    expect(count).toBe(0);
  });
});

describe('syncApprovals', () => {
  beforeEach(() => {
    clearTable('approvals');
    clearSyncMeta();
  });

  it('syncs pending and resolved approvals', async () => {
    writeJSON('orgs/apporg/approvals/pending/ap-1.json', {
      id: 'ap-1',
      title: 'Deploy to prod',
      agent: 'builder',
      created_at: '2025-01-01T00:00:00Z',
    });
    writeJSON('orgs/apporg/approvals/resolved/ap-2.json', {
      id: 'ap-2',
      title: 'Cost increase',
      agent: 'planner',
      status: 'approved',
      created_at: '2025-01-01T00:00:00Z',
      resolved_at: '2025-01-02T00:00:00Z',
    });

    const count = await syncApprovals('apporg');
    expect(count).toBe(2);

    const pending = findById('approvals', 'ap-1');
    expect(pending!.status).toBe('pending');

    const resolved = findById('approvals', 'ap-2');
    expect(resolved!.status).toBe('approved');
  });
});

describe('syncEvents', () => {
  beforeEach(() => {
    clearTable('events');
    clearSyncMeta();
  });

  it('syncs JSONL lines into event rows', async () => {
    const lines = [
      JSON.stringify({ id: 'e1', timestamp: '2025-01-01T00:00:00Z', type: 'action', message: 'started' }),
      JSON.stringify({ id: 'e2', timestamp: '2025-01-01T00:01:00Z', type: 'task', message: 'completed' }),
      JSON.stringify({ id: 'e3', timestamp: '2025-01-01T00:02:00Z', type: 'error', severity: 'error', message: 'failed' }),
    ].join('\n');

    writeText('orgs/evtorg/analytics/events/builder/2025-01-01.jsonl', lines);

    const count = await syncEvents('evtorg', 'builder');
    expect(count).toBe(3);

    const rows = findWhere('events', 'agent', 'builder');
    expect(rows).toHaveLength(3);
  });

  it('skips malformed JSONL lines without crashing', async () => {
    const lines = [
      JSON.stringify({ id: 'e-good', timestamp: '2025-01-01T00:00:00Z', type: 'action' }),
      'NOT VALID JSON {{{',
      JSON.stringify({ id: 'e-also-good', timestamp: '2025-01-01T00:01:00Z', type: 'task' }),
    ].join('\n');

    writeText('orgs/evtorg2/analytics/events/builder/2025-01-02.jsonl', lines);

    const count = await syncEvents('evtorg2', 'builder');
    expect(count).toBe(2);
  });
});

describe('syncHeartbeat', () => {
  beforeEach(() => {
    clearTable('heartbeats');
    clearSyncMeta();
  });

  it('syncs heartbeat.json into heartbeats table', async () => {
    writeJSON('state/builder/heartbeat.json', {
      status: 'idle',
      current_task: null,
      mode: 'loop',
      last_heartbeat: '2025-01-01T12:00:00Z',
      uptime_seconds: 3600,
      org: 'testorg',
    });

    const ok = await syncHeartbeat('builder');
    expect(ok).toBe(true);

    const row = findById('heartbeats', 'builder');
    expect(row).toBeTruthy();
    expect(row!.status).toBe('idle');
    expect(row!.uptime_seconds).toBe(3600);
  });

  it('returns false for missing heartbeat file', async () => {
    const ok = await syncHeartbeat('no-agent');
    expect(ok).toBe(false);
  });
});

describe('syncAll', () => {
  beforeEach(() => {
    clearTable('tasks');
    clearTable('approvals');
    clearTable('events');
    clearTable('heartbeats');
    clearSyncMeta();
    fs.rmSync(path.join(tmpDir, 'orgs'), { recursive: true, force: true });
    fs.rmSync(path.join(tmpDir, 'state'), { recursive: true, force: true });
  });

  it('returns correct counts across multiple orgs', async () => {
    fs.mkdirSync(path.join(tmpDir, 'orgs', 'allorg', 'agents', 'agent1'), { recursive: true });

    writeJSON('orgs/allorg/tasks/t1.json', {
      id: 't1',
      title: 'T1',
      status: 'pending',
      created_at: '2025-01-01T00:00:00Z',
    });
    writeJSON('orgs/allorg/approvals/pending/a1.json', {
      id: 'a1',
      title: 'A1',
      agent: 'x',
      created_at: '2025-01-01T00:00:00Z',
    });
    writeText(
      'orgs/allorg/analytics/events/agent1/2025-01-01.jsonl',
      JSON.stringify({ id: 'ev1', timestamp: '2025-01-01T00:00:00Z', type: 'action' }) + '\n',
    );
    writeJSON('state/agent1/heartbeat.json', {
      status: 'active',
      org: 'allorg',
    });

    const result = await syncAll();
    expect(result.tasks).toBe(1);
    expect(result.approvals).toBe(1);
    expect(result.events).toBe(1);
    expect(result.heartbeats).toBe(1);
  });
});

describe('syncFile routing', () => {
  beforeEach(() => {
    clearTable('tasks');
    clearTable('approvals');
    clearTable('events');
    clearTable('heartbeats');
    clearSyncMeta();
  });

  it('routes task file to syncTasks', async () => {
    writeJSON('orgs/routeorg/tasks/t-route.json', {
      id: 't-route',
      title: 'Routed',
      status: 'pending',
      created_at: '2025-01-01T00:00:00Z',
    });

    await syncFile(path.join(tmpDir, 'orgs/routeorg/tasks/t-route.json'));

    const row = findById('tasks', 't-route');
    expect(row).toBeTruthy();
  });

  it('routes approval file to syncApprovals', async () => {
    writeJSON('orgs/routeorg/approvals/pending/a-route.json', {
      id: 'a-route',
      title: 'Approval Route',
      agent: 'x',
      created_at: '2025-01-01T00:00:00Z',
    });

    await syncFile(path.join(tmpDir, 'orgs/routeorg/approvals/pending/a-route.json'));

    const row = findById('approvals', 'a-route');
    expect(row).toBeTruthy();
  });

  it('routes event JSONL to syncEvents', async () => {
    writeText(
      'orgs/routeorg/analytics/events/bot/2025-01-01.jsonl',
      JSON.stringify({ id: 'ev-route', timestamp: '2025-01-01T00:00:00Z', type: 'action' }) + '\n',
    );

    await syncFile(path.join(tmpDir, 'orgs/routeorg/analytics/events/bot/2025-01-01.jsonl'));

    const row = findById('events', 'ev-route');
    expect(row).toBeTruthy();
  });

  it('routes heartbeat file to syncHeartbeat', async () => {
    writeJSON('state/routebot/heartbeat.json', {
      status: 'idle',
      org: '',
    });

    await syncFile(path.join(tmpDir, 'state/routebot/heartbeat.json'));

    const row = findById('heartbeats', 'routebot');
    expect(row).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Path extraction helpers (pure functions, no DB)
// ---------------------------------------------------------------------------

describe('extractOrgFromPath', () => {
  it('extracts org from a task path', () => {
    const org = extractOrgFromPath('/some/root/orgs/myorg/tasks/t1.json');
    expect(org).toBe('myorg');
  });

  it('returns null for non-org paths', () => {
    const org = extractOrgFromPath('/some/other/path/file.json');
    expect(org).toBeNull();
  });
});

describe('extractOrgAndAgentFromEventPath', () => {
  it('extracts org and agent from event JSONL path', () => {
    const result = extractOrgAndAgentFromEventPath(
      '/root/orgs/myorg/analytics/events/my-agent/2025-01-01.jsonl',
    );
    expect(result).toEqual({ org: 'myorg', agent: 'my-agent' });
  });

  it('returns null fields for non-event paths', () => {
    const result = extractOrgAndAgentFromEventPath('/some/other/path.jsonl');
    expect(result?.org).toBeNull();
    expect(result?.agent).toBeNull();
  });
});

describe('extractAgentFromStatePath', () => {
  it('extracts agent from heartbeat path', () => {
    const agent = extractAgentFromStatePath('/root/state/my-agent/heartbeat.json');
    expect(agent).toBe('my-agent');
  });

  it('returns null for non-state paths', () => {
    const agent = extractAgentFromStatePath('/some/other/path.json');
    expect(agent).toBeNull();
  });
});
