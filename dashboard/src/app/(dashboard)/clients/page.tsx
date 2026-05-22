import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { canAccess } from '@/lib/abilities';
import type { UserRole } from '@/lib/types';
import { listClients } from '@/lib/bq-clients';
import type { ClientListRow } from '@/lib/bq-clients';

export const dynamic = 'force-dynamic';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400 border-green-500/20',
    onboarding: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    churned: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${colors[status] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
      {status}
    </span>
  );
}

export default async function ClientsPage() {
  const session = await auth();
  const role = ((session?.user as { role?: string })?.role ?? 'admin') as UserRole;

  if (!canAccess(role, 'read', 'clients')) {
    redirect('/');
  }

  let clients: ClientListRow[] = [];
  let error: string | null = null;

  try {
    clients = await listClients();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load clients';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Clients</h1>
          <p className="text-sm text-zinc-400 mt-1">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Client</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Vertical</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {clients.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500 text-sm">
                  No clients found
                </td>
              </tr>
            )}
            {clients.map((client) => (
              <tr key={client.client_id} className="hover:bg-zinc-800/40 transition-colors">
                <td className="px-4 py-3">
                  <a
                    href={`/clients/${client.client_id}`}
                    className="font-medium text-white hover:text-blue-400 transition-colors"
                  >
                    {client.name || client.client_id}
                  </a>
                  <div className="text-xs text-zinc-500 mt-0.5">{client.client_id}</div>
                </td>
                <td className="px-4 py-3 text-zinc-400">{client.vertical || '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={client.status} />
                </td>
                <td className="px-4 py-3 text-zinc-400 text-xs">
                  {client.last_activity
                    ? new Date(client.last_activity).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
