'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { submitAnswer } from '@/app/(portal)/[clientId]/questions/[id]/actions';

interface Props {
  clientId: string;
  questionId: string;
  currentContent: string;
}

export function PortalAnswerComposer({ clientId, questionId, currentContent }: Props) {
  const [text, setText] = useState(currentContent);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [optimisticText, setOptimisticText] = useOptimistic(currentContent);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      setOptimisticText(text);
      const result = await submitAnswer(clientId, questionId, text);
      if (!result.ok) {
        setError(result.error);
        setOptimisticText(currentContent);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
        {currentContent ? 'Edit answer' : 'Add answer'}
      </h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="Write the answer visible to this client…"
        disabled={isPending}
        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none disabled:opacity-60 resize-none"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">{text.length}/2000</span>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-red-500">{error}</span>}
          {saved && <span className="text-xs text-green-600">Saved</span>}
          <button
            type="submit"
            disabled={isPending || text.trim() === currentContent.trim()}
            className="text-sm px-4 py-1.5 rounded border border-gray-800 bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {/* Optimistic preview while saving */}
      {isPending && optimisticText !== currentContent && (
        <p className="mt-2 text-xs text-gray-400 italic">Saving: "{optimisticText.slice(0, 80)}{optimisticText.length > 80 ? '…' : ''}"</p>
      )}
    </form>
  );
}
