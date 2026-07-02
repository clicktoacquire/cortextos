import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { makeBQClient } from '@/lib/bq';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface CreativeRow {
  client_id: string;
  platform: string;
  ad_id: string;
  creative_id: string;
  asset_id: string;
  ad_type: string;
  asset_type: string;
  asset_text: string | null;
  asset_url: string | null;
  hook_type: string[] | null;
  angle: string[] | null;
  first_seen: string;
  last_seen: string;
}

function isVideoType(asset_type: string): boolean {
  return asset_type.toLowerCase().includes('video');
}

function isImageType(asset_type: string): boolean {
  const t = asset_type.toLowerCase();
  return t.includes('image') || t.includes('img') || t.includes('photo') || t.includes('banner');
}

function Chip({ label, variant = 'default' }: { label: string; variant?: 'default' | 'platform' | 'tag' }) {
  const cls =
    variant === 'platform'
      ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
      : variant === 'tag'
        ? 'bg-zinc-700/60 text-zinc-300 border border-zinc-600/40'
        : 'bg-zinc-800 text-zinc-400 border border-zinc-700';
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default async function CreativesPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  const user = session.user as { role?: string; client_id?: string | null };
  const { clientId } = await params;

  if (user.role === 'client' && user.client_id !== clientId) {
    redirect(`/portal/${user.client_id}/creatives`);
  }

  let creatives: CreativeRow[] = [];
  let bqError: string | null = null;

  try {
    const bq = makeBQClient();
    const query = `
      SELECT
        client_id, platform, ad_id, creative_id, asset_id, ad_type,
        asset_type, asset_text, asset_url, hook_type, angle,
        FORMAT_DATE('%Y-%m-%d', first_seen) AS first_seen,
        FORMAT_DATE('%Y-%m-%d', last_seen) AS last_seen
      FROM \`click-to-acquire.analytics.creative_catalog\`
      WHERE client_id = @clientId
      ORDER BY last_seen DESC
      LIMIT 60
    `;
    const [rows] = await bq.query({ query, location: 'US', params: { clientId } });
    creatives = rows as CreativeRow[];
  } catch (err) {
    bqError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Creatives</h1>
        <p className="mt-1 text-sm text-zinc-500">Active ad assets — most recent first</p>
      </div>

      {bqError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Could not load creatives: {bqError}
        </div>
      )}

      {!bqError && creatives.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-10 text-center">
          <p className="text-base font-medium text-zinc-300">No creatives ingested yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Once your ad assets are synced they will appear here.
          </p>
        </div>
      )}

      {creatives.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {creatives.map((c) => {
            const isVideo = isVideoType(c.asset_type);
            const isImage = !isVideo && isImageType(c.asset_type);
            const tags = [
              ...(c.hook_type ?? []).slice(0, 2),
              ...(c.angle ?? []).slice(0, 2),
            ].slice(0, 2);

            return (
              <div
                key={c.creative_id}
                className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden flex flex-col"
              >
                {/* Media preview */}
                <Link
                  href={`./creatives/${encodeURIComponent(c.creative_id)}/annotate`}
                  className="block"
                >
                  {isImage && c.asset_url ? (
                    <div className="aspect-video w-full overflow-hidden bg-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.asset_url}
                        alt={c.ad_type}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : isVideo && c.asset_url ? (
                    <div className="aspect-video w-full overflow-hidden bg-zinc-800">
                      <video
                        src={c.asset_url}
                        controls
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full overflow-hidden bg-zinc-800 p-3 flex items-start">
                      <blockquote className="text-xs leading-relaxed text-zinc-300 italic line-clamp-5">
                        &ldquo;{(c.asset_text ?? '').slice(0, 200)}{(c.asset_text ?? '').length > 200 ? '…' : ''}&rdquo;
                      </blockquote>
                    </div>
                  )}
                </Link>

                {/* Card body */}
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div className="flex flex-wrap gap-1">
                    {c.platform && <Chip label={c.platform} variant="platform" />}
                    {c.ad_type && <Chip label={c.ad_type} />}
                  </div>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tags.map((t) => (
                        <Chip key={t} label={t} variant="tag" />
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wider text-zinc-500">
                      {c.last_seen}
                    </span>
                    <Link
                      href={`./creatives/${encodeURIComponent(c.ad_id)}/versions`}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Versions
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
