import { getAuditLogFiltered } from '@/lib/audit';
import type { AuditRow } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const SUBJECT_TYPES = ['', 'Client', 'Agent', 'Task', 'Approval', 'User', 'Settings'];
const ACTIONS = ['', 'create', 'update', 'delete', 'publish', 'approve', 'reject'];

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: { subjectType?: string; action?: string };
}) {
  const subjectType = searchParams.subjectType || '';
  const action = searchParams.action || '';

  let rows: AuditRow[] = [];
  let error: string | null = null;

  try {
    rows = getAuditLogFiltered({
      subjectType: subjectType || undefined,
      action: action || undefined,
      limit: 50,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load activity log';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-1">Last 50 admin actions</p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form method="GET" className="flex items-center gap-3 flex-wrap">
        <select
          name="subjectType"
          defaultValue={subjectType}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          {SUBJECT_TYPES.map((t) => (
            <option key={t} value={t}>{t || 'All subjects'}</option>
          ))}
        </select>
        <select
          name="action"
          defaultValue={action}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{a || 'All actions'}</option>
          ))}
        </select>
        <button
          type="submit"
          className="h-8 px-3 rounded-md border text-sm hover:bg-muted transition-colors"
        >
          Filter
        </button>
        {(subjectType || action) && (
          <a href="/activity" className="h-8 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground flex items-center">
            Clear
          </a>
        )}
      </form>

      {!error && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-lg font-medium text-muted-foreground">No activity yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Actions on clients, agents, tasks, and settings will appear here.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Time</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Subject</th>
                <th className="px-4 py-3 text-left font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(row.ts).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium">{row.username}</td>
                  <td className="px-4 py-3">
                    <ActionBadge action={row.action} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="font-medium text-foreground">{row.subject_type}</span>
                    {row.subject_id && (
                      <span className="ml-1 font-mono text-xs">{row.subject_id}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {row.ip ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const variants: Record<string, string> = {
    create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    publish: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    approve: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
    reject: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  };
  const cls = variants[action] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {action}
    </span>
  );
}
