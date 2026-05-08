import { listClients } from '@/lib/bq-clients';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  let clients: Awaited<ReturnType<typeof listClients>> = [];
  let error: string | null = null;

  try {
    clients = await listClients();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load clients';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="text-sm text-muted-foreground mt-1">
          CTA Platform managed clients
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && clients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-lg font-medium text-muted-foreground">No clients yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Clients appear here once onboarded via the CTA Platform pipeline.
          </p>
        </div>
      )}

      {clients.length > 0 && (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Vertical</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.client_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${client.client_id}`}
                      className="font-medium hover:underline"
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {client.vertical ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={client.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {client.last_activity
                      ? new Date(client.last_activity).toLocaleDateString()
                      : '—'}
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

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    onboarding: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    offboarded: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  const cls = variants[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
