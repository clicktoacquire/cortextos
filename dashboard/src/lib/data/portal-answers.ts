import db from '@/lib/db';

export interface PortalAnswer {
  id: number;
  client_id: string;
  question_id: string;
  content: string;
  authored_by: string;
  created_at: string;
  updated_at: string;
}

export interface PortalAuditEvent {
  id: number;
  client_id: string;
  resource_type: string;
  resource_id: string;
  action: string;
  actor: string;
  actor_role: string;
  meta_json: string | null;
  created_at: string;
}

export function getAnswer(clientId: string, questionId: string): PortalAnswer | undefined {
  return db
    .prepare('SELECT * FROM portal_answers WHERE client_id = ? AND question_id = ?')
    .get(clientId, questionId) as PortalAnswer | undefined;
}

export function upsertAnswer(
  clientId: string,
  questionId: string,
  content: string,
  authoredBy: string,
): PortalAnswer {
  return db
    .prepare(
      `INSERT INTO portal_answers (client_id, question_id, content, authored_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(client_id, question_id) DO UPDATE SET
         content     = excluded.content,
         authored_by = excluded.authored_by,
         updated_at  = datetime('now')
       RETURNING *`,
    )
    .get(clientId, questionId, content, authoredBy) as PortalAnswer;
}

export function searchAnswers(
  clientId: string,
  query: string,
): PortalAnswer[] {
  const like = `%${query.replace(/[%_]/g, '\\$&')}%`;
  return db
    .prepare(
      `SELECT * FROM portal_answers
       WHERE client_id = ? AND content LIKE ? ESCAPE '\\'
       ORDER BY updated_at DESC
       LIMIT 20`,
    )
    .all(clientId, like) as PortalAnswer[];
}

export function logAuditEvent(event: {
  clientId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  actor: string;
  actorRole: string;
  meta?: Record<string, unknown>;
}): void {
  db.prepare(
    `INSERT INTO portal_audit_events
       (client_id, resource_type, resource_id, action, actor, actor_role, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    event.clientId,
    event.resourceType,
    event.resourceId,
    event.action,
    event.actor,
    event.actorRole,
    event.meta ? JSON.stringify(event.meta) : null,
  );
}

export function getAuditEvents(
  clientId: string,
  resourceType: string,
  resourceId: string,
): PortalAuditEvent[] {
  return db
    .prepare(
      `SELECT * FROM portal_audit_events
       WHERE client_id = ? AND resource_type = ? AND resource_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
    )
    .all(clientId, resourceType, resourceId) as PortalAuditEvent[];
}

export function getClientAuditTrail(clientId: string): PortalAuditEvent[] {
  return db
    .prepare(
      `SELECT * FROM portal_audit_events
       WHERE client_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
    )
    .all(clientId) as PortalAuditEvent[];
}
