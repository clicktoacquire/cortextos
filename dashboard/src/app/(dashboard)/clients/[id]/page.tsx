import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { canAccess } from '@/lib/abilities';
import type { UserRole } from '@/lib/types';
import { getClient, getClientPerformance } from '@/lib/bq-clients';

export const dynamic = 'force-dynamic';

function Field({ label, value }: { label: string; value: string | boolean | null | undefined }) {
  const display = value === null || value === undefined || value === '' ? '—'
    : typeof value === 'boolean' ? (value ? 'Yes' : 'No')
    : String(value);
  return (
    <div>
      <dt className="text-xs text-zinc-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm text-zinc-200">{display}</dd>
    </div>
  );
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const role = ((session?.user as { role?: string })?.role ?? 'admin') as UserRole;

  if (!canAccess(role, 'read', 'clients')) {
    redirect('/');
  }

  const { id } = await params;
  const [client, performance] = await Promise.all([
    getClient(id).catch(() => null),
    getClientPerformance(id).catch(() => []),
  ]);

  if (!client) notFound();

  const totalSpend = performance.reduce((s, r) => s + r.cost, 0);
  const totalConversions = performance.reduce((s, r) => s + r.conversions, 0);
  const totalClicks = performance.reduce((s, r) => s + r.clicks, 0);
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <a href="/clients" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
              ← Clients
            </a>
          </div>
          <h1 className="text-2xl font-semibold text-white mt-2">{client.name || client.client_id}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{client.client_id}</p>
        </div>
        <span className={`mt-2 inline-flex items-center px-2.5 py-1 rounded border text-xs font-medium ${
          client.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
          client.status === 'onboarding' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
          'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
        }`}>
          {client.status}
        </span>
      </div>

      {/* 30-day performance summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Spend (30d)', value: `$${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Conversions', value: totalConversions.toLocaleString() },
          { label: 'Clicks', value: totalClicks.toLocaleString() },
          { label: 'CPA', value: cpa !== null ? `$${cpa.toFixed(2)}` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wider">{label}</div>
            <div className="mt-1 text-xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Client details */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-4">Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Field label="Vertical" value={client.vertical} />
          <Field label="Lifecycle Stage" value={client.lifecycle_stage} />
          <Field label="Funnel Type" value={client.primary_funnel_type} />
          <Field label="Existing Accounts" value={client.has_existing_accounts} />
          <Field label="CTA Managed" value={client.cta_platform_managed} />
          <Field label="Onboarded" value={client.onboarded_at ? new Date(client.onboarded_at).toLocaleDateString() : null} />
          <Field label="GHL Location" value={client.ghl_location_id} />
          <Field label="GDrive Folder" value={client.gdrive_folder_id} />
          <Field label="Last Activity" value={client.last_activity ? new Date(client.last_activity).toLocaleDateString() : null} />
        </dl>
      </div>

      {/* Portal access */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">Client Portal</h2>
        <div className="flex items-center gap-4">
          <a
            href={`/portal/${id}/reports`}
            target="_blank"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            View Portal Report
          </a>
          <span className="text-xs text-zinc-500">
            Create client login via Settings &rarr; Users or POST /api/client-users
          </span>
        </div>
      </div>

      {/* Daily performance table */}
      {performance.length > 0 && (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
            <h2 className="text-sm font-medium text-zinc-300">Daily Performance (30d)</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Date', 'Impressions', 'Clicks', 'Conversions', 'Spend'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {performance.map((row) => (
                <tr key={row.date} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-2 text-zinc-400 text-xs">{row.date}</td>
                  <td className="px-4 py-2 text-zinc-300">{row.impressions.toLocaleString()}</td>
                  <td className="px-4 py-2 text-zinc-300">{row.clicks.toLocaleString()}</td>
                  <td className="px-4 py-2 text-zinc-300">{row.conversions.toLocaleString()}</td>
                  <td className="px-4 py-2 text-zinc-300">${row.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
