export const dynamic = 'force-dynamic';

import { AnswersClient } from './answers-client';

export default function AnswersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Answers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ask questions about client ad performance. Powered by BigQuery + Claude.
        </p>
      </div>
      <AnswersClient />
    </div>
  );
}
