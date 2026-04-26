import { NextRequest } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

export const dynamic = 'force-dynamic';

const BQ_KEY_PATH =
  process.env.BQ_KEY_PATH ?? `${process.env.HOME}/.cortextos/secrets/bigquery-key.json`;
const BQ_PROJECT = 'click-to-acquire';
const BQ_DATASET = 'analytics';
const TABLE = 'recommendations';

function getBQ() {
  return new BigQuery({ projectId: BQ_PROJECT, keyFilename: BQ_KEY_PATH });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'pending_review';
  const clientId = searchParams.get('client_id');
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200);

  const validStatuses = ['pending_review', 'approved', 'skipped', 'snoozed', 'executed'];
  if (!validStatuses.includes(status)) {
    return Response.json(
      { error: `status must be one of ${validStatuses.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const bq = getBQ();
    const conditions = ['status = @status'];
    const params: Record<string, string | number> = { status, limit };

    if (clientId) {
      conditions.push('client_id = @clientId');
      params.clientId = clientId;
    }

    const query = `
      SELECT
        rec_id,
        client_id,
        campaign_id,
        platform,
        anomaly_type,
        recommendation,
        rationale,
        status,
        generated_at,
        approved_at,
        action_type
      FROM \`${BQ_PROJECT}.${BQ_DATASET}.${TABLE}\`
      WHERE ${conditions.join(' AND ')}
      ORDER BY generated_at DESC
      LIMIT @limit
    `;

    const [rows] = await bq.query({ query, params, location: 'US' });
    return Response.json({ recommendations: rows, count: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Not found: Table')) {
      return Response.json({ recommendations: [], count: 0, table_missing: true });
    }
    console.error('[api/recommendations] GET error:', err);
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { rec_id, action, skip_reason } = body;

    if (!rec_id || typeof rec_id !== 'string') {
      return Response.json({ error: 'rec_id required' }, { status: 400 });
    }

    const validActions = ['approve', 'skip', 'snooze_1h', 'snooze_4h', 'snooze_24h', 'snooze_skip_cycle'];
    if (!action || !validActions.includes(action)) {
      return Response.json(
        { error: `action must be one of ${validActions.join(', ')}` },
        { status: 400 },
      );
    }

    const bq = getBQ();
    let query: string;
    let params: Record<string, string | number>;

    if (action === 'approve') {
      query = `
        UPDATE \`${BQ_PROJECT}.${BQ_DATASET}.${TABLE}\`
        SET status = 'approved', approved_at = CURRENT_TIMESTAMP()
        WHERE rec_id = @id AND status = 'pending_review'
      `;
      params = { id: rec_id };
    } else if (action === 'skip') {
      query = `
        UPDATE \`${BQ_PROJECT}.${BQ_DATASET}.${TABLE}\`
        SET status = 'skipped', execution_log = @reason, approved_at = CURRENT_TIMESTAMP()
        WHERE rec_id = @id AND status = 'pending_review'
      `;
      params = { id: rec_id, reason: skip_reason ?? '' };
    } else {
      const hours: Record<string, number> = {
        snooze_1h: 1,
        snooze_4h: 4,
        snooze_24h: 24,
        snooze_skip_cycle: 168,
      };
      const h = hours[action];
      query = `
        UPDATE \`${BQ_PROJECT}.${BQ_DATASET}.${TABLE}\`
        SET status = 'snoozed',
            execution_log = CONCAT('snoozed_until:', CAST(TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL @hours HOUR) AS STRING))
        WHERE rec_id = @id AND status = 'pending_review'
      `;
      params = { id: rec_id, hours: h };
    }

    await bq.query({ query, params, location: 'US' });

    const messages: Record<string, string> = {
      approve: 'Approved — googli will execute this recommendation.',
      skip: 'Skipped.',
      snooze_1h: 'Snoozed — will resurface in 1 hour.',
      snooze_4h: 'Snoozed — will resurface in 4 hours.',
      snooze_24h: 'Snoozed — will resurface tomorrow.',
      snooze_skip_cycle: 'Snoozed — skipping this optimization cycle.',
    };

    return Response.json({
      ok: true,
      rec_id,
      action,
      message: messages[action] ?? 'Done.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/recommendations] PATCH error:', err);
    return Response.json({ error: message }, { status: 500 });
  }
}
