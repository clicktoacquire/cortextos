import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getTasks } from '@/lib/data/tasks';
import { PortalActivityFeed } from '@/components/portal/PortalActivityFeed';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

interface Props {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function PortalActivityPage({ params, searchParams }: Props) {
  const { clientId } = await params;
  const { page: pageParam } = await searchParams;
  const session = await auth();

  if (!session?.user?.client_id) redirect('/portal/login');
  if (session.user.client_id !== clientId) notFound();

  const page = Math.max(1, parseInt(pageParam ?? '1', 10));

  // Filter tasks by project = clientId (bus tasks use project field for client scoping)
  const allTasks = getTasks({ project: clientId });
  const total = allTasks.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tasks = allTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="mb-6">
        <a
          href={`/portal/${clientId}`}
          className="text-sm text-gray-400 hover:text-gray-600 mb-3 inline-block"
        >
          ← Back to overview
        </a>
        <h1 className="text-2xl font-bold text-gray-900">Tasks executed</h1>
        <p className="text-sm text-gray-500 mt-1">
          {total.toLocaleString()} total task{total !== 1 ? 's' : ''} · page {page} of {totalPages}
        </p>
      </div>

      <PortalActivityFeed
        tasks={tasks}
        clientId={clientId}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
