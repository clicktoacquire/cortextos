'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  IconCheck,
  IconX,
  IconClock,
  IconLoader2,
  IconAlertTriangle,
  IconRefresh,
  IconChevronDown,
  IconInbox,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface Recommendation {
  rec_id: string;
  client_id: string;
  campaign_id: string;
  platform: string;
  anomaly_type: string;
  recommendation: string;
  rationale: string;
  status: string;
  generated_at: string;
  approved_at: string | null;
  action_type: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

const SNOOZE_OPTIONS = [
  { value: 'snooze_1h', label: '1 hour' },
  { value: 'snooze_4h', label: '4 hours' },
  { value: 'snooze_24h', label: '24 hours' },
  { value: 'snooze_skip_cycle', label: 'Skip cycle' },
] as const;

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecommendationsClient() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const fetchRecs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/recommendations?status=pending_review');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }
      if (data.table_missing) {
        setTableMissing(true);
      }
      setRecs(data.recommendations ?? []);
    } catch {
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecs();
  }, [fetchRecs]);

  const handleAction = useCallback(
    async (recId: string, action: string, skipReason?: string) => {
      setActing(recId);
      setSnoozeOpen(null);
      try {
        const res = await fetch('/api/recommendations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rec_id: recId,
            action,
            skip_reason: skipReason,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error ?? 'Action failed', 'error');
          return;
        }
        showToast(data.message);
        setRecs((prev) => prev.filter((r) => r.rec_id !== recId));
      } catch {
        showToast('Network error', 'error');
      } finally {
        setActing(null);
      }
    },
    [showToast],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tableMissing) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <IconInbox size={40} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground text-center">
            Recommendations table not yet created in BigQuery.
            <br />
            This will populate once the Google Ads recommendations ingest pipeline ships.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {recs.length === 0
            ? 'No pending recommendations'
            : `${recs.length} pending review`}
        </p>
        <Button variant="outline" size="sm" onClick={fetchRecs}>
          <IconRefresh size={14} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <IconAlertTriangle size={16} />
          {error}
        </div>
      )}

      {recs.length === 0 && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <IconCheck size={40} className="text-green-500/40" />
            <p className="text-sm text-muted-foreground">All caught up. No pending recommendations.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {recs.map((rec) => {
            const isActing = acting === rec.rec_id;
            const isSnoozeOpen = snoozeOpen === rec.rec_id;

            return (
              <Card key={rec.rec_id} size="sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-sm">{rec.recommendation}</CardTitle>
                      <CardDescription className="mt-1">
                        {rec.campaign_id || 'Account-level'}
                        {' · '}
                        {rec.client_id}
                        {' · '}
                        {rec.platform}
                        {' · '}
                        <span className="text-muted-foreground/60">{formatTime(rec.generated_at)}</span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[10px]">
                        {rec.action_type}
                      </Badge>
                      {rec.anomaly_type && (
                        <Badge variant="secondary" className="text-[10px]">
                          {rec.anomaly_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {rec.rationale && (
                    <p className="text-xs text-muted-foreground mb-3">
                      <span className="font-medium">Rationale:</span> {rec.rationale}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={isActing}
                      onClick={() => handleAction(rec.rec_id, 'approve')}
                    >
                      {isActing ? (
                        <IconLoader2 size={14} className="animate-spin" />
                      ) : (
                        <IconCheck size={14} />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActing}
                      onClick={() => handleAction(rec.rec_id, 'skip')}
                    >
                      <IconX size={14} />
                      Skip
                    </Button>

                    {/* Snooze dropdown */}
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isActing}
                        onClick={() =>
                          setSnoozeOpen(isSnoozeOpen ? null : rec.rec_id)
                        }
                      >
                        <IconClock size={14} />
                        Snooze
                        <IconChevronDown size={12} />
                      </Button>
                      {isSnoozeOpen && (
                        <div className="absolute top-full left-0 z-50 mt-1 min-w-36 rounded-lg border bg-popover p-1 shadow-md">
                          {SNOOZE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              className="flex w-full items-center rounded-md px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                              onClick={() =>
                                handleAction(rec.rec_id, opt.value)
                              }
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Toast container */}
      <div className="fixed bottom-20 right-4 z-[100] flex flex-col gap-2 md:bottom-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'animate-in slide-in-from-right-5 fade-in rounded-lg px-4 py-2.5 text-sm shadow-lg',
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-destructive text-destructive-foreground',
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
