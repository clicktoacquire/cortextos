import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { makeBQClient } from '@/lib/bq';
import VersionsClient from './VersionsClient';

export const dynamic = 'force-dynamic';

interface VersionRow {
  creative_id: string;
  asset_type: string;
  asset_url: string | null;
  asset_text: string | null;
  hook_type: string[] | null;
  angle: string[] | null;
  first_seen: string;
  last_seen: string;
}

export default async function VersionsPage({
  params,
}: {
  params: Promise<{ clientId: string; creativeId: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  const user = session.user as { role?: string; client_id?: string | null };
  // The [creativeId] segment is used here as the adId per the spec note
  const { clientId, creativeId: adId } = await params;

  if (user.role === 'client' && user.client_id !== clientId) {
    redirect(`/portal/${user.client_id}/creatives`);
  }

  let versions: VersionRow[] = [];
  let bqError: string | null = null;

  try {
    const bq = makeBQClient();
    const query = `
      SELECT
        creative_id,
        asset_type,
        asset_url,
        asset_text,
        hook_type,
        angle,
        FORMAT_DATE('%Y-%m-%d', first_seen) AS first_seen,
        FORMAT_DATE('%Y-%m-%d', last_seen) AS last_seen
      FROM \`click-to-acquire.analytics.creative_catalog\`
      WHERE client_id = @clientId
        AND ad_id = @adId
      ORDER BY first_seen ASC
    `;
    const [rows] = await bq.query({
      query,
      location: 'US',
      params: { clientId, adId },
    });
    versions = rows as VersionRow[];
  } catch (err) {
    bqError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Creative Versions</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Ad <span className="font-mono text-xs">{adId}</span> — {versions.length} version{versions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {bqError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Could not load versions: {bqError}
        </div>
      )}

      {!bqError && versions.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-10 text-center">
          <p className="text-base font-medium text-zinc-300">No versions found</p>
          <p className="mt-1 text-sm text-zinc-500">
            No creatives found for ad <span className="font-mono text-xs">{adId}</span>.
          </p>
        </div>
      )}

      {!bqError && versions.length > 0 && (
        <VersionsClient clientId={clientId} adId={adId} versions={versions} />
      )}
    </div>
  );
}
