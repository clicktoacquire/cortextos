/**
 * Minimal NextAuth v5 SQLite adapter.
 * Covers verification_tokens (magic-link) + accounts (Google SSO) + users.
 * Only implements the methods NextAuth actually calls for these two providers.
 */

import type { Adapter, AdapterUser, AdapterAccount, VerificationToken } from '@auth/core/adapters';
import { db } from './db';
import type { User } from './types';

function toAdapterUser(row: User): AdapterUser & { role: string } {
  return {
    id: String(row.id),
    name: row.username,
    email: row.email ?? '',
    emailVerified: null,
    role: row.role,
  };
}

export function makeSQLiteAdapter(): Adapter {
  return {
    // ── Users ──────────────────────────────────────────────────────────────

    async getUser(id) {
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id)) as User | undefined;
      return row ? toAdapterUser(row) : null;
    },

    async getUserByEmail(email) {
      const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
      return row ? toAdapterUser(row) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const row = db
        .prepare(`
          SELECT u.* FROM users u
          JOIN accounts a ON a.user_id = u.id
          WHERE a.provider = ? AND a.provider_account_id = ?
        `)
        .get(provider, providerAccountId) as User | undefined;
      return row ? toAdapterUser(row) : null;
    },

    async createUser(data) {
      const username = (data.name ?? data.email.split('@')[0]).slice(0, 64);
      const existing = db
        .prepare('SELECT * FROM users WHERE email = ?')
        .get(data.email) as User | undefined;
      if (existing) return toAdapterUser(existing);

      const stmt = db.prepare(
        `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, '', 'founder')`
      );
      const result = stmt.run(username, data.email);
      const row = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(result.lastInsertRowid) as User;
      return toAdapterUser(row);
    },

    async updateUser(data) {
      if (data.email) {
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(data.email, Number(data.id));
      }
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(data.id)) as User;
      return toAdapterUser(row);
    },

    // ── Accounts (OAuth linking) ─────────────────────────────────────────

    async linkAccount(account: AdapterAccount) {
      db.prepare(`
        INSERT OR REPLACE INTO accounts
          (user_id, type, provider, provider_account_id, refresh_token, access_token,
           expires_at, token_type, scope, id_token, session_state)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        Number(account.userId),
        account.type,
        account.provider,
        account.providerAccountId,
        account.refresh_token ?? null,
        account.access_token ?? null,
        account.expires_at ?? null,
        account.token_type ?? null,
        account.scope ?? null,
        account.id_token ?? null,
        account.session_state ?? null,
      );
      return account;
    },

    // ── Verification tokens (magic-link) ─────────────────────────────────

    async createVerificationToken(token: VerificationToken) {
      db.prepare(`
        INSERT OR REPLACE INTO verification_tokens (identifier, token, expires)
        VALUES (?, ?, ?)
      `).run(token.identifier, token.token, token.expires.toISOString());
      return token;
    },

    async useVerificationToken({ identifier, token }) {
      const row = db
        .prepare('SELECT * FROM verification_tokens WHERE identifier = ? AND token = ?')
        .get(identifier, token) as { identifier: string; token: string; expires: string } | undefined;
      if (!row) return null;
      db.prepare('DELETE FROM verification_tokens WHERE identifier = ? AND token = ?').run(
        identifier, token
      );
      return {
        identifier: row.identifier,
        token: row.token,
        expires: new Date(row.expires),
      };
    },
  };
}
