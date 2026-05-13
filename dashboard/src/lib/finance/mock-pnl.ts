/**
 * Phase 10.2/10.3 — Mock P&L data (Jan–May 2026).
 * Replace with QuickBooks pull post-OAuth.
 */

export interface MonthlyPnL {
  month: string; // 'YYYY-MM'
  label: string; // 'Jan 2026'
  revenue: number;
  costs: number;
  gross_margin: number;
  net_margin: number;
}

export const MOCK_PNL: MonthlyPnL[] = [
  { month: '2026-01', label: 'Jan 2026', revenue: 24000, costs: 8200,  gross_margin: 15800, net_margin: 11200 },
  { month: '2026-02', label: 'Feb 2026', revenue: 25500, costs: 8800,  gross_margin: 16700, net_margin: 11900 },
  { month: '2026-03', label: 'Mar 2026', revenue: 27200, costs: 9400,  gross_margin: 17800, net_margin: 12600 },
  { month: '2026-04', label: 'Apr 2026', revenue: 29100, costs: 10200, gross_margin: 18900, net_margin: 13400 },
  { month: '2026-05', label: 'May 2026', revenue: 31000, costs: 11000, gross_margin: 20000, net_margin: 14200 },
];

export function getPnLSummary() {
  const latest = MOCK_PNL[MOCK_PNL.length - 1];
  const prior  = MOCK_PNL[MOCK_PNL.length - 2];
  function pct(a: number, b: number) { return b === 0 ? 0 : Math.round(((a - b) / b) * 1000) / 10; }
  return {
    revenue:      { value: latest.revenue,      pct: pct(latest.revenue,      prior.revenue) },
    costs:        { value: latest.costs,         pct: pct(latest.costs,        prior.costs) },
    gross_margin: { value: latest.gross_margin,  pct: pct(latest.gross_margin, prior.gross_margin) },
    net_margin:   { value: latest.net_margin,    pct: pct(latest.net_margin,   prior.net_margin) },
    gross_margin_pct: Math.round((latest.gross_margin / latest.revenue) * 1000) / 10,
    net_margin_pct:   Math.round((latest.net_margin   / latest.revenue) * 1000) / 10,
  };
}
