'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EventFeed, type EventFeedFilters } from '@/components/activity/event-feed';
import { ActivityFilters } from '@/components/activity/activity-filters';
import type { Event } from '@/lib/types';
import type { AuditRow } from '@/lib/audit';

interface ActivityPageClientProps {
  initialEvents: Event[];
  agents: string[];
  orgs: string[];
  auditRows: AuditRow[];
}

type ActiveTab = 'agent' | 'human';

export function ActivityPageClient({
  initialEvents,
  agents,
  orgs,
  auditRows,
}: ActivityPageClientProps) {
  const [tab, setTab] = useState<ActiveTab>('agent');
  const [filters, setFilters] = useState<EventFeedFilters>({
    types: [],
    agent: '',
    org: '',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time event stream from all agents.
        </p>
      </div>

      <div className="border-b flex gap-0">
        <TabButton active={tab === 'agent'} onClick={() => setTab('agent')}>
          Agent Events
        </TabButton>
        <TabButton active={tab === 'human'} onClick={() => setTab('human')}>
          Human Actions
          {auditRows.length > 0 && (
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              {auditRows.length}
            </span>
          )}
        </TabButton>
      </div>

      {tab === 'agent' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFilters
                filters={filters}
                onFiltersChange={setFilters}
                agents={agents}
                orgs={orgs}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <EventFeed initialEvents={initialEvents} filters={filters} />
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'human' && (
        <Card>
          <CardContent className="pt-6">
            <HumanActionsTable rows={auditRows} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1',
        active
          ? 'border-foreground text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function HumanActionsTable({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-base font-medium text-muted-foreground">No human actions recorded yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Admin create / update / delete actions will appear here.
        </p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="pb-2 text-left font-medium text-muted-foreground">Time</th>
          <th className="pb-2 text-left font-medium text-muted-foreground">User</th>
          <th className="pb-2 text-left font-medium text-muted-foreground">Action</th>
          <th className="pb-2 text-left font-medium text-muted-foreground">Subject</th>
          <th className="pb-2 text-left font-medium text-muted-foreground">IP</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b last:border-0">
            <td className="py-2 text-muted-foreground whitespace-nowrap">
              {new Date(row.ts).toLocaleString()}
            </td>
            <td className="py-2 font-medium">{row.username}</td>
            <td className="py-2">
              <ActionBadge action={row.action} />
            </td>
            <td className="py-2 text-muted-foreground">
              <span className="font-medium text-foreground">{row.subject_type}</span>
              {row.subject_id && (
                <span className="ml-1 font-mono text-xs">{row.subject_id}</span>
              )}
            </td>
            <td className="py-2 text-muted-foreground font-mono text-xs">{row.ip ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ActionBadge({ action }: { action: string }) {
  const variants: Record<string, string> = {
    create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    publish: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    approve: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
    reject: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  };
  const cls = variants[action] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {action}
    </span>
  );
}
