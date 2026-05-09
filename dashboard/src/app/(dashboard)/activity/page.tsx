import { getOrgs, getAllAgents } from '@/lib/config';
import { getRecentEvents } from '@/lib/data/events';
import { getRecentAuditLog } from '@/lib/audit';
import { ActivityPageClient } from './client';

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const orgs = getOrgs();
  const orgParam = typeof params.org === 'string' ? params.org : undefined;
  const org = orgParam && orgs.includes(orgParam) ? orgParam : undefined;

  const initialEvents = getRecentEvents(100, org);
  const allAgents = getAllAgents();
  const agentNames = [...new Set(allAgents.map((a) => a.name))];

  let auditRows: Awaited<ReturnType<typeof getRecentAuditLog>> = [];
  try {
    auditRows = getRecentAuditLog(50);
  } catch {
    // audit_log may not exist yet in older DB files; degrade gracefully
  }

  return (
    <ActivityPageClient
      initialEvents={initialEvents}
      agents={agentNames}
      orgs={orgs}
      auditRows={auditRows}
    />
  );
}
