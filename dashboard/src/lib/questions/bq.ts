import { BigQuery } from '@google-cloud/bigquery';
import type { FactBundle, Period, QuestionId } from './types';
import { QUESTION_BY_ID } from './registry';

const PROJECT_ID = process.env.BQ_PROJECT_ID ?? 'click-to-acquire';
const DATASET = process.env.BQ_DATASET ?? 'analytics';
const TABLE = process.env.BQ_DAILY_METRICS_TABLE ?? 'daily_metrics';

let _client: BigQuery | null = null;
function bq(): BigQuery {
  if (!_client) _client = new BigQuery({ projectId: PROJECT_ID });
  return _client;
}

const PERIOD_DAYS: Record<Period, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  mtd: 0,
};

interface PeriodBounds {
  start: string;
  end: string;
  days: number;
}

export function periodBounds(period: Period, today = new Date()): PeriodBounds {
  const end = today.toISOString().slice(0, 10);
  if (period === 'mtd') {
    const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const start = startDate.toISOString().slice(0, 10);
    const days =
      Math.floor((today.getTime() - startDate.getTime()) / 86_400_000) + 1;
    return { start, end, days };
  }
  const days = PERIOD_DAYS[period];
  const startDate = new Date(today.getTime() - (days - 1) * 86_400_000);
  return { start: startDate.toISOString().slice(0, 10), end, days };
}

function priorBounds(b: PeriodBounds): PeriodBounds {
  const startDate = new Date(`${b.start}T00:00:00Z`);
  const priorEnd = new Date(startDate.getTime() - 86_400_000);
  const priorStart = new Date(priorEnd.getTime() - (b.days - 1) * 86_400_000);
  return {
    start: priorStart.toISOString().slice(0, 10),
    end: priorEnd.toISOString().slice(0, 10),
    days: b.days,
  };
}

const tableRef = `\`${PROJECT_ID}.${DATASET}.${TABLE}\``;

async function runQuery<T = Record<string, unknown>>(
  sql: string,
  params: Record<string, unknown>,
): Promise<T[]> {
  const [rows] = await bq().query({ query: sql, params, location: 'US' });
  return rows as T[];
}

export async function fetchFacts(
  question_id: QuestionId,
  client_id: string,
  period: Period,
): Promise<FactBundle> {
  const def = QUESTION_BY_ID[question_id];
  const bounds = periodBounds(period);
  const base: FactBundle = {
    question_id,
    period,
    client_id,
    generated_at: new Date().toISOString(),
    available: def.available,
  };

  if (!def.available) {
    return { ...base, not_available_reason: def.not_available_reason };
  }

  switch (question_id) {
    case 'spend':
      return { ...base, facts: await spendFacts(client_id, bounds) };
    case 'revenue':
      return { ...base, facts: await revenueFacts(client_id, bounds) };
    case 'best_ads':
      return { ...base, rows: await bestAdsRows(client_id, bounds) };
    case 'trend_vs_prior':
      return { ...base, facts: await trendFacts(client_id, bounds) };
    case 'pacing':
      return { ...base, facts: await pacingFacts(client_id) };
    case 'cost_per_lead':
      return { ...base, facts: await costPerLeadFacts(client_id, bounds) };
    default:
      return { ...base, available: false, not_available_reason: 'No handler.' };
  }
}

async function spendFacts(
  client_id: string,
  b: PeriodBounds,
): Promise<Record<string, unknown>> {
  const sql = `
    SELECT platform, ROUND(SUM(spend), 2) AS spend
    FROM ${tableRef}
    WHERE client_id = @client_id
      AND metric_date BETWEEN @start AND @end
      AND entity_type = 'campaign'
    GROUP BY platform
    ORDER BY spend DESC
    LIMIT 100
  `;
  const rows = await runQuery<{ platform: string; spend: number }>(sql, {
    client_id,
    start: b.start,
    end: b.end,
  });
  const total = rows.reduce((sum, r) => sum + Number(r.spend ?? 0), 0);
  return {
    period_start: b.start,
    period_end: b.end,
    days: b.days,
    total_spend: round(total),
    by_platform: rows,
  };
}

async function revenueFacts(
  client_id: string,
  b: PeriodBounds,
): Promise<Record<string, unknown>> {
  const sql = `
    SELECT
      platform,
      ROUND(SUM(spend), 2) AS spend,
      ROUND(SUM(conversions), 2) AS conversions,
      ROUND(SUM(conversion_value), 2) AS conversion_value
    FROM ${tableRef}
    WHERE client_id = @client_id
      AND metric_date BETWEEN @start AND @end
      AND entity_type = 'campaign'
    GROUP BY platform
    ORDER BY conversion_value DESC
    LIMIT 100
  `;
  const rows = await runQuery<{
    platform: string;
    spend: number;
    conversions: number;
    conversion_value: number;
  }>(sql, { client_id, start: b.start, end: b.end });
  const totals = rows.reduce(
    (acc, r) => ({
      spend: acc.spend + Number(r.spend ?? 0),
      conversions: acc.conversions + Number(r.conversions ?? 0),
      conversion_value: acc.conversion_value + Number(r.conversion_value ?? 0),
    }),
    { spend: 0, conversions: 0, conversion_value: 0 },
  );
  return {
    period_start: b.start,
    period_end: b.end,
    days: b.days,
    totals: {
      spend: round(totals.spend),
      conversions: round(totals.conversions),
      conversion_value: round(totals.conversion_value),
      roas: totals.spend > 0 ? round(totals.conversion_value / totals.spend) : null,
      cpa: totals.conversions > 0 ? round(totals.spend / totals.conversions) : null,
    },
    by_platform: rows,
  };
}

async function bestAdsRows(
  client_id: string,
  b: PeriodBounds,
): Promise<Array<Record<string, unknown>>> {
  const sql = `
    SELECT
      platform,
      entity_id,
      campaign_id,
      ROUND(SUM(spend), 2) AS spend,
      ROUND(SUM(conversions), 2) AS conversions,
      ROUND(SUM(conversion_value), 2) AS conversion_value,
      SAFE_DIVIDE(SUM(spend), SUM(conversions)) AS cpa
    FROM ${tableRef}
    WHERE client_id = @client_id
      AND metric_date BETWEEN @start AND @end
      AND entity_type = 'ad'
      AND spend > 0
    GROUP BY platform, entity_id, campaign_id
    HAVING conversions > 0
    ORDER BY conversion_value DESC
    LIMIT 10
  `;
  const rows = await runQuery<Record<string, unknown>>(sql, {
    client_id,
    start: b.start,
    end: b.end,
  });
  return rows;
}

async function trendFacts(
  client_id: string,
  b: PeriodBounds,
): Promise<Record<string, unknown>> {
  const prior = priorBounds(b);
  const sql = `
    WITH cur AS (
      SELECT 'current' AS bucket,
        ROUND(SUM(spend), 2) AS spend,
        ROUND(SUM(conversions), 2) AS conversions,
        ROUND(SUM(conversion_value), 2) AS conversion_value
      FROM ${tableRef}
      WHERE client_id = @client_id
        AND metric_date BETWEEN @start AND @end
        AND entity_type = 'campaign'
    ),
    prv AS (
      SELECT 'prior' AS bucket,
        ROUND(SUM(spend), 2) AS spend,
        ROUND(SUM(conversions), 2) AS conversions,
        ROUND(SUM(conversion_value), 2) AS conversion_value
      FROM ${tableRef}
      WHERE client_id = @client_id
        AND metric_date BETWEEN @prior_start AND @prior_end
        AND entity_type = 'campaign'
    )
    SELECT * FROM cur UNION ALL SELECT * FROM prv
    LIMIT 100
  `;
  const rows = await runQuery<{
    bucket: string;
    spend: number;
    conversions: number;
    conversion_value: number;
  }>(sql, {
    client_id,
    start: b.start,
    end: b.end,
    prior_start: prior.start,
    prior_end: prior.end,
  });
  const cur = rows.find((r) => r.bucket === 'current') ?? {
    spend: 0,
    conversions: 0,
    conversion_value: 0,
  };
  const prv = rows.find((r) => r.bucket === 'prior') ?? {
    spend: 0,
    conversions: 0,
    conversion_value: 0,
  };
  return {
    current: { start: b.start, end: b.end, ...cur },
    prior: { start: prior.start, end: prior.end, ...prv },
    deltas: {
      spend_pct: pctDelta(cur.spend, prv.spend),
      conversions_pct: pctDelta(cur.conversions, prv.conversions),
      conversion_value_pct: pctDelta(cur.conversion_value, prv.conversion_value),
    },
  };
}

async function pacingFacts(client_id: string): Promise<Record<string, unknown>> {
  const today = new Date();
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  const nextMonth = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1),
  );
  const daysInMonth = Math.round(
    (nextMonth.getTime() - monthStart.getTime()) / 86_400_000,
  );
  const daysElapsed = Math.floor(
    (today.getTime() - monthStart.getTime()) / 86_400_000,
  ) + 1;
  const sql = `
    SELECT ROUND(SUM(spend), 2) AS mtd_spend
    FROM ${tableRef}
    WHERE client_id = @client_id
      AND metric_date BETWEEN @start AND @end
      AND entity_type = 'campaign'
  `;
  const [row] = await runQuery<{ mtd_spend: number | null }>(sql, {
    client_id,
    start: monthStart.toISOString().slice(0, 10),
    end: today.toISOString().slice(0, 10),
  });
  const mtd = Number(row?.mtd_spend ?? 0);
  const projected = (mtd / daysElapsed) * daysInMonth;
  return {
    month_start: monthStart.toISOString().slice(0, 10),
    days_elapsed: daysElapsed,
    days_in_month: daysInMonth,
    mtd_spend: round(mtd),
    daily_avg: round(mtd / daysElapsed),
    projected_month_end: round(projected),
  };
}

async function costPerLeadFacts(
  client_id: string,
  b: PeriodBounds,
): Promise<Record<string, unknown>> {
  const sql = `
    SELECT
      platform,
      ROUND(SUM(spend), 2) AS spend,
      ROUND(SUM(conversions), 2) AS conversions,
      SAFE_DIVIDE(SUM(spend), SUM(conversions)) AS cpl
    FROM ${tableRef}
    WHERE client_id = @client_id
      AND metric_date BETWEEN @start AND @end
      AND entity_type = 'campaign'
    GROUP BY platform
    ORDER BY spend DESC
    LIMIT 100
  `;
  const rows = await runQuery<{
    platform: string;
    spend: number;
    conversions: number;
    cpl: number | null;
  }>(sql, { client_id, start: b.start, end: b.end });
  const totalSpend = rows.reduce((s, r) => s + Number(r.spend ?? 0), 0);
  const totalConversions = rows.reduce((s, r) => s + Number(r.conversions ?? 0), 0);
  return {
    period_start: b.start,
    period_end: b.end,
    days: b.days,
    total_spend: round(totalSpend),
    total_conversions: round(totalConversions),
    cost_per_lead: totalConversions > 0 ? round(totalSpend / totalConversions) : null,
    by_platform: rows,
  };
}

function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function pctDelta(cur: number, prior: number): number | null {
  if (!prior) return null;
  return round(((cur - prior) / prior) * 100);
}
