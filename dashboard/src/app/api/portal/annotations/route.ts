/**
 * POST /api/portal/annotations
 *
 * Writes a client annotation on a creative to BQ creative_annotations table.
 * Table: cta_platform.creative_annotations (partitioned on created_at)
 *
 * Body: { creative_id, client_id, comment, region_box?, status? }
 * Returns: { annotation_id, creative_id, client_id, status: 'pending' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { auth } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const PROJECT = process.env.GCLOUD_PROJECT ?? 'click-to-acquire';
const E2E_TOKEN = process.env.E2E_TOKEN ?? 'e2e-smoke-test-001';

function getBQ() {
  return new BigQuery({ projectId: PROJECT });
}

function isE2EAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-e2e-token') === E2E_TOKEN;
}

interface RegionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id && !isE2EAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const creativeId = typeof body['creative_id'] === 'string' ? body['creative_id'] : null;
  const clientId = typeof body['client_id'] === 'string' ? body['client_id'] : null;
  const comment = typeof body['comment'] === 'string' ? body['comment'].trim() : null;
  const regionBox =
    body['region_box'] && typeof body['region_box'] === 'object'
      ? JSON.stringify(body['region_box'] as RegionBox)
      : null;
  const status = typeof body['status'] === 'string' ? body['status'] : 'pending';

  if (!creativeId || !clientId || !comment) {
    return NextResponse.json(
      { error: 'creative_id, client_id, and comment are required' },
      { status: 400 },
    );
  }

  const annotationId = randomUUID();
  const createdBy = session?.user?.id ?? 'e2e';
  const now = new Date().toISOString();

  try {
    const bq = getBQ();
    await bq.dataset('cta_platform').table('creative_annotations').insert([
      {
        annotation_id: annotationId,
        creative_id: creativeId,
        client_id: clientId,
        region_box: regionBox,
        comment,
        status,
        created_at: now,
        created_by: createdBy,
      },
    ]);

    // Fire-and-forget digest event so Mozart picks it up
    bq.dataset('cta_platform')
      .table('platform_events')
      .insert([
        {
          event_id: randomUUID(),
          event_type: 'creative_annotation_added',
          client_id: clientId,
          meta: JSON.stringify({ annotation_id: annotationId, creative_id: creativeId }),
          created_at: now,
        },
      ])
      .catch(() => {});

    return NextResponse.json(
      { annotation_id: annotationId, creative_id: creativeId, client_id: clientId, status },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'BQ insert failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id && !isE2EAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const creativeId = searchParams.get('creative_id');

  if (!clientId || !creativeId) {
    return NextResponse.json(
      { error: 'client_id and creative_id are required' },
      { status: 400 },
    );
  }

  try {
    const bq = getBQ();
    const query = `
      SELECT
        annotation_id,
        creative_id,
        client_id,
        region_box,
        comment,
        status,
        FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', created_at) AS created_at,
        created_by
      FROM \`${PROJECT}.cta_platform.creative_annotations\`
      WHERE client_id = @clientId
        AND creative_id = @creativeId
        AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
      ORDER BY created_at DESC
      LIMIT 100
    `;
    const [rows] = await bq.query({ query, location: 'US', params: { clientId, creativeId } });
    return NextResponse.json({ client_id: clientId, creative_id: creativeId, annotations: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
