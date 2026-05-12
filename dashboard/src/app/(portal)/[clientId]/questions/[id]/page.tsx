import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getAnswer, getAuditEvents } from '@/lib/data/portal-answers';
import { PortalAnswerComposer } from '@/components/portal/PortalAnswerComposer';

export const dynamic = 'force-dynamic';

// Question catalog — maps id to display text
const QUESTION_CATALOG: Record<string, { question: string; description: string }> = {
  spend:           { question: 'How much did we spend?', description: 'Total ad spend across all platforms for the selected period.' },
  revenue:         { question: 'How much revenue did this generate?', description: 'Attributed revenue and ROAS across campaigns.' },
  cost_per_customer: { question: 'What did each customer cost us?', description: 'Average cost per acquisition vs prior period.' },
  lead_count:      { question: 'How many leads did we generate?', description: 'Total and qualified leads for the period.' },
  on_track:        { question: 'Are we on track for the month?', description: 'Progress toward monthly goal — leads or revenue.' },
  lead_growth:     { question: 'Are leads growing?', description: 'Lead volume trend vs the prior equivalent period.' },
  best_campaign:   { question: 'Which campaign is performing best?', description: 'Top campaign by ROAS.' },
  best_creative:   { question: 'Which creative is driving results?', description: 'Top-performing creative by conversion rate.' },
  wasted_budget:   { question: 'How much budget is being wasted?', description: 'Spend on non-converting placements.' },
  whats_testing:   { question: 'What are we testing right now?', description: 'Active A/B experiments and leading variants.' },
  work_done:       { question: 'What did the team do this week?', description: 'Actions executed on your account this week.' },
  cpa_target:      { question: 'Are we hitting target CPA?', description: 'Actual CPA vs your agreed target.' },
  tracking_health: { question: 'Is tracking working?', description: 'Conversion tracking verification status (last 48h).' },
};

interface Props {
  params: Promise<{ clientId: string; id: string }>;
}

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default async function QuestionDetailPage({ params }: Props) {
  const { clientId, id } = await params;
  const session = await auth();

  if (!session?.user?.client_id) redirect('/portal/login');
  if (session.user.client_id !== clientId) notFound();

  const meta = QUESTION_CATALOG[id];
  if (!meta) notFound();

  const answer = getAnswer(clientId, id);
  const auditEvents = getAuditEvents(clientId, 'answer', id);

  const canEdit = session.user.role === 'founder' || session.user.role === 'employee';

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <a
        href={`/portal/${clientId}`}
        className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block"
      >
        ← Back to overview
      </a>

      {/* Question header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{meta.question}</h1>
        <p className="text-sm text-gray-500 mt-1">{meta.description}</p>
      </div>

      {/* Current answer */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Answer</h2>
        {answer ? (
          <div>
            <p className="text-sm text-gray-800 leading-relaxed">{answer.content}</p>
            <p className="text-xs text-gray-400 mt-2">
              Last updated {formatTs(answer.updated_at)} by {answer.authored_by}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No answer recorded yet.</p>
        )}
      </div>

      {/* Answer composer — agency staff only */}
      {canEdit && (
        <div className="mb-8">
          <PortalAnswerComposer
            clientId={clientId}
            questionId={id}
            currentContent={answer?.content ?? ''}
          />
        </div>
      )}

      {/* Edit history (Phase 9.8 audit trail) */}
      {auditEvents.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Edit history</h2>
          <ul className="space-y-2">
            {auditEvents.map((event) => (
              <li key={event.id} className="text-xs text-gray-500 flex gap-2">
                <span className="text-gray-300">{formatTs(event.created_at)}</span>
                <span>{event.actor} {event.action === 'answer_updated' ? 'updated' : 'created'} this answer</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
