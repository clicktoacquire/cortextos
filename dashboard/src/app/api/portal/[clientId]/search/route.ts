import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { searchAnswers } from '@/lib/data/portal-answers';

const QUESTION_CATALOG: Record<string, string> = {
  spend:             'How much did we spend?',
  revenue:           'How much revenue did this generate?',
  cost_per_customer: 'What did each customer cost us?',
  lead_count:        'How many leads did we generate?',
  on_track:          'Are we on track for the month?',
  lead_growth:       'Are leads growing?',
  best_campaign:     'Which campaign is performing best?',
  best_creative:     'Which creative is driving results?',
  wasted_budget:     'How much budget is being wasted?',
  whats_testing:     'What are we testing right now?',
  work_done:         'What did the team do this week?',
  cpa_target:        'Are we hitting target CPA?',
  tracking_health:   'Is tracking working?',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const token = await getToken({ req });

  if (!token?.client_id || token.client_id !== clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const lower = q.toLowerCase();

  // Match question catalog entries
  const questionMatches = Object.entries(QUESTION_CATALOG)
    .filter(([, text]) => text.toLowerCase().includes(lower))
    .map(([id, question]) => ({ type: 'question' as const, id, question, snippet: null }));

  // Match stored answers
  const answerRows = searchAnswers(clientId, q);
  const answerMatches = answerRows.map((row) => ({
    type: 'answer' as const,
    id: row.question_id,
    question: QUESTION_CATALOG[row.question_id] ?? row.question_id,
    snippet: row.content.slice(0, 120) + (row.content.length > 120 ? '…' : ''),
  }));

  // Merge, dedupe by id (prefer answer match if both hit)
  const seen = new Set<string>();
  const results = [...answerMatches, ...questionMatches].filter(({ id }) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return NextResponse.json({ results: results.slice(0, 10) });
}
