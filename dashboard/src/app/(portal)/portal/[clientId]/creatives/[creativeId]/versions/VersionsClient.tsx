'use client';

import { useState } from 'react';
import Link from 'next/link';

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

function isVideoType(t: string) { return t.toLowerCase().includes('video'); }
function isImageType(t: string) {
  const l = t.toLowerCase();
  return l.includes('image') || l.includes('img') || l.includes('photo') || l.includes('banner');
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded bg-zinc-700/60 border border-zinc-600/40 px-1.5 py-0.5 text-xs font-medium text-zinc-300">
      {label}
    </span>
  );
}

interface Props {
  clientId: string;
  adId: string;
  versions: VersionRow[];
}

export default function VersionsClient({ clientId, adId, versions }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number>(versions.length > 0 ? versions.length - 1 : 0);
  const [instruction, setInstruction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = versions[selectedIdx];

  async function handleRegenRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!instruction.trim() || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creative_id: selected.creative_id,
          client_id: clientId,
          comment: instruction.trim(),
          status: 'regen-request',
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      setSuccess(true);
      setInstruction('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error submitting request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Horizontal version fan */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {versions.map((v, idx) => {
            const isVideo = isVideoType(v.asset_type);
            const isImage = !isVideo && isImageType(v.asset_type);
            const isActive = idx === selectedIdx;
            return (
              <button
                key={v.creative_id}
                onClick={() => setSelectedIdx(idx)}
                className={`group relative flex-shrink-0 w-36 rounded-lg border overflow-hidden transition-all ${
                  isActive
                    ? 'border-indigo-500 ring-1 ring-indigo-500'
                    : 'border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <div className="aspect-video w-full bg-zinc-800 overflow-hidden">
                  {isImage && v.asset_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.asset_url} alt={`V${idx + 1}`} className="h-full w-full object-cover" />
                  ) : isVideo && v.asset_url ? (
                    <video
                      src={v.asset_url}
                      preload="metadata"
                      muted
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center p-2">
                      <p className="text-xs text-zinc-400 italic line-clamp-3">
                        {(v.asset_text ?? '').slice(0, 80)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="bg-zinc-900 px-2 py-1.5">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className={`text-xs font-semibold ${isActive ? 'text-indigo-400' : 'text-zinc-300'}`}>
                      V{idx + 1}
                    </span>
                    <span className="text-xs text-zinc-500">{v.first_seen}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected version detail */}
      {selected && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                Version {selectedIdx + 1} of {versions.length}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                First seen {selected.first_seen} · Last seen {selected.last_seen}
              </p>
            </div>
            <Link
              href={`/portal/${clientId}/creatives/${encodeURIComponent(selected.creative_id)}/annotate`}
              className="flex-shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Annotate
            </Link>
          </div>

          {/* Preview */}
          {(() => {
            const isVideo = isVideoType(selected.asset_type);
            const isImage = !isVideo && isImageType(selected.asset_type);
            if (isImage && selected.asset_url) {
              return (
                <div className="overflow-hidden rounded-lg border border-zinc-800 aspect-video">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.asset_url} alt={`V${selectedIdx + 1}`} className="h-full w-full object-cover" />
                </div>
              );
            }
            if (isVideo && selected.asset_url) {
              return (
                <div className="overflow-hidden rounded-lg border border-zinc-800">
                  <video src={selected.asset_url} controls preload="metadata" className="w-full" />
                </div>
              );
            }
            if (selected.asset_text) {
              return (
                <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-4">
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{selected.asset_text}</p>
                </div>
              );
            }
            return null;
          })()}

          {/* Tags */}
          {((selected.hook_type ?? []).length > 0 || (selected.angle ?? []).length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {(selected.hook_type ?? []).map((t) => <Chip key={`h-${t}`} label={t} />)}
              {(selected.angle ?? []).map((t) => <Chip key={`a-${t}`} label={t} />)}
            </div>
          )}
        </div>
      )}

      {/* Request new version */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">Request a new version</h3>
        <p className="text-xs text-zinc-500">
          Describe what you&apos;d like changed. Our system will generate a new iteration.
        </p>

        {success && (
          <div className="rounded-md border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400">
            Request queued — our system will generate a new version.
          </div>
        )}

        {!success && (
          <form onSubmit={handleRegenRequest} className="space-y-3">
            {error && <p className="text-xs text-red-400">{error}</p>}
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={4}
              disabled={submitting}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              placeholder="e.g. Shorten the hook to 3 seconds, use a darker color palette, emphasise the CTA…"
            />
            <button
              type="submit"
              disabled={submitting || !instruction.trim() || !selected}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </form>
        )}
      </div>

      {versions.length === 1 && (
        <p className="text-xs text-zinc-500">
          Only one version exists for ad <span className="font-mono">{adId}</span> — request above to create the next iteration.
        </p>
      )}
    </div>
  );
}
