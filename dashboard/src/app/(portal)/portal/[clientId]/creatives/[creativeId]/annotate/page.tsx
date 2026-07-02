'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  params: Promise<{ clientId: string; creativeId: string }>;
}

// Next.js 14 — unwrap params with React.use in client components
import { use } from 'react';

export default function AnnotatePage({ params }: Props) {
  const { clientId, creativeId } = use(params);
  const router = useRouter();

  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/portal/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, creative_id: creativeId, comment }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setSuccess(true);
      setComment('');
      setTimeout(() => router.push(`/portal/${clientId}/creatives`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Add Annotation</h1>
      <p className="mb-6 text-sm text-gray-500">
        Creative <span className="font-mono text-xs">{creativeId}</span>
      </p>

      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700">
          Annotation saved — redirecting…
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
            Comment
          </label>
          <textarea
            id="comment"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Describe what you'd like to change or highlight…"
            disabled={submitting || success}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || success || !comment.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save Annotation'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
