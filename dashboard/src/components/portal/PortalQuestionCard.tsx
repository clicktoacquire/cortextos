type QuestionResult =
  | { id: string; question: string; answer: string; metrics: string[]; live: true }
  | { id: string; question: string; live: false; reason: string };

interface Props {
  result: QuestionResult;
}

export function PortalQuestionCard({ result }: Props) {
  if (!result.live) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-5">
        <p className="text-sm font-medium text-gray-400 mb-1">{result.question}</p>
        <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          Coming soon
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
        {result.question}
      </p>
      <p className="text-sm font-semibold text-gray-900 mb-3 leading-snug">
        {result.answer}
      </p>
      {result.metrics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.metrics.map((m) => (
            <span
              key={m}
              className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5"
            >
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
