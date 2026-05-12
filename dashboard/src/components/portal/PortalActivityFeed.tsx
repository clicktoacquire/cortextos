'use client';

import type { Task } from '@/lib/types';

interface Props {
  tasks: Task[];
  clientId: string;
  page: number;
  totalPages: number;
}

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 border-green-100',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-100',
  pending: 'bg-gray-50 text-gray-600 border-gray-100',
  blocked: 'bg-amber-50 text-amber-700 border-amber-100',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function PortalActivityFeed({ tasks, clientId, page, totalPages }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
        <p className="text-sm text-gray-400">No tasks found for this account yet.</p>
      </div>
    );
  }

  return (
    <div>
      <ul className="space-y-3">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="rounded-lg border border-gray-200 bg-white px-5 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  {task.assignee && (
                    <span className="text-xs text-gray-400">{task.assignee}</span>
                  )}
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">{formatDate(task.created_at)}</span>
                  {task.completed_at && (
                    <>
                      <span className="text-xs text-gray-300">→</span>
                      <span className="text-xs text-gray-400">{formatDate(task.completed_at)}</span>
                    </>
                  )}
                </div>
              </div>
              <span
                className={`shrink-0 text-xs border rounded-full px-2 py-0.5 ${STATUS_BADGE[task.status] ?? STATUS_BADGE.pending}`}
              >
                {task.status.replace('_', ' ')}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <a
            href={page > 1 ? `/portal/${clientId}/activity?page=${page - 1}` : '#'}
            className={`text-sm px-3 py-1.5 rounded border ${
              page > 1
                ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                : 'border-gray-100 text-gray-300 pointer-events-none'
            }`}
          >
            ← Previous
          </a>
          <span className="text-xs text-gray-400">
            {page} / {totalPages}
          </span>
          <a
            href={page < totalPages ? `/portal/${clientId}/activity?page=${page + 1}` : '#'}
            className={`text-sm px-3 py-1.5 rounded border ${
              page < totalPages
                ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                : 'border-gray-100 text-gray-300 pointer-events-none'
            }`}
          >
            Next →
          </a>
        </div>
      )}
    </div>
  );
}
