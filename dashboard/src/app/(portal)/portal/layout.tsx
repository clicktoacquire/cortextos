import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  const user = session.user as { name?: string; role?: string; client_id?: string | null };
  const clientId = user.client_id;

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-sm font-semibold text-zinc-200">Client Portal</span>
          <nav className="flex items-center gap-4">
            {clientId && (
              <>
                <Link href={`/portal/${clientId}/reports`} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                  Reports
                </Link>
                <Link href={`/portal/${clientId}/creatives`} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                  Creatives
                </Link>
                <Link href={`/portal/${clientId}/billing`} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                  Billing
                </Link>
              </>
            )}
            <span className="text-xs text-zinc-500">{user.name}</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
