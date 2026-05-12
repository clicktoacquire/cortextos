import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { PortalQuestionCard } from '@/components/portal/PortalQuestionCard';
import {
  getClientSpend,
  getClientRevenue,
  getClientCpa,
  getClientLeads,
  getMonthPace,
  getWeeklyWork,
  getLeadGrowth,
  getBestCampaign,
  getWastedSpend,
  getBestCreative,
  getActiveTests,
  getTrackingHealth,
  getCpaVsTarget,
  PortalQuestionUnimplementedError,
} from '@/lib/portal-questions';

export const dynamic = 'force-dynamic';

interface PortalHomeProps {
  params: Promise<{ clientId: string }>;
}

// Default 30-day window
function defaultRange() {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  return { start, end };
}

type QuestionResult =
  | { id: string; question: string; answer: string; metrics: string[]; live: true }
  | { id: string; question: string; live: false; reason: string };

async function fetchQuestion(
  id: string,
  question: string,
  metrics: string[],
  fn: () => Promise<string>,
): Promise<QuestionResult> {
  try {
    const answer = await fn();
    return { id, question, answer, metrics, live: true };
  } catch (err) {
    if (err instanceof PortalQuestionUnimplementedError) {
      return { id, question, live: false, reason: (err as PortalQuestionUnimplementedError).dependency };
    }
    // BQ errors → degrade gracefully
    return { id, question, live: false, reason: 'Data unavailable — check back soon.' };
  }
}

function fmt(n: number, prefix = '$'): string {
  return `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function PortalHomePage({ params }: PortalHomeProps) {
  const { clientId } = await params;
  const session = await auth();

  if (!session?.user?.client_id) redirect('/portal/login');
  if (session.user.client_id !== clientId) notFound();

  const range = defaultRange();

  // Fetch top 5 questions in parallel
  const [spend, revenue, cpa, leads, pace] = await Promise.all([
    fetchQuestion('spend', 'How much did we spend?', ['Spend by platform', 'Daily spend'], async () => {
      const d = await getClientSpend(clientId, range);
      return `You spent ${fmt(d.spend_total)} between ${range.start} and ${range.end}.`;
    }),
    fetchQuestion('revenue', 'How much revenue did this generate?', ['Revenue by platform', 'ROAS'], async () => {
      const d = await getClientRevenue(clientId, range);
      return `Generated ${fmt(d.revenue_total)} in attributable revenue (${d.roas}x ROAS).`;
    }),
    fetchQuestion('cost_per_customer', 'What did each customer cost us?', ['CPA over time', 'CPA by campaign'], async () => {
      const d = await getClientCpa(clientId, range);
      const arrow = d.trend === 'up' ? '↑' : d.trend === 'down' ? '↓' : '→';
      return `Average CPA: ${fmt(d.avg_cpa)}. ${arrow} ${Math.abs(d.pct_change)}% vs prior period.`;
    }),
    fetchQuestion('lead_count', 'How many leads did we generate?', ['Daily lead chart', 'Leads by source'], async () => {
      const d = await getClientLeads(clientId, range);
      return `${d.lead_count.toLocaleString()} leads in the last 30 days (${d.qualified_count.toLocaleString()} qualified).`;
    }),
    fetchQuestion('on_track', 'Are we on track for the month?', ['Progress bar', 'Daily-pace chart'], async () => {
      const d = await getMonthPace(clientId);
      return `${d.pct_to_goal}% to your ${d.goal_type} goal of ${fmt(d.goal_value, d.goal_type === 'leads' ? '' : '$')}. ${d.days_remaining} days remaining.`;
    }),
  ]);

  const top5: QuestionResult[] = [spend, revenue, cpa, leads, pace];

  // Remaining 8 questions — fetch but show coming-soon for unimplemented
  const [leadGrowth, bestCampaign, bestCreative, wastedSpend, activeTests, weekWork, cpaTarget, trackHealth] = await Promise.all([
    fetchQuestion('lead_growth', 'Are leads growing?', ['14-day trend'], async () => {
      const d = await getLeadGrowth(clientId, range);
      return `Lead volume ${d.trend} ${Math.abs(d.pct_change)}% vs prior period.`;
    }),
    fetchQuestion('best_campaign', 'Which campaign is performing best?', ['Top 5 campaigns'], async () => {
      const d = await getBestCampaign(clientId, range);
      return `"${d.best_campaign_name}" leads with ${d.best_roas}x ROAS.`;
    }),
    fetchQuestion('best_creative', 'Which creative is driving results?', ['Top creatives'], async () => {
      const d = await getBestCreative(clientId, range);
      return `${d.best_creative_name} (${d.best_creative_format}) is your top performer.`;
    }),
    fetchQuestion('wasted_budget', 'How much budget is being wasted?', ['Wasted-spend breakdown'], async () => {
      const d = await getWastedSpend(clientId, range);
      return `${fmt(d.wasted_amount)} (${d.pct_of_total}% of total) on non-converting placements.`;
    }),
    fetchQuestion('whats_testing', 'What are we testing right now?', ['Active experiments'], async () => {
      const d = await getActiveTests(clientId);
      return `${d.active_test_count} active experiments. Leading variant: "${d.leading_variant}".`;
    }),
    fetchQuestion('work_done', 'What did the team do this week?', ['Action feed'], async () => {
      const d = await getWeeklyWork(clientId);
      return `We executed ${d.action_count} actions on your account this week.`;
    }),
    fetchQuestion('cpa_target', 'Are we hitting target CPA?', ['CPA vs target', 'Variance'], async () => {
      const d = await getCpaVsTarget(clientId, range);
      return `Target: ${fmt(d.target_cpa)}. Actual: ${fmt(d.actual_cpa)}. Status: ${d.status.replace('_', ' ')}.`;
    }),
    fetchQuestion('tracking_health', 'Is tracking working?', ['48h verify history'], async () => {
      const d = await getTrackingHealth(clientId);
      const emoji = d.tracking_status === 'healthy' ? '✅' : d.tracking_status === 'degraded' ? '⚠️' : '❌';
      return `${emoji} Tracking ${d.tracking_status}. Last verified ${new Date(d.last_verify_at).toLocaleDateString()}.`;
    }),
  ]);

  const remaining: QuestionResult[] = [leadGrowth, bestCampaign, bestCreative, wastedSpend, activeTests, weekWork, cpaTarget, trackHealth];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Your account overview</h1>
        <p className="text-sm text-gray-500">Last 30 days · {range.start} → {range.end}</p>
      </div>

      {/* Top 5 questions */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Key questions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {top5.map((q) => (
            <PortalQuestionCard key={q.id} result={q} />
          ))}
        </div>
      </section>

      {/* Remaining questions */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">More insights</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {remaining.map((q) => (
            <PortalQuestionCard key={q.id} result={q} />
          ))}
        </div>
      </section>
    </div>
  );
}
