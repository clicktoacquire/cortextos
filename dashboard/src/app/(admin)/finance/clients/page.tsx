import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BigQuery } from '@google-cloud/bigquery';

export const dynamic = 'force-dynamic';

const PROJECT = process.env.GCLOUD_PROJECT ?? 'click-to-acquire';
const MOZART_HOURLY_RATE = 50;
const MOZART_HOURS_PER_CLIENT = 10;

interface ClientCostRow {
  client_id: string;
  name: string;
  ad_spend: number;
  mozart_cost: number;
  total_cost: number;
  revenue_proxy: number;
  margin_pct: number;
}

async function fetchClientCosts(): Promise<ClientCostRow[]> {
  try {
    const bq = new BigQuery({ projectId: PROJECT });
    const query = `
      SELECT
        c.client_id,
        c.display_name AS name,
        ROUND(COALESCE(SUM(m.spend), 0), 2) AS ad_spend
      FROM \`${PROJECT}.analytics.clients\` c
      LEFT JOIN \`${PROJECT}.analytics.daily_metrics\` m
        ON m.client_id = c.client_id
        AND m.metric_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY c.client_id, c.display_name
      ORDER BY ad_spend DESC
      LIMIT 100
    `;
    const [rows] = await bq.query({ query, location: 'US' });
    return (rows as Array<{ client_id: string; name: string; ad_spend: number }>).map((r) => {
      const mozartCost = MOZART_HOURLY_RATE * MOZART_HOURS_PER_CLIENT;
      const totalCost  = r.ad_spend + mozartCost;
      const revenueProxy = r.ad_spend * 1.3; // 30% margin assumption placeholder
      const marginPct = revenueProxy > 0 ? Math.round(((revenueProxy - mozartCost) / revenueProxy) * 1000) / 10 : 0;
      return { ...r, mozart_cost: mozartCost, total_cost: totalCost, revenue_proxy: revenueProxy, margin_pct: marginPct };
    });
  } catch {
    // Return mock rows when BQ is unavailable
    return [
      { client_id: 'oc-repipes', name: 'OC Repipes',    ad_spend: 4820, mozart_cost: 500, total_cost: 5320, revenue_proxy: 6266, margin_pct: 92.0 },
      { client_id: 'sunny-dental', name: 'Sunny Dental', ad_spend: 3200, mozart_cost: 500, total_cost: 3700, revenue_proxy: 4160, margin_pct: 88.0 },
    ];
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default async function ClientCostsPage() {
  const rows = await fetchClientCosts();
  const totalAdSpend = rows.reduce((s, r) => s + r.ad_spend, 0);
  const totalMozart  = rows.reduce((s, r) => s + r.mozart_cost, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Per-Client Cost Tracking</h1>
        <p className="text-sm text-muted-foreground mt-1">Last 30 days · Ad spend from BQ · Mozart hours mocked at $50/h × 10h</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Ad Spend</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4"><span className="text-2xl font-bold tabular-nums">{fmt(totalAdSpend)}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mozart Cost</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4"><span className="text-2xl font-bold tabular-nums">{fmt(totalMozart)}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Clients Tracked</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4"><span className="text-2xl font-bold tabular-nums">{rows.length}</span></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm font-medium">Client Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                {['Client', 'Ad Spend', 'Mozart Cost', 'Total Cost', 'Margin'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.client_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{r.name}</td>
                  <td className="px-4 py-2.5 tabular-nums">{fmt(r.ad_spend)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{fmt(r.mozart_cost)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{fmt(r.total_cost)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-emerald-600 dark:text-emerald-400">{r.margin_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
