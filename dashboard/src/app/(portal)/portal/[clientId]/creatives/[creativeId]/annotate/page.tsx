import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { makeBQClient } from '@/lib/bq';
import AnnotateCanvas from './AnnotateCanvas';

export const dynamic = 'force-dynamic';

interface CreativeRow {
  creative_id: string;
  client_id: string;
  platform: string;
  ad_id: string;
  ad_type: string;
  asset_type: string;
  asset_text: string | null;
  asset_url: string | null;
}

export default async function AnnotatePage({
  params,
}: {
  params: Promise<{ clientId: string; creativeId: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  const user = session.user as { role?: string; client_id?: string | null };
  const { clientId, creativeId } = await params;

  if (user.role === 'client' && user.client_id !== clientId) {
    redirect(`/portal/${user.client_id}/creatives`);
  }

  let creative: CreativeRow | null = null;
  let bqError: string | null = null;

  try {
    const bq = makeBQClient();
    const query = `
      SELECT
        creative_id, client_id, platform, ad_id, ad_type,
        asset_type, asset_text, asset_url
      FROM \`click-to-acquire.analytics.creative_catalog\`
      WHERE client_id = @clientId
        AND creative_id = @creativeId
      LIMIT 1
    `;
    const [rows] = await bq.query({
      query,
      location: 'US',
      params: { clientId, creativeId },
    });
    creative = (rows[0] as CreativeRow) ?? null;
  } catch (err) {
    bqError = err instanceof Error ? err.message : String(err);
  }

  if (bqError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Annotate Creative</h1>
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Could not load creative: {bqError}
        </div>
      </div>
    );
  }

  if (!creative) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Annotate Creative</h1>
        <p className="mt-1 text-sm text-zinc-500">
          <span className="text-xs uppercase tracking-wider text-zinc-500">
            {creative.platform}
          </span>{' '}
          &middot;{' '}
          <span className="font-mono text-xs text-zinc-400">{creative.creative_id}</span>
        </p>
      </div>
      <AnnotateCanvas
        clientId={clientId}
        creativeId={creativeId}
        assetType={creative.asset_type}
        assetUrl={creative.asset_url}
        assetText={creative.asset_text}
      />
    </div>
  );
}
