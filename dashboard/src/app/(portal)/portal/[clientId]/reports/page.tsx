import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getClient, getClientPerformance } from '@/lib/bq-clients';
import {
  getClientSpend,
  getClientRevenue,
  getClientCpa,
  getCpaVsTarget,
  getClientLeads,
  getLeadGrowth,
  getWastedSpend,
  getMonthPace,
  getTrackingHealth,
} from '@/lib/portal-questions';
import type { DateRange } from '@/lib/portal-questions';

export const dynamic = 'force-dynamic';

function KpiCard({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'flat' | 'growing' | 'shrinking' | null }) {
  const trendColor = trend === 'up' || trend === 'growing' ? 'text-green-400' :
    trend === 'down' || trend === 'shrinking' ? 'text-red-400' : 'text-zinc-500';
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${trendColor}`}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: 'bg-green-500/10 text-green-400 border-green-500/20',
    degraded: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    broken: 'bg-red-500/10 text-red-400 border-red-500/20',
    on_target: 'bg-green-500/10 text-green-400 border-green-500/20',
    above: 'bg-red-500/10 text-red-400 border-red-500/20',
    below: 'bg-green-500/10 text-green-400 border-green-500/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${colors[status] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function fmt$(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  const user = session.user as { role?: string; client_id?: string | null };
  const { clientId } = await params;

  if (user.role === 'client' && user.client_id !== clientId) {
    redirect(`/portal/${user.client_id}/reports`);
  }

  const client = await getClient(clientId).catch(() => null);
  if (!client) notFound();

  const { days: daysStr } = await searchParams;
  const days = Math.min(Math.max(Number(daysStr) || 30, 7), 90);
  const end = new Date().toISOString().slice(0, 10);
  const startMs = Date.now() - days * 86_400_000;
  const start = new Date(startMs).toISOString().slice(0, 10);
  const range: DateRange = { start, end };

  const [spend, revenue, cpa, cpaTarget, leads, leadGrowth, wasted, pace, tracking, performance] = await Promise.all([
    getClientSpend(clientId, range).catch(() => ({ spend_total: 0, daily: [], by_platform: {} as Record<string, number> })),
    getClientRevenue(clientId, range).catch(() => ({ revenue_total: 0, daily: [], roas: 0 })),
    getClientCpa(clientId, range).catch(() => ({ avg_cpa: 0, pct_change: 0, trend: 'flat' as const, daily: [] })),
    getCpaVsTarget(clientId, range).catch(() => ({ target_cpa: 0, actual_cpa: 0, status: 'on_target' as const })),
    getClientLeads(clientId, range).catch(() => ({ lead_count: 0, qualified_count: 0, daily: [] })),
    getLeadGrowth(clientId, range).catch(() => ({ pct_change: 0, trend: 'flat' as const, rolling_14d: [] })),
    getWastedSpend(clientId, range).catch(() => ({ wasted_amount: 0, pct_of_total: 0, top_offenders: [] })),
    getMonthPace(clientId).catch(() => ({ pct_to_goal: 0, goal_type: 'spend' as const, goal_value: 0, current_value: 0, days_remaining: 0 })),
    getTrackingHealth(clientId).catch(() => ({ tracking_status: 'broken' as const, last_verify_at: '', failing_dimensions: ['no_data'] })),
    getClientPerformance(clientId).catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">{client.name || client.client_id}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Performance report — last {days} days ({start} to {end})
        </p>
        <div className="flex gap-2 mt-3">
          {[7, 14, 30, 60, 90].map((d) => (
            <a
              key={d}
              href={`/portal/${clientId}/reports?days=${d}`}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                d === days
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              {d}d
            </a>
          ))}
        </div>
      </div>

      {/* Verdict — answer first, data second (client-portal-ux-v1: "Clients
          aren't marketers — they want a verdict, not a dashboard.") */}
      {(() => {
        const leadPart = leads.lead_count > 0
          ? `Your ads generated ${leads.lead_count.toLocaleString()} lead${leads.lead_count === 1 ? '' : 's'} in the last ${days} days` +
            (cpa.avg_cpa > 0 ? ` at ${fmt$(cpa.avg_cpa)} each` : '')
          : `Your ads spent ${fmt$(spend.spend_total)} in the last ${days} days with no leads recorded yet`;
        const trendParts: string[] = [];
        if (leadGrowth.pct_change !== 0) {
          trendParts.push(`leads ${leadGrowth.pct_change > 0 ? 'up' : 'down'} ${Math.abs(leadGrowth.pct_change)}%`);
        }
        if (cpa.pct_change !== 0) {
          trendParts.push(`cost per lead ${cpa.pct_change > 0 ? 'up' : 'down'} ${Math.abs(cpa.pct_change)}%`);
        }
        const trendPart = trendParts.length > 0 ? ` — ${trendParts.join(', ')} vs the prior period` : '';
        const onTarget = cpaTarget.target_cpa > 0 ? cpaTarget.status : null;
        const verdictTone =
          onTarget === 'above' || tracking.tracking_status === 'broken'
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-emerald-500/30 bg-emerald-500/5';
        const bottomLine =
          tracking.tracking_status === 'broken'
            ? 'Heads up: conversion tracking needs attention, so these numbers may undercount results.'
            : onTarget === 'above'
              ? `Cost per lead is above the ${fmt$(cpaTarget.target_cpa)} target — this is where our optimization work is focused right now.`
              : onTarget === 'below' || onTarget === 'on_target'
                ? `Cost per lead is ${onTarget === 'below' ? 'beating' : 'on'} the ${fmt$(cpaTarget.target_cpa)} target.`
                : pace.goal_value > 0
                  ? `You're ${pace.pct_to_goal}% of the way to this month's ${pace.goal_type} goal with ${pace.days_remaining} days left.`
                  : '';
        return (
          <div className={`rounded-lg border p-5 ${verdictTone}`}>
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">The bottom line</p>
            <p className="text-lg text-white leading-relaxed">
              {leadPart}
              {trendPart}.
            </p>
            {bottomLine && <p className="text-sm text-zinc-400 mt-2">{bottomLine}</p>}
          </div>
        );
      })()}

      {/* KPI Cards — Row 1 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total Spend" value={fmt$(spend.spend_total)} />
        <KpiCard
          label="Revenue"
          value={fmt$(revenue.revenue_total)}
          sub={revenue.roas > 0 ? `ROAS: ${revenue.roas.toFixed(1)}x` : undefined}
        />
        <KpiCard
          label="Avg CPA"
          value={cpa.avg_cpa > 0 ? fmt$(cpa.avg_cpa) : '—'}
          sub={cpa.pct_change !== 0 ? `${cpa.pct_change > 0 ? '+' : ''}${cpa.pct_change}% vs prior` : undefined}
          trend={cpa.trend === 'up' ? 'down' : cpa.trend === 'down' ? 'up' : 'flat'}
        />
        <KpiCard
          label="Leads"
          value={leads.lead_count.toLocaleString()}
          sub={leadGrowth.pct_change !== 0 ? `${leadGrowth.pct_change > 0 ? '+' : ''}${leadGrowth.pct_change}% vs prior` : undefined}
          trend={leadGrowth.trend === 'growing' ? 'up' : leadGrowth.trend === 'shrinking' ? 'down' : 'flat'}
        />
      </div>

      {/* KPI Cards — Row 2 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="CPA vs Target"
          value={cpaTarget.target_cpa > 0 ? fmt$(cpaTarget.actual_cpa) : '—'}
          sub={cpaTarget.target_cpa > 0 ? `Target: ${fmt$(cpaTarget.target_cpa)}` : 'No target set'}
        />
        <KpiCard
          label="Wasted Spend"
          value={fmt$(wasted.wasted_amount)}
          sub={`${wasted.pct_of_total}% of total`}
        />
        <KpiCard
          label="Month Pace"
          value={`${pace.pct_to_goal}%`}
          sub={pace.goal_value > 0 ? `${fmt$(pace.current_value)} / ${fmt$(pace.goal_value)} — ${pace.days_remaining}d left` : 'No goal set'}
        />
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Tracking</div>
          <div className="mt-1"><StatusBadge status={tracking.tracking_status} /></div>
          {tracking.failing_dimensions.length > 0 && (
            <div className="mt-1 text-xs text-zinc-500">{tracking.failing_dimensions.join(', ')}</div>
          )}
        </div>
      </div>

      {/* Spend by platform */}
      {Object.keys(spend.by_platform).length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-3">Spend by Platform</h2>
          <div className="flex flex-wrap gap-4">
            {Object.entries(spend.by_platform)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([platform, amount]) => (
                <div key={platform} className="flex items-baseline gap-2">
                  <span className="text-xs text-zinc-500 uppercase">{platform}</span>
                  <span className="text-sm font-medium text-zinc-200">{fmt$(amount as number)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Wasted spend offenders */}
      {wasted.top_offenders.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-3">Zero-Conversion Campaigns</h2>
          <div className="space-y-2">
            {wasted.top_offenders.slice(0, 5).map((o) => (
              <div key={o.campaign} className="flex items-center justify-between text-sm">
                <span className="text-zinc-400 truncate max-w-[60%]">{o.campaign}</span>
                <span className="text-red-400 font-medium">{fmt$(o.wasted)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CPA vs Target badge */}
      {cpaTarget.target_cpa > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-3">CPA Performance</h2>
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-zinc-500">Actual</span>
              <div className="text-lg font-semibold text-white">{fmt$(cpaTarget.actual_cpa)}</div>
            </div>
            <div className="text-zinc-600">vs</div>
            <div>
              <span className="text-xs text-zinc-500">Target</span>
              <div className="text-lg font-semibold text-white">{fmt$(cpaTarget.target_cpa)}</div>
            </div>
            <StatusBadge status={cpaTarget.status} />
          </div>
        </div>
      )}

      {/* Daily performance table */}
      {performance.length > 0 && (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
            <h2 className="text-sm font-medium text-zinc-300">Daily Performance</h2>
          </div>
          <div className="overflow-x-auto">
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
                    <td className="px-4 py-2 text-zinc-300">{fmt$(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
