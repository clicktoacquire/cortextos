import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listClients } from '@/lib/bq-clients';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const clients = await listClients();
    return NextResponse.json(clients);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch clients';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
