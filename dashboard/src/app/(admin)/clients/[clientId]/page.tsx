import { notFound } from 'next/navigation';
import { getClient, getClientPerformance, getClientHitlQueue } from '@/lib/bq-clients';
import type { ClientRow, PerformanceSummary } from '@/lib/bq-clients';

export const dynamic = 'force-dynamic';

type Tab = 'overview' | 'onboarding' | 'strategy' | 'hitl' | 'tracking' | 'performance' | 'changelog';

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  onboarding: 'Onboarding',
  strategy: 'Strategy Config',
  hitl: 'HITL Queue',
  tracking: 'Tracking',
  performance: 'Performance',
  changelog: 'Change Log',
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { clientId: string };
  searchParams: { tab?: string };
}) {
  const activeTab = (searchParams.tab ?? 'overview') as Tab;

  let client: ClientRow | null = null;
  let performance: PerformanceSummary[] = [];
  let hitlQueue: Array<{ id: string; title: string; created_at: string; category: string }> = [];
  let fetchError: string | null = null;

  try {
    client = await getClient(params.clientId);
    if (!client) notFound();

    if (activeTab === 'performance') {
      performance = await getClientPerformance(params.clientId);
    }
    if (activeTab === 'hitl') {
      hitlQueue = await getClientHitlQueue(params.clientId);
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Failed to load client';
  }

  if (!client && !fetchError) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <a href="/clients" className="hover:underline">Clients</a>
          {' / '}
          <span>{client?.name ?? params.clientId}</span>
        </p>
        <h1 className="text-2xl font-semibold mt-1">{client?.name ?? params.clientId}</h1>
        {client && (
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-muted-foreground capitalize">{client.vertical ?? '—'}</span>
            <StatusBadge status={client.status} />
          </div>
        )}
      </div>

      {fetchError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {fetchError}
        </div>
      )}

      {client && (
        <>
          <TabBar clientId={params.clientId} active={activeTab} />

          <div className="mt-4">
            {activeTab === 'overview' && <OverviewTab client={client} />}
            {activeTab === 'onboarding' && <PlaceholderTab label="Onboarding" note="Phase 3 will populate onboarding state, form submissions, and progress steps." />}
            {activeTab === 'strategy' && <PlaceholderTab label="Strategy Config" note="No strategy configured yet. Strategy configs will appear here once analytics.strategy_configs is populated." />}
            {activeTab === 'hitl' && <HitlTab queue={hitlQueue} />}
            {activeTab === 'tracking' && <PlaceholderTab label="Tracking" note="GTM, CallRail, and Clarity onboarding state will appear here in Phase 5." />}
            {activeTab === 'performance' && <PerformanceTab rows={performance} />}
            {activeTab === 'changelog' && <PlaceholderTab label="Change Log" note="Agent-driven change log will populate here as activity is recorded." />}
          </div>
        </>
      )}
    </div>
  );
}

function TabBar({ clientId, active }: { clientId: string; active: Tab }) {
  const tabs = Object.keys(TAB_LABELS) as Tab[];
  return (
    <div className="border-b flex gap-0 overflow-x-auto">
      {tabs.map((tab) => (
        <a
          key={tab}
          href={`/clients/${clientId}?tab=${tab}`}
          className={[
            'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px',
            active === tab
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          {TAB_LABELS[tab]}
        </a>
      ))}
    </div>
  );
}

function OverviewTab({ client }: { client: ClientRow }) {
  const fields: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Client ID', value: <code className="text-xs">{client.client_id}</code> },
    { label: 'Vertical', value: client.vertical ?? '—' },
    { label: 'Status', value: <StatusBadge status={client.status} /> },
    { label: 'Lifecycle Stage', value: client.lifecycle_stage ?? '—' },
    { label: 'Primary Funnel', value: client.primary_funnel_type ?? '—' },
    { label: 'CTA Platform Managed', value: client.cta_platform_managed ? 'Yes' : 'No' },
    { label: 'Has Existing Accounts', value: client.has_existing_accounts ? 'Yes' : 'No' },
    { label: 'GHL Location ID', value: client.ghl_location_id ?? '—' },
    { label: 'GDrive Folder ID', value: client.gdrive_folder_id ?? '—' },
    { label: 'Onboarded At', value: client.onboarded_at ? new Date(client.onboarded_at).toLocaleDateString() : '—' },
    { label: 'Last Activity', value: client.last_activity ? new Date(client.last_activity).toLocaleDateString() : '—' },
  ];

  return (
    <div className="rounded-lg border">
      <dl className="divide-y">
        {fields.map(({ label, value }) => (
          <div key={label} className="grid grid-cols-3 px-4 py-3 text-sm">
            <dt className="font-medium text-muted-foreground">{label}</dt>
            <dd className="col-span-2">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function HitlTab({ queue }: { queue: Array<{ id: string; title: string; created_at: string; category: string }> }) {
  if (queue.length === 0) {
    return (
      <EmptyState
        title="No pending recommendations"
        description="HITL recommendations will appear here once the agent pipeline generates them."
      />
    );
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Title</th>
            <th className="px-4 py-3 text-left font-medium">Category</th>
            <th className="px-4 py-3 text-left font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {queue.map((item) => (
            <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 font-medium">{item.title}</td>
              <td className="px-4 py-3 text-muted-foreground capitalize">{item.category}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(item.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PerformanceTab({ rows }: { rows: PerformanceSummary[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No performance data"
        description="Last-30-day metrics will appear here once daily_metrics is populated for this client."
      />
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      conversions: acc.conversions + r.conversions,
      cost: acc.cost + r.cost,
    }),
    { impressions: 0, clicks: 0, conversions: 0, cost: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Impressions" value={totals.impressions.toLocaleString()} />
        <MetricCard label="Clicks" value={totals.clicks.toLocaleString()} />
        <MetricCard label="Conversions" value={totals.conversions.toLocaleString()} />
        <MetricCard label="Spend" value={`$${totals.cost.toFixed(2)}`} />
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Impressions</th>
              <th className="px-4 py-3 text-right font-medium">Clicks</th>
              <th className="px-4 py-3 text-right font-medium">Conversions</th>
              <th className="px-4 py-3 text-right font-medium">Spend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">{row.date}</td>
                <td className="px-4 py-3 text-right">{row.impressions.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{row.clicks.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{row.conversions.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">${row.cost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function PlaceholderTab({ label, note }: { label: string; note: string }) {
  return <EmptyState title={`${label} — coming soon`} description={note} />;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-lg font-medium text-muted-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
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
