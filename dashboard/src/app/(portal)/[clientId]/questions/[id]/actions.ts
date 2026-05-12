'use server';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { upsertAnswer, logAuditEvent } from '@/lib/data/portal-answers';

export async function submitAnswer(
  clientId: string,
  questionId: string,
  content: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: 'Not authenticated' };

  const role = session.user.role;
  if (role !== 'founder' && role !== 'employee') {
    return { ok: false, error: 'Not authorized' };
  }

  const trimmed = content.trim();
  if (!trimmed) return { ok: false, error: 'Answer cannot be empty' };
  if (trimmed.length > 2000) return { ok: false, error: 'Answer must be 2000 characters or fewer' };

  const authoredBy = session.user.email ?? session.user.name ?? 'agency';

  upsertAnswer(clientId, questionId, trimmed, authoredBy);

  logAuditEvent({
    clientId,
    resourceType: 'answer',
    resourceId: questionId,
    action: 'answer_updated',
    actor: authoredBy,
    actorRole: role,
    meta: { length: trimmed.length },
  });

  revalidatePath(`/portal/${clientId}/questions/${questionId}`);
  return { ok: true };
}
