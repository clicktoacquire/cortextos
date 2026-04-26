import { NextRequest } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const BQ_KEY_PATH = process.env.BQ_KEY_PATH ?? `${process.env.HOME}/.cortextos/secrets/bigquery-key.json`;
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

function buildContext(rows: DailyRow[]): { summary: string; metrics: Record<string, unknown> } {
  const byPlatform: Record<string, { spend: number; conversions: number; clicks: number; impressions: number; days: number }> = {};

  for (const row of rows) {
    const p = row.platform ?? 'unknown';
    if (!byPlatform[p]) byPlatform[p] = { spend: 0, conversions: 0, clicks: 0, impressions: 0, days: 0 };
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
    const ctr = data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) : 'N/A';
    lines.push(
      `${platform}: $${data.spend.toFixed(2)} spend, ${data.conversions.toFixed(1)} conversions, ${data.clicks} clicks, ${data.impressions} impressions over ${data.days} platform-days. CPL: $${cpl}, CPC: $${cpc}, CTR: ${ctr}%`
    );
  }

  return {
    summary: lines.join('\n'),
    metrics: byPlatform,
  };
}

const SYSTEM_PROMPT = `You are a marketing performance analyst for a Google/Meta ads agency. Answer the client's question in plain English using the specific numbers provided. Be direct, mention exact dollar amounts and percentages. Max 200 words. No jargon — if you use an acronym, define it once. If the data doesn't cover the question, say so honestly.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, client_id } = body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return Response.json({ error: 'question is required' }, { status: 400 });
    }
    if (!client_id || typeof client_id !== 'string' || !UUID_RE.test(client_id)) {
      return Response.json({ error: 'client_id must be a valid UUID' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
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

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is the client's ad performance data for the last 30 days:\n\n${summary}\n\nClient question: ${question.trim()}`,
        },
      ],
    });

    const answer = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return Response.json({
      answer,
      supporting_metrics: metrics,
      asked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[api/questions] error:', err);
    const msg = err instanceof Error ? err.message : 'Internal error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
