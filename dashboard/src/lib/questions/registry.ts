import type { QuestionId } from './types';

export interface QuestionDef {
  id: QuestionId;
  text: string;
  description: string;
  available: boolean;
  not_available_reason?: string;
}

export const QUESTIONS: readonly QuestionDef[] = [
  {
    id: 'spend',
    text: 'How much did we spend this period?',
    description: 'Total ad spend across Google + Meta for the requested window.',
    available: true,
  },
  {
    id: 'revenue',
    text: 'How many leads / sales did we generate?',
    description: 'Conversions and conversion_value across both platforms.',
    available: true,
  },
  {
    id: 'best_keywords',
    text: 'What are people searching to find us?',
    description: 'Top keywords by conversions / CPA. Requires keyword-level ingest.',
    available: false,
    not_available_reason: 'Keyword-entity rows are not yet ingested into daily_metrics. Wire google-ads keyword pull (planned data-lake PR).',
  },
  {
    id: 'best_ads',
    text: 'What are the best-performing ads?',
    description: 'Top ad-level entities by conversions and conversion_value.',
    available: true,
  },
  {
    id: 'best_audiences',
    text: 'Who is responding best to our ads?',
    description: 'Top Meta audience breakdowns. Requires audience-breakdown ingest.',
    available: false,
    not_available_reason: 'Audience breakdown not yet ingested. Add meta breakdown pull.',
  },
  {
    id: 'best_creatives',
    text: 'Which ad images and videos are performing best?',
    description: 'Requires creative tagging engine (Motion-style schema, planned).',
    available: false,
    not_available_reason: 'Tagging engine not yet shipped (Pillar 2). See research/tagging-engine.md.',
  },
  {
    id: 'trend_vs_prior',
    text: "What's the trend vs prior period?",
    description: 'Period-over-period delta on spend, conversions, conversion_value, CPA.',
    available: true,
  },
  {
    id: 'next_test',
    text: 'What is the system testing next, and why?',
    description: 'Pulled from optimization_proposals (self-opt loop, planned).',
    available: false,
    not_available_reason: 'Self-optimization decision loop not yet shipped. See dispatch plan.',
  },
  {
    id: 'best_lp_variant',
    text: 'How well is our website converting visitors?',
    description: 'Compares utm_content variants on lead/conversion rate. Requires LP form ingest.',
    available: false,
    not_available_reason: 'LP form ingestion not yet shipped (Pillar 8).',
  },
  {
    id: 'pacing',
    text: "What's my projected pacing to month-end?",
    description: 'Linear-projected month-end spend based on MTD daily average.',
    available: true,
  },
  {
    id: 'cost_per_lead',
    text: "What's my cost per lead?",
    description: 'Spend / conversions for the requested window. The efficiency bridge between spend and revenue.',
    available: true,
  },
  {
    id: 'recommendations',
    text: 'What should we change or try next?',
    description: 'Surfaces pending recommendations from the HITL queue. Gated on self-optimization loop.',
    available: false,
    not_available_reason: 'Self-optimization decision loop not yet shipping recommendations automatically.',
  },
  {
    id: 'goal_vs_actual',
    text: 'Am I on track to hit my targets?',
    description: 'Compares current metrics against client-set targets. Requires targets table per client.',
    available: false,
    not_available_reason: 'Client targets/goals table not yet created. Requires target-setting flow.',
  },
] as const;

export const QUESTION_BY_ID: Readonly<Record<QuestionId, QuestionDef>> =
  Object.freeze(
    Object.fromEntries(QUESTIONS.map((q) => [q.id, q])),
  ) as Readonly<Record<QuestionId, QuestionDef>>;

export function isQuestionId(value: string): value is QuestionId {
  return value in QUESTION_BY_ID;
}
