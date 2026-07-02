import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await sql`
    SELECT id, username, email, role, client_id, created_at
    FROM users
    WHERE role = 'client'
    ORDER BY created_at DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { username, email, client_id } = body as { username?: string; email?: string; client_id?: string };

  if (!username || !client_id) {
    return NextResponse.json({ error: 'username and client_id required' }, { status: 400 });
  }

  const [existing] = await sql`SELECT id FROM users WHERE username = ${username}`;
  if (existing) {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
  }

  const tempPassword = crypto.randomBytes(16).toString('base64url');
  const hash = await bcrypt.hash(tempPassword, 12);

  await sql`
    INSERT INTO users (username, password_hash, email, role, client_id)
    VALUES (${username}, ${hash}, ${email ?? null}, 'client', ${client_id})
  `;

  return NextResponse.json({
    username,
    client_id,
    temp_password: tempPassword,
    message: 'Client user created. Share the temporary password — they should change it on first login.',
  }, { status: 201 });
}
