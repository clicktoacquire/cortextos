'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OptimizationRow {
  experiment_id: string;
  client_id: string;
  variant_id: string;
  kind: string;
  impact_size: string;
  action_mode: string;
  expected_lift_pct: number | null;
  probability_best_pct: number | null;
  status: string;
  recommended_action: string | null;
  reasoning: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface Summary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  executed: number;
  auto_count: number;
  hitl_count: number;
}

type SortField = 'client_id' | 'expected_lift_pct' | 'recommended_action' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function OptimizationPage() {
  const [rows, setRows] = useState<OptimizationRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    fetch('/api/optimization?days=7')
      .then((r) => r.json())
      .then((data) => {
        setRows(data.rows ?? []);
        setSummary(data.summary ?? null);
        if (data.error) setError(data.error);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance Loop</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Experiment recommendations, classifications, and actions from the self-improving loop.
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Auto-Executed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary.auto_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">HITL Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{summary.hitl_count}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading && <p className="text-muted-foreground">Loading optimization data...</p>}
      {error && <p className="text-red-500 text-sm">Error: {error}</p>}

      {!loading && rows.length === 0 && !error && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No optimization recommendations in the last 7 days. The performance loop will populate
            this view once experiments are running via GrowthBook.
          </CardContent>
        </Card>
      )}

      {sorted.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th
                      className="px-4 py-3 text-left font-medium cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort('client_id')}
                    >
                      Client{sortIndicator('client_id')}
                    </th>
                    <th
                      className="px-4 py-3 text-left font-medium cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort('expected_lift_pct')}
                    >
                      Lift %{sortIndicator('expected_lift_pct')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Impact</th>
                    <th
                      className="px-4 py-3 text-left font-medium cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort('recommended_action')}
                    >
                      Action{sortIndicator('recommended_action')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Mode</th>
                    <th
                      className="px-4 py-3 text-left font-medium cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort('status')}
                    >
                      Status{sortIndicator('status')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Reasoning</th>
                    <th
                      className="px-4 py-3 text-left font-medium cursor-pointer hover:text-foreground"
                      onClick={() => toggleSort('created_at')}
                    >
                      Created{sortIndicator('created_at')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <tr key={row.experiment_id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{row.client_id}</td>
                      <td className="px-4 py-3">
                        {row.expected_lift_pct != null ? (
                          <span className={row.expected_lift_pct >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {row.expected_lift_pct > 0 ? '+' : ''}{row.expected_lift_pct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ImpactBadge size={row.impact_size} />
                      </td>
                      <td className="px-4 py-3">{row.recommended_action ?? '—'}</td>
                      <td className="px-4 py-3">
                        <ModeBadge mode={row.action_mode} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 max-w-[300px] truncate text-muted-foreground">
                        {row.reasoning ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(row.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ImpactBadge({ size }: { size: string }) {
  const variant = size === 'large' ? 'destructive' : size === 'medium' ? 'secondary' : 'outline';
  return <Badge variant={variant}>{size}</Badge>;
}

function ModeBadge({ mode }: { mode: string }) {
  return (
    <Badge variant={mode === 'hitl' ? 'secondary' : 'outline'}>
      {mode === 'hitl' ? 'HITL' : 'Auto'}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    executed: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
