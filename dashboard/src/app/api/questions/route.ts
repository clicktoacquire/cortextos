import { NextRequest } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { fetchFacts } from '@/lib/questions/bq';
import { synthesize } from '@/lib/questions/synth';
import {
  QUESTIONS,
  QUESTION_BY_ID,
  isQuestionId,
} from '@/lib/questions/registry';
import type {
  Period,
  QuestionAnswer,
  QuestionId,
} from '@/lib/questions/types';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Free-form path (existing behavior — kept for backwards compat).
// Body: { question: string, client_id: UUID }
// ---------------------------------------------------------------------------

const BQ_KEY_PATH =
  process.env.BQ_KEY_PATH ?? `${process.env.HOME}/.cortextos/secrets/bigquery-key.json`;
const BQ_PROJECT = 'click-to-acquire';
const BQ_DATASET = 'analytics';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DailyRow {
  metric_date: { value: string };
  platform: string;
  total_spend: number;
  total_conversions: number;
  total_clicks: number;
  total_impressions: number;
}

async function queryMetrics(clientId: string, days: number): Promise<DailyRow[]> {
  const bq = new BigQuery({ projectId: BQ_PROJECT, keyFilename: BQ_KEY_PATH });

  const query = `
    SELECT
      metric_date,
      platform,
      SUM(spend) AS total_spend,
      SUM(conversions) AS total_conversions,
      SUM(clicks) AS total_clicks,
      SUM(impressions) AS total_impressions
    FROM \`${BQ_PROJECT}.${BQ_DATASET}.daily_metrics\`
    WHERE client_id = @clientId
      AND metric_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
    GROUP BY metric_date, platform
    ORDER BY metric_date DESC
    LIMIT 100
  `;

  const [rows] = await bq.query({
    query,
    params: { clientId, days },
    location: 'US',
  });

  return rows as DailyRow[];
}

function buildContext(rows: DailyRow[]): {
  summary: string;
  metrics: Record<string, unknown>;
} {
  const byPlatform: Record<
    string,
    { spend: number; conversions: number; clicks: number; impressions: number; days: number }
  > = {};

  for (const row of rows) {
    const p = row.platform ?? 'unknown';
    if (!byPlatform[p])
      byPlatform[p] = { spend: 0, conversions: 0, clicks: 0, impressions: 0, days: 0 };
    byPlatform[p].spend += Number(row.total_spend ?? 0);
    byPlatform[p].conversions += Number(row.total_conversions ?? 0);
    byPlatform[p].clicks += Number(row.total_clicks ?? 0);
    byPlatform[p].impressions += Number(row.total_impressions ?? 0);
    byPlatform[p].days += 1;
  }

  const lines: string[] = [];
  for (const [platform, data] of Object.entries(byPlatform)) {
    const cpl = data.conversions > 0 ? (data.spend / data.conversions).toFixed(2) : 'N/A';
    const cpc = data.clicks > 0 ? (data.spend / data.clicks).toFixed(2) : 'N/A';
    const ctr =
      data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) : 'N/A';
    lines.push(
      `${platform}: $${data.spend.toFixed(2)} spend, ${data.conversions.toFixed(1)} conversions, ${data.clicks} clicks, ${data.impressions} impressions over ${data.days} platform-days. CPL: $${cpl}, CPC: $${cpc}, CTR: ${ctr}%`,
    );
  }

  return { summary: lines.join('\n'), metrics: byPlatform };
}

const FREEFORM_SYSTEM_PROMPT = `You are a marketing performance analyst for a Google/Meta ads agency. Answer the client's question in plain English using the specific numbers provided. Be direct, mention exact dollar amounts and percentages. Max 200 words. No jargon — if you use an acronym, define it once. If the data doesn't cover the question, say so honestly.`;

async function answerFreeform(question: string, client_id: string): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'OPENROUTER_API_KEY or ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const rows = await queryMetrics(client_id, 30);

  if (rows.length === 0) {
    return Response.json({
      answer: 'No performance data found for this client in the last 30 days.',
      supporting_metrics: {},
      asked_at: new Date().toISOString(),
    });
  }

  const { summary, metrics } = buildContext(rows);

  const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
  const baseUrl = useOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.anthropic.com/v1';

  const llmRes = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(useOpenRouter ? { 'HTTP-Referer': 'https://dashboard.clicktoacquire.com' } : {}),
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4.6',
      max_tokens: 512,
      messages: [
        { role: 'system', content: FREEFORM_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Here is the client's ad performance data for the last 30 days:\n\n${summary}\n\nClient question: ${question.trim()}`,
        },
      ],
    }),
  });

  if (!llmRes.ok) {
    const errBody = await llmRes.text();
    throw new Error(`LLM API ${llmRes.status}: ${errBody.slice(0, 200)}`);
  }

  const completion = await llmRes.json();
  const answer: string = completion.choices?.[0]?.message?.content ?? 'No answer generated.';

  return Response.json({
    answer,
    supporting_metrics: metrics,
    asked_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Registry path (new): the 10 confirmed questions, each backed by a typed
// fact bundle from BigQuery and a cached system prompt for NL synthesis.
// ---------------------------------------------------------------------------

const VALID_PERIODS: readonly Period[] = ['7d', '14d', '30d', 'mtd'] as const;
const VALID_CLIENT_ID = /^[a-z0-9_-]{1,64}$/i;

interface ValidatedQuery {
  client_id: string;
  question_id: QuestionId;
  period: Period;
}

function validate(input: {
  client_id: string | null;
  question_id: string | null;
  period: Period;
}): ValidatedQuery | { error: string } {
  if (!input.client_id || !VALID_CLIENT_ID.test(input.client_id)) {
    return { error: 'Missing or invalid client_id' };
  }
  if (!input.question_id || !isQuestionId(input.question_id)) {
    return {
      error: `Unknown question_id. Valid: ${QUESTIONS.map((q) => q.id).join(', ')}`,
    };
  }
  if (!VALID_PERIODS.includes(input.period)) {
    return { error: `period must be one of ${VALID_PERIODS.join(', ')}` };
  }
  return {
    client_id: input.client_id,
    question_id: input.question_id,
    period: input.period,
  };
}

async function answerRegistry(q: ValidatedQuery): Promise<QuestionAnswer> {
  const bundle = await fetchFacts(q.question_id, q.client_id, q.period);
  const synth = await synthesize(bundle);
  return {
    question_id: q.question_id,
    question_text: QUESTION_BY_ID[q.question_id].text,
    client_id: q.client_id,
    period: q.period,
    answer: synth.answer,
    facts: bundle,
    model: synth.model,
    cache: synth.cache,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/questions                                                 — list the registry
 * GET /api/questions?client_id=X&question_id=spend&period=7d         — single answer
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const client_id = searchParams.get('client_id');
  const question_id = searchParams.get('question_id');
  const period = (searchParams.get('period') ?? '7d') as Period;

  if (!client_id && !question_id) {
    return Response.json({
      questions: QUESTIONS.map((q) => ({
        id: q.id,
        text: q.text,
        available: q.available,
        not_available_reason: q.not_available_reason,
      })),
    });
  }

  const validation = validate({ client_id, question_id, period });
  if ('error' in validation) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  try {
    const answer = await answerRegistry(validation);
    return Response.json(answer);
  } catch (err) {
    console.error('[api/questions] GET error:', err);
    return Response.json(
      { error: 'Failed to answer question', detail: errorMessage(err) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/questions
 *   Free-form: { question: string, client_id: UUID }
 *   Registry:  { client_id: slug-or-UUID, question_ids: QuestionId[], period?: Period }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (typeof body?.question === 'string' && body.question.trim().length > 0) {
      const { question, client_id } = body;
      if (!client_id || typeof client_id !== 'string' || !UUID_RE.test(client_id)) {
        return Response.json({ error: 'client_id must be a valid UUID' }, { status: 400 });
      }
      return await answerFreeform(question, client_id);
    }

    if (Array.isArray(body?.question_ids)) {
      const { client_id, question_ids } = body;
      const period = (body.period ?? '7d') as Period;

      if (!client_id || typeof client_id !== 'string' || !VALID_CLIENT_ID.test(client_id)) {
        return Response.json({ error: 'Missing or invalid client_id' }, { status: 400 });
      }
      if (question_ids.length === 0) {
        return Response.json(
          { error: 'question_ids must be a non-empty array' },
          { status: 400 },
        );
      }
      if (!VALID_PERIODS.includes(period)) {
        return Response.json(
          { error: `period must be one of ${VALID_PERIODS.join(', ')}` },
          { status: 400 },
        );
      }

      const ids = question_ids.filter(isQuestionId) as QuestionId[];
      if (ids.length === 0) {
        return Response.json(
          { error: 'No valid question_ids supplied' },
          { status: 400 },
        );
      }

      const answers = await Promise.all(
        ids.map((qid) =>
          answerRegistry({ client_id, question_id: qid, period }).catch((err) => ({
            question_id: qid,
            error: errorMessage(err),
          })),
        ),
      );
      return Response.json({ answers });
    }

    if (typeof body?.question === 'string' && body.question.trim().length === 0) {
      return Response.json({ error: 'question is required' }, { status: 400 });
    }

    return Response.json({ error: 'question is required' }, { status: 400 });
  } catch (err) {
    console.error('[api/questions] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
