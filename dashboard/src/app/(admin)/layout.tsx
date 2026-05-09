import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { defineAbilitiesFor } from '@/lib/abilities';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { HelpChat } from '@/components/HelpChat';
import { getOrgs } from '@/lib/config';
import type { User } from '@/lib/types';

/**
 * Admin route group layout — session guard + founder-only gate.
 *
 * All routes under (admin)/ require an authenticated founder session.
 * Employee role is read-only on most things but cannot access admin pages.
 * Extend the ability check here as the employee role scope evolves (Task 2.2+).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(session.user.id) as User | undefined;

  if (!user) redirect('/login');

  const ability = defineAbilitiesFor({ id: user.id, role: user.role });

  // Admin section requires founder for now — employees get read-only when Task 2.2 ships
  if (!ability.can('manage', 'AgencySettings')) {
    redirect('/unauthorized');
  }

  const orgs = getOrgs();

  return (
    <DashboardShell orgs={orgs}>
      {children}
      <HelpChat />
    </DashboardShell>
  );
}
