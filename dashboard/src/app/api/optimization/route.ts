import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export const dynamic = 'force-dynamic';

let bqClient: BigQuery | null = null;

function getBQ(): BigQuery {
  if (bqClient) return bqClient;
  const keyPath = join(homedir(), '.cortextos', 'secrets', 'bigquery-key.json');
  const credentials = JSON.parse(readFileSync(keyPath, 'utf-8'));
  bqClient = new BigQuery({ projectId: 'click-to-acquire', credentials });
  return bqClient;
}

async function query<T>(sql: string): Promise<T[]> {
  const [rows] = await getBQ().query({ query: sql, location: 'US' });
  return rows as T[];
}

interface OptimizationRow {
  experiment_id: string;
  client_id: string;
  variant_id: string;
  kind: string;
  impact_size: string;
  action_mode: string;
  expected_lift_pct: number | null;
  probability_best_pct: number | null;
  status: string;
  recommended_action: string | null;
  reasoning: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/**
 * GET /api/optimization?days=7
 * Reads BQ aggregate: experiments + classification + last action.
 * Partition-filtered, LIMIT 100.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') ?? '7', 10);

  try {
    const rows = await query<OptimizationRow>(`
      SELECT
        recommendation_id AS experiment_id,
        client_id,
        subject_id AS variant_id,
        COALESCE(
          JSON_VALUE(payload, '$.context.variant_id'),
          subject_id
        ) AS kind,
        COALESCE(
          JSON_VALUE(payload, '$.impact_size'),
          'unknown'
        ) AS impact_size,
        CASE
          WHEN reviewed_by = 'system_auto' THEN 'auto'
          ELSE 'hitl'
        END AS action_mode,
        SAFE_CAST(JSON_VALUE(payload, '$.bayesian.expected_lift') AS FLOAT64) * 100 AS expected_lift_pct,
        SAFE_CAST(JSON_VALUE(payload, '$.bayesian.probability_best') AS FLOAT64) * 100 AS probability_best_pct,
        status,
        recommended_action,
        reasoning,
        created_at,
        reviewed_at,
        reviewed_by
      FROM \`click-to-acquire.analytics.hitl_recommendations\`
      WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const summary = {
      total: rows.length,
      pending: rows.filter((r) => r.status === 'pending').length,
      approved: rows.filter((r) => r.status === 'approved').length,
      rejected: rows.filter((r) => r.status === 'rejected').length,
      executed: rows.filter((r) => r.status === 'executed').length,
      auto_count: rows.filter((r) => r.action_mode === 'auto').length,
      hitl_count: rows.filter((r) => r.action_mode === 'hitl').length,
    };

    return NextResponse.json({ rows, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message, rows: [], summary: null }, { status: 500 });
  }
}
