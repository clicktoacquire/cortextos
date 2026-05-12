import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { PortalSearch } from '@/components/portal/PortalSearch';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ clientId: string }>;
}

export default async function PortalSearchPage({ params }: Props) {
  const { clientId } = await params;
  const session = await auth();

  if (!session?.user?.client_id) redirect('/portal/login');
  if (session.user.client_id !== clientId) notFound();

  return (
    <div>
      <div className="mb-6">
        <a
          href={`/portal/${clientId}`}
          className="text-sm text-gray-400 hover:text-gray-600 mb-3 inline-block"
        >
          ← Back to overview
        </a>
        <h1 className="text-2xl font-bold text-gray-900">Search</h1>
        <p className="text-sm text-gray-500 mt-1">Search across questions and answers</p>
      </div>

      <PortalSearch clientId={clientId} />
    </div>
  );
}
