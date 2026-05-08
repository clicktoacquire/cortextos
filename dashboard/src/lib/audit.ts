import { db } from '@/lib/db';

export interface AuditParams {
  userId: number;
  username: string;
  action: string;
  subjectType: string;
  subjectId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export interface AuditRow {
  id: number;
  user_id: number;
  username: string;
  action: string;
  subject_type: string;
  subject_id: string | null;
  metadata_json: string | null;
  ip: string | null;
  ts: string;
}

const insertAudit = db.prepare<[number, string, string, string, string | null, string | null, string | null]>(`
  INSERT INTO audit_log (user_id, username, action, subject_type, subject_id, metadata_json, ip)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export function audit(params: AuditParams): void {
  insertAudit.run(
    params.userId,
    params.username,
    params.action,
    params.subjectType,
    params.subjectId ?? null,
    params.metadata ? JSON.stringify(params.metadata) : null,
    params.ip ?? null,
  );
}

export function getRecentAuditLog(limit = 50): AuditRow[] {
  return db
    .prepare<[], AuditRow>(`SELECT * FROM audit_log ORDER BY ts DESC LIMIT ${limit}`)
    .all() as AuditRow[];
}

export function getAuditLogFiltered(opts: {
  userId?: number;
  subjectType?: string;
  action?: string;
  limit?: number;
}): AuditRow[] {
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (opts.userId !== undefined) {
    conditions.push('user_id = ?');
    bindings.push(opts.userId);
  }
  if (opts.subjectType) {
    conditions.push('subject_type = ?');
    bindings.push(opts.subjectType);
  }
  if (opts.action) {
    conditions.push('action = ?');
    bindings.push(opts.action);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const lim = opts.limit ?? 50;

  return db
    .prepare<(string | number)[], AuditRow>(`SELECT * FROM audit_log ${where} ORDER BY ts DESC LIMIT ${lim}`)
    .all(...bindings) as AuditRow[];
}
