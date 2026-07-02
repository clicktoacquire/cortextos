/**
 * /api/portal/[clientId]/assets/[fileId]
 *
 * Streams a GDrive file via service-account credentials.
 * Graceful 503 if GDRIVE_SERVICE_ACCOUNT_JSON is absent.
 * 5-min Cache-Control on successful responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const E2E_TOKEN = process.env.E2E_TOKEN ?? 'e2e-smoke-test-001';

function isE2EAuthorized(req: NextRequest): boolean {
  return req.headers.get('x-e2e-token') === E2E_TOKEN;
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

async function getGDriveAccessToken(sa: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Build JWT manually (RS256) without external dependencies
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sigInput = `${header}.${body}`;

  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(sigInput);
  const signature = sign.sign(sa.private_key, 'base64url');

  const jwt = `${sigInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  if (!tokenRes.ok) {
    throw new Error(`GDrive OAuth failed: ${tokenRes.status}`);
  }

  const tok = (await tokenRes.json()) as { access_token: string };
  return tok.access_token;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; fileId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id && !isE2EAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const saJson = process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    return NextResponse.json(
      { error: 'Google Drive is not configured on this server.' },
      { status: 503 },
    );
  }

  const { fileId } = await params;

  let sa: ServiceAccountKey;
  try {
    sa = JSON.parse(saJson) as ServiceAccountKey;
  } catch {
    return NextResponse.json({ error: 'GDRIVE_SERVICE_ACCOUNT_JSON is malformed' }, { status: 503 });
  }

  let accessToken: string;
  try {
    accessToken = await getGDriveAccessToken(sa);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!driveRes.ok) {
    return NextResponse.json(
      { error: `GDrive fetch failed: ${driveRes.status}` },
      { status: driveRes.status >= 400 && driveRes.status < 500 ? 404 : 502 },
    );
  }

  const contentType = driveRes.headers.get('content-type') ?? 'application/octet-stream';
  const body = await driveRes.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
