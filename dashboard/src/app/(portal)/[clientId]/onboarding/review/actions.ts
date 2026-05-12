'use server';

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { logAuditEvent } from '@/lib/data/portal-answers';

const AGENCY_OS_ROOT = process.env.AGENCY_OS_ROOT
  ?? path.resolve(process.cwd(), '../agency-os');

function onboardingDocPath(clientId: string): string {
  return path.join(AGENCY_OS_ROOT, 'clients', clientId, 'onboarding-doc.json');
}

function onboardingStatePath(clientId: string): string {
  return path.join(AGENCY_OS_ROOT, 'clients', clientId, 'onboarding-state.json');
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

export async function approveOnboardingDoc(
  clientId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: 'Not authenticated' };
  const role = session.user.role;
  if (role !== 'founder' && role !== 'employee') {
    return { ok: false, error: 'Staff only' };
  }

  const docPath = onboardingDocPath(clientId);
  if (!fs.existsSync(docPath)) return { ok: false, error: 'Onboarding doc not found' };

  const doc = JSON.parse(fs.readFileSync(docPath, 'utf-8')) as Record<string, unknown>;
  doc.status = 'approved';
  doc.approved_at = new Date().toISOString();
  doc.approved_by = session.user.email ?? session.user.name ?? 'staff';
  writeJsonAtomic(docPath, doc);

  // Transition state machine: transcript_drafted → research_wave1
  const statePath = onboardingStatePath(clientId);
  if (fs.existsSync(statePath)) {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as {
      state: string;
      history: unknown[];
      entered_at: string;
    };
    if (state.state === 'intake') {
      const now = new Date().toISOString();
      state.history = [
        ...(state.history ?? []),
        { from: 'intake', to: 'research_wave1', transitioned_at: now, triggered_by: doc.approved_by, note: 'Portal review approved' },
      ];
      state.state = 'research_wave1';
      state.entered_at = now;
      writeJsonAtomic(statePath, state);
    }
  }

  logAuditEvent({
    clientId,
    resourceType: 'onboarding_doc',
    resourceId: 'review',
    action: 'approved',
    actor: String(doc.approved_by),
    actorRole: role,
  });

  revalidatePath(`/portal/${clientId}/onboarding/review`);
  return { ok: true };
}

export async function rejectOnboardingDoc(
  clientId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: 'Not authenticated' };
  const role = session.user.role;
  if (role !== 'founder' && role !== 'employee') {
    return { ok: false, error: 'Staff only' };
  }

  const docPath = onboardingDocPath(clientId);
  if (!fs.existsSync(docPath)) return { ok: false, error: 'Onboarding doc not found' };

  const doc = JSON.parse(fs.readFileSync(docPath, 'utf-8')) as Record<string, unknown>;
  const actor = session.user.email ?? session.user.name ?? 'staff';

  // Keep status as draft — add an amendment note
  const amendments = (doc.amendments as unknown[]) ?? [];
  amendments.push({
    amended_at: new Date().toISOString(),
    amended_by: actor,
    field_path: 'status',
    before: doc.status,
    after: 'rejected',
    note: reason,
  });
  doc.amendments = amendments;
  writeJsonAtomic(docPath, doc);

  logAuditEvent({
    clientId,
    resourceType: 'onboarding_doc',
    resourceId: 'review',
    action: 'rejected',
    actor,
    actorRole: role,
    meta: { reason },
  });

  revalidatePath(`/portal/${clientId}/onboarding/review`);
  return { ok: true };
}
