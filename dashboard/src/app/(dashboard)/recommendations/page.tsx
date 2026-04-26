export const dynamic = 'force-dynamic';

import { RecommendationsClient } from './recommendations-client';

export default function RecommendationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recommendations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review pending optimization recommendations. Approve to send to googli for execution.
        </p>
      </div>
      <RecommendationsClient />
    </div>
  );
}
