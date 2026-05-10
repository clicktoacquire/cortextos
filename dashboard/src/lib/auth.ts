// cortextOS Dashboard - NextAuth v5 configuration
// Providers: Credentials (existing), Resend magic-link (Task 2.2), Google OAuth (Task 2.2)

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import ResendProvider from 'next-auth/providers/resend';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import { db } from './db';
import { checkRateLimit, resetRateLimit } from './rate-limit';
import { makeSQLiteAdapter } from './auth-adapter';
import { audit } from './audit';
import type { User } from './types';

const cookieOptions = (secure: boolean) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure,
});

const isProd = process.env.NODE_ENV === 'production';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: makeSQLiteAdapter(),
  cookies: {
    sessionToken: {
      name: 'authjs.session-token',
      options: cookieOptions(isProd),
    },
    csrfToken: {
      name: 'authjs.csrf-token',
      options: cookieOptions(isProd),
    },
    callbackUrl: {
      name: 'authjs.callback-url',
      options: { sameSite: 'lax', path: '/', secure: isProd },
    },
    pkceCodeVerifier: {
      name: 'authjs.pkce.code_verifier',
      options: cookieOptions(isProd),
    },
    state: {
      name: 'authjs.state',
      options: cookieOptions(isProd),
    },
    nonce: {
      name: 'authjs.nonce',
      options: cookieOptions(isProd),
    },
  },
  providers: [
    // ── Credentials (username + password, existing) ───────────────────────
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const trustProxy = process.env.TRUST_PROXY === 'true';
        const headers = (request as Request | undefined)?.headers;
        const ip = trustProxy
          ? (headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0')
          : (headers?.get('x-real-ip') ?? headers?.get('cf-connecting-ip') ?? '0.0.0.0');

        const { allowed } = checkRateLimit(ip);
        if (!allowed) throw new Error('Too many attempts. Please try again later.');

        if (!credentials?.username || !credentials?.password) return null;

        await seedAdminUser();

        const user = db
          .prepare('SELECT * FROM users WHERE username = ?')
          .get(credentials.username as string) as User | undefined;
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password as string, user.password_hash);
        if (!valid) return null;

        resetRateLimit(ip);

        return { id: String(user.id), name: user.username, email: user.email ?? undefined };
      },
    }),

    // ── Resend magic-link ─────────────────────────────────────────────────
    ResendProvider({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM ?? 'noreply@clicktoacquire.com',
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const apiKey = provider.apiKey ?? process.env.RESEND_API_KEY;
        if (!apiKey) throw new Error('RESEND_API_KEY is not set');
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: provider.from ?? 'noreply@clicktoacquire.com',
          to: email,
          subject: 'Sign in to CTA Platform',
          html: `
            <p>Click the link below to sign in to the CTA Platform dashboard:</p>
            <p><a href="${url}" style="font-size:16px;font-weight:600">Sign in</a></p>
            <p style="color:#666;font-size:12px">Link expires in 24 hours. If you didn't request this, ignore this email.</p>
          `,
        });
      },
    }),

    // ── Google OAuth ──────────────────────────────────────────────────────
    // Config-ready state: works once GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET are set.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          allowDangerousEmailAccountLinking: true,
        })]
      : []),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user }) {
      // Audit every successful sign-in
      if (user?.id) {
        try {
          audit({
            userId: Number(user.id),
            username: user.name ?? user.email ?? String(user.id),
            action: 'login',
            subjectType: 'Session',
          });
        } catch {
          // Non-fatal: audit table may not exist yet on first boot
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        // Fresh sign-in: hydrate role + client_id from DB
        const row = db
          .prepare('SELECT role FROM users WHERE id = ?')
          .get(Number(user.id)) as { role: string } | undefined;
        token.id = user.id;
        token.role = row?.role ?? 'founder';
        token.client_id = null;
      }
      // On subsequent token refreshes role is already in the token; keep it.
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.client_id = (token.client_id as string | null) ?? null;
      }
      return session;
    },
    authorized({ auth: session }) {
      return !!session;
    },
  },
});

/** Seed admin user from env vars, or sync password if SYNC_ADMIN_PASSWORD=true */
export async function seedAdminUser(): Promise<void> {
  const row = db
    .prepare('SELECT COUNT(*) as count FROM users')
    .get() as { count: number };

  if (row.count > 0 && process.env.SYNC_ADMIN_PASSWORD !== 'true') return;

  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('ADMIN_PASSWORD environment variable is required but not set.');

  const KNOWN_DEFAULTS = ['cortextos', 'password', 'admin', 'changeme'];
  if (isProd && KNOWN_DEFAULTS.includes(password)) {
    throw new Error('ADMIN_PASSWORD is a known default. Set a strong password in .env.local');
  }

  if (row.count > 0) {
    const user = db
      .prepare('SELECT password_hash FROM users WHERE username = ?')
      .get(username) as { password_hash: string } | undefined;
    if (user) {
      const matches = await bcrypt.compare(password, user.password_hash);
      if (!matches) {
        const hash = await bcrypt.hash(password, 12);
        db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, username);
        console.log(`[auth] Admin password updated from environment (SYNC_ADMIN_PASSWORD=true)`);
      }
    }
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  db.prepare(`
    INSERT INTO users (username, email, password_hash, role)
    VALUES (?, ?, ?, 'founder')
  `).run(username, process.env.ADMIN_EMAIL ?? null, hash);

  console.log(`[auth] Seeded admin user: ${username}`);
}
