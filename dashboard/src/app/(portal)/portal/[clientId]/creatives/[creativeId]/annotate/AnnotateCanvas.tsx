'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface RegionBoxPoint { type: 'point'; x: number; y: number }
interface RegionBoxTimestamp { type: 'timestamp'; t: number }
interface RegionBoxText { type: 'text'; quote: string }
interface RegionBoxLegacy { x: number; y: number; width?: number; height?: number }
type RegionBox = RegionBoxPoint | RegionBoxTimestamp | RegionBoxText | null;

interface Annotation {
  annotation_id: string;
  creative_id: string;
  client_id: string;
  region_box: string | null;
  comment: string;
  status: string;
  created_at: string;
  created_by: string;
}

interface AnnotationsResponse {
  annotations: Annotation[];
}

function parseRegionBox(raw: string | null): RegionBox {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RegionBoxPoint | RegionBoxTimestamp | RegionBoxText | RegionBoxLegacy;
    if ('type' in parsed) {
      if (parsed.type === 'point' || parsed.type === 'timestamp' || parsed.type === 'text') {
        return parsed as RegionBox;
      }
    }
    // Legacy {x,y,width?,height?} rect — treat as point
    if ('x' in parsed && 'y' in parsed) {
      return { type: 'point', x: (parsed as RegionBoxLegacy).x, y: (parsed as RegionBoxLegacy).y };
    }
  } catch {
    // unparseable — ignore
  }
  return null;
}

function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    resolved: 'bg-green-500/10 text-green-400 border-green-500/20',
    'regen-request': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
      {status}
    </span>
  );
}

export interface AnnotateCanvasProps {
  clientId: string;
  creativeId: string;
  assetType: string;
  assetUrl: string | null;
  assetText: string | null;
}

export default function AnnotateCanvas({ clientId, creativeId, assetType, assetUrl, assetText }: AnnotateCanvasProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pending pin/anchor state
  const [pendingBox, setPendingBox] = useState<RegionBox>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // General comment (no anchor)
  const [generalComment, setGeneralComment] = useState('');
  const [generalSubmitting, setGeneralSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const isVideo = assetType.toLowerCase().includes('video');
  const isImage = !isVideo && (assetType.toLowerCase().includes('image') || assetType.toLowerCase().includes('img') || assetType.toLowerCase().includes('photo') || assetType.toLowerCase().includes('banner'));
  const isText = !isVideo && !isImage;

  const fetchAnnotations = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/annotations?client_id=${encodeURIComponent(clientId)}&creative_id=${encodeURIComponent(creativeId)}`);
      const data = await res.json() as AnnotationsResponse;
      setAnnotations(data.annotations ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load annotations');
    }
  }, [clientId, creativeId]);

  useEffect(() => { void fetchAnnotations(); }, [fetchAnnotations]);

  async function postAnnotation(comment: string, box: RegionBox) {
    const res = await fetch('/api/portal/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        creative_id: creativeId,
        comment,
        region_box: box ?? undefined,
      }),
    });
    if (!res.ok) {
      const d = await res.json() as { error?: string };
      throw new Error(d.error ?? `HTTP ${res.status}`);
    }
  }

  async function handleAnchoredSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await postAnnotation(commentText.trim(), pendingBox);
      setCommentText('');
      setPendingBox(null);
      await fetchAnnotations();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error saving');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGeneralSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!generalComment.trim()) return;
    setGeneralSubmitting(true);
    try {
      await postAnnotation(generalComment.trim(), null);
      setGeneralComment('');
      await fetchAnnotations();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error saving');
    } finally {
      setGeneralSubmitting(false);
    }
  }

  function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPendingBox({ type: 'point', x, y });
    setCommentText('');
    setSubmitError(null);
  }

  function handleVideoComment() {
    const t = videoRef.current?.currentTime ?? 0;
    setPendingBox({ type: 'timestamp', t });
    setCommentText('');
    setSubmitError(null);
  }

  function handleTextSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const quote = sel.toString().trim().slice(0, 300);
    if (!quote) return;
    setPendingBox({ type: 'text', quote });
    setCommentText('');
    setSubmitError(null);
  }

  function highlightAnnotation(id: string) {
    setHighlightedId(id);
    const el = document.getElementById(`ann-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Point annotations indexed for pins
  const pointAnnotations = annotations.filter((a) => {
    const b = parseRegionBox(a.region_box);
    return b?.type === 'point';
  });

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Left: media + comment form */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Image */}
        {isImage && assetUrl && (
          <div
            ref={imgContainerRef}
            className="relative aspect-video w-full cursor-crosshair overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
            onClick={handleImageClick}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl} alt="creative" className="h-full w-full object-cover" />
            {/* Existing point pins */}
            {pointAnnotations.map((a, idx) => {
              const b = parseRegionBox(a.region_box) as RegionBoxPoint;
              return (
                <button
                  key={a.annotation_id}
                  onClick={(e) => { e.stopPropagation(); highlightAnnotation(a.annotation_id); }}
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-lg ring-2 ring-white/20 hover:bg-indigo-500"
                >
                  {idx + 1}
                </button>
              );
            })}
            {/* Pending pin */}
            {pendingBox?.type === 'point' && (
              <div
                style={{ left: `${pendingBox.x * 100}%`, top: `${pendingBox.y * 100}%` }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 h-6 w-6 rounded-full border-2 border-white bg-indigo-400/80"
              />
            )}
          </div>
        )}

        {/* Video */}
        {isVideo && assetUrl && (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
              <video
                ref={videoRef}
                src={assetUrl}
                controls
                preload="metadata"
                className="w-full"
              />
            </div>
            <button
              type="button"
              onClick={handleVideoComment}
              className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
            >
              💬 Comment at current time
            </button>
          </div>
        )}

        {/* Text / article */}
        {isText && assetText && (
          <div
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
            onMouseUp={handleTextSelection}
          >
            <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
              Select text to comment on a passage
            </p>
            <div className="prose prose-invert prose-sm max-w-none space-y-3 text-zinc-300">
              {assetText.split('\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            {pendingBox?.type === 'text' && (
              <div className="mt-3 rounded border border-indigo-500/30 bg-indigo-500/10 p-2 text-xs text-indigo-300">
                Selected: &ldquo;{pendingBox.quote}&rdquo;
              </div>
            )}
          </div>
        )}

        {/* Anchored comment box (appears after selecting an anchor) */}
        {pendingBox && (
          <form onSubmit={handleAnchoredSubmit} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              {pendingBox.type === 'point' && 'Comment on this location'}
              {pendingBox.type === 'timestamp' && `Comment at ${fmtTime((pendingBox as RegionBoxTimestamp).t)}`}
              {pendingBox.type === 'text' && 'Comment on selection'}
            </p>
            {submitError && <p className="text-xs text-red-400">{submitError}</p>}
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              placeholder="Describe what you'd like to change…"
              disabled={submitting}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || !commentText.trim()}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Post Comment'}
              </button>
              <button
                type="button"
                onClick={() => { setPendingBox(null); setCommentText(''); }}
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* General feedback box */}
        <form onSubmit={handleGeneralSubmit} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-zinc-500">General feedback</p>
          <textarea
            value={generalComment}
            onChange={(e) => setGeneralComment(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            placeholder="Leave a general comment (not tied to a location)…"
            disabled={generalSubmitting}
          />
          <button
            type="submit"
            disabled={generalSubmitting || !generalComment.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {generalSubmitting ? 'Saving…' : 'Post Feedback'}
          </button>
        </form>
      </div>

      {/* Right: annotation sidebar */}
      <div ref={sidebarRef} className="w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500">
          Annotations ({annotations.length})
        </h2>
        {loadError && (
          <p className="text-xs text-red-400">{loadError}</p>
        )}
        {annotations.length === 0 && !loadError && (
          <p className="text-sm text-zinc-500">No annotations yet.</p>
        )}
        {annotations.map((a) => {
          const box = parseRegionBox(a.region_box);
          const isHighlighted = highlightedId === a.annotation_id;
          const pinIdx = pointAnnotations.findIndex((p) => p.annotation_id === a.annotation_id);

          return (
            <div
              key={a.annotation_id}
              id={`ann-${a.annotation_id}`}
              className={`rounded-lg border p-3 space-y-1.5 transition-colors ${isHighlighted ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-zinc-800 bg-zinc-900'}`}
            >
              {/* Anchor descriptor */}
              {box?.type === 'point' && (
                <button
                  onClick={() => setHighlightedId(a.annotation_id)}
                  className="flex items-center gap-1.5 text-xs text-indigo-400"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
                    {pinIdx + 1}
                  </span>
                  Point annotation
                </button>
              )}
              {box?.type === 'timestamp' && (
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = (box as RegionBoxTimestamp).t;
                    }
                  }}
                  className="inline-flex items-center rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-600"
                >
                  ⏱ {fmtTime((box as RegionBoxTimestamp).t)}
                </button>
              )}
              {box?.type === 'text' && (
                <blockquote className="border-l-2 border-indigo-500 pl-2 text-xs italic text-zinc-400 line-clamp-2">
                  {(box as RegionBoxText).quote}
                </blockquote>
              )}

              <p className="text-sm text-zinc-200">{a.comment}</p>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status} />
                <span className="text-xs text-zinc-500">{relativeTime(a.created_at)}</span>
                <span className="text-xs text-zinc-600 truncate">{a.created_by}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
