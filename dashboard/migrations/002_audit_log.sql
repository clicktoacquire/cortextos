-- Migration 002: audit_log table (PHASES Task 2.4)
-- Tracks user-initiated actions across admin routes.
CREATE TABLE IF NOT EXISTS audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL,
  username  TEXT    NOT NULL,
  action    TEXT    NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id   TEXT,
  metadata_json TEXT,
  ip        TEXT,
  ts        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_ts          ON audit_log(ts);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id     ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_subject_type ON audit_log(subject_type);
