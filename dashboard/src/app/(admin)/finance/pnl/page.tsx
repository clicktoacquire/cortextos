import { MOCK_PNL, getPnLSummary } from '@/lib/finance/mock-pnl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function TrendBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <Badge variant={up ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
      {up ? '+' : ''}{pct}%
    </Badge>
  );
}

export default function PnLPage() {
  const summary = getPnLSummary();

  const cards = [
    { label: 'Revenue',      ...summary.revenue,      sub: null },
    { label: 'Costs',        ...summary.costs,         sub: null },
    { label: 'Gross Margin', ...summary.gross_margin,  sub: `${summary.gross_margin_pct}% margin` },
    { label: 'Net Margin',   ...summary.net_margin,    sub: `${summary.net_margin_pct}% margin` },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Company P&amp;L</h1>
        <p className="text-sm text-muted-foreground mt-1">Jan–May 2026 · Mock data · QuickBooks OAuth pending</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{c.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold tabular-nums">{fmt(c.value)}</span>
                <TrendBadge pct={c.pct} />
              </div>
              {c.sub && <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>}
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">vs prior month</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly table */}
      <Card>
        <CardHeader className="px-4 pt-4 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                {['Month', 'Revenue', 'Costs', 'Gross Margin', 'Net Margin'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...MOCK_PNL].reverse().map((row) => (
                <tr key={row.month} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{row.label}</td>
                  <td className="px-4 py-2.5 tabular-nums">{fmt(row.revenue)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{fmt(row.costs)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{fmt(row.gross_margin)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{fmt(row.net_margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
