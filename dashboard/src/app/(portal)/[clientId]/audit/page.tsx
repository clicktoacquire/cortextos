import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getClientAuditTrail } from '@/lib/data/portal-answers';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ clientId: string }>;
}

const ACTION_LABELS: Record<string, string> = {
  answer_updated: 'Updated answer',
  answer_created: 'Added answer',
};

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default async function PortalAuditPage({ params }: Props) {
  const { clientId } = await params;
  const session = await auth();

  if (!session?.user?.client_id) redirect('/portal/login');
  if (session.user.client_id !== clientId) notFound();

  // Audit trail is agency-staff-only view
  const isStaff = session.user.role === 'founder' || session.user.role === 'employee';
  if (!isStaff) notFound();

  const events = getClientAuditTrail(clientId);

  return (
    <div>
      <div className="mb-6">
        <a
          href={`/portal/${clientId}`}
          className="text-sm text-gray-400 hover:text-gray-600 mb-3 inline-block"
        >
          ← Back to overview
        </a>
        <h1 className="text-2xl font-bold text-gray-900">Audit trail</h1>
        <p className="text-sm text-gray-500 mt-1">All edits and changes for this account</p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-400">No audit events recorded yet.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">When</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Action</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Resource</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {formatTs(event.created_at)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-700">
                    {ACTION_LABELS[event.action] ?? event.action}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    {event.resource_type === 'answer' ? (
                      <a
                        href={`/portal/${clientId}/questions/${event.resource_id}`}
                        className="hover:underline text-blue-600"
                      >
                        {event.resource_id}
                      </a>
                    ) : (
                      <span>{event.resource_type}/{event.resource_id}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{event.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
