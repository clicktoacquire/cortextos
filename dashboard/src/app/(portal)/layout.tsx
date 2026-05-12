import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Client Portal — CortextOS',
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Only users with role=client may access the portal
  if (!session?.user) {
    redirect('/login?callbackUrl=/portal');
  }

  if (session.user.role !== 'client') {
    // Founder/employee trying to reach portal — redirect to dashboard
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="font-semibold text-gray-900">Client Portal</span>
          <span className="text-sm text-gray-500">{session.user.email}</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
