'use client';

import { useState, useTransition } from 'react';
import { approveOnboardingDoc, rejectOnboardingDoc } from '@/app/(portal)/[clientId]/onboarding/review/actions';

interface Props {
  clientId: string;
  currentStatus: string;
}

export function OnboardingReviewActions({ clientId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handleApprove() {
    startTransition(async () => {
      const result = await approveOnboardingDoc(clientId);
      if (result.ok) {
        setMessage({ type: 'success', text: 'Approved — state machine advanced to research_wave1' });
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    });
  }

  function handleReject() {
    if (!rejectReason.trim()) return;
    startTransition(async () => {
      const result = await rejectOnboardingDoc(clientId, rejectReason.trim());
      if (result.ok) {
        setMessage({ type: 'success', text: 'Rejection logged with amendment note' });
        setRejectOpen(false);
        setRejectReason('');
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    });
  }

  const isApproved = currentStatus === 'approved';

  return (
    <div className="space-y-3">
      {message && (
        <div className={`text-sm px-4 py-2 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={isPending || isApproved}
          className="text-sm px-5 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Saving…' : isApproved ? 'Approved ✓' : 'Approve'}
        </button>
        <button
          onClick={() => setRejectOpen(!rejectOpen)}
          disabled={isPending}
          className="text-sm px-5 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
        >
          Reject / Request changes
        </button>
      </div>

      {rejectOpen && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <label className="text-xs font-medium text-gray-600 block">Reason / changes needed</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Describe what needs to be corrected…"
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={isPending || !rejectReason.trim()}
              className="text-sm px-4 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
            >
              Submit rejection
            </button>
            <button
              onClick={() => { setRejectOpen(false); setRejectReason(''); }}
              className="text-sm px-4 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
