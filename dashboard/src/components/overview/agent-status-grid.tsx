'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HealthDot } from '@/components/shared/health-dot';
import { IconRobot, IconChevronRight } from '@tabler/icons-react';
import type { AgentSummary, Heartbeat } from '@/lib/types';

interface AgentStatusGridProps {
  agents: (AgentSummary & { emoji?: string })[];
  heartbeats: Record<string, Heartbeat>;
}

function heartbeatAgeClass(ts: string | undefined): string {
  if (!ts) return 'text-muted-foreground';
  const ageMs = Date.now() - new Date(ts).getTime();
  if (ageMs < 5 * 60 * 1000) return 'text-green-600 dark:text-green-400';
  if (ageMs < 30 * 60 * 1000) return 'text-amber-500 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

function formatHeartbeatAge(ts: string | undefined): string {
  if (!ts) return 'never';
  const ageMs = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ageMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function AgentStatusGrid({ agents, heartbeats }: AgentStatusGridProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <IconRobot size={16} className="text-muted-foreground" />
          Agent Fleet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {agents.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No agents discovered
          </p>
        ) : (
          agents.map((agent) => {
            const hb = heartbeats[agent.name];
            const currentTask = hb?.current_task || '';
            const taskPreview = currentTask
              .replace(/^WORKING ON:\s*/i, '')
              .slice(0, 60);

            return (
              <Link
                key={agent.name}
                href={`/agents/${encodeURIComponent(agent.name)}`}
                className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-sm">
                  {agent.emoji || agent.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {agent.name}
                    </span>
                    <HealthDot status={agent.health} />
                    <span className={`ml-auto text-[10px] tabular-nums shrink-0 ${heartbeatAgeClass(hb?.last_heartbeat)}`}>
                      {formatHeartbeatAge(hb?.last_heartbeat)}
                    </span>
                  </div>
                  {taskPreview && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {taskPreview}
                    </p>
                  )}
                </div>
                <IconChevronRight
                  size={14}
                  className="shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors"
                />
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
