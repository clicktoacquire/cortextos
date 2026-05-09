'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { SplashScreen } from '@/components/layout/splash-screen';

type AuthMode = 'credentials' | 'magic-link';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [mode, setMode] = useState<AuthMode>('credentials');
  const [magicSent, setMagicSent] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  // Redirect to setup if no users exist
  useEffect(() => {
    fetch('/api/setup')
      .then((res) => res.json())
      .then((data) => {
        if (data.needsSetup) router.push('/setup');
      })
      .catch(() => {});
  }, [router]);

  // Check if Google provider is available
  useEffect(() => {
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then((data) => {
        setGoogleAvailable(!!data?.google);
      })
      .catch(() => {});
  }, []);

  // CSRF token — fetch once, hold in ref to avoid React reconciliation issues
  const csrfTokenRef = useRef<string>('');
  const [csrfReady, setCsrfReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
        const data = await res.json();
        if (cancelled) return;
        const token = data?.csrfToken;
        if (!token) { console.error('[login] /api/auth/csrf returned no token', data); return; }
        csrfTokenRef.current = token;
        setCsrfReady(true);
      } catch (err) {
        console.error('[login] csrf fetch failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Credentials submit ─────────────────────────────────────────────────
  async function handleCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = e.currentTarget;
    const username = (form.querySelector('input[name="username"]') as HTMLInputElement | null)?.value ?? '';
    const password = (form.querySelector('input[name="password"]') as HTMLInputElement | null)?.value ?? '';

    // Re-fetch CSRF token at submit time so body token matches the current
    // cookie. React StrictMode double-invokes the mount-time CSRF useEffect
    // in dev; if the two in-flight /api/auth/csrf responses resolve out of
    // order, the browser's authjs.csrf-token cookie can end up pinned to a
    // different token than csrfTokenRef.current — which the server rejects
    // as MissingCSRF. An atomic fetch-then-submit here forces cookie and
    // body into sync regardless of earlier mount-time races.
    let submitToken = csrfTokenRef.current;
    try {
      const freshCsrf = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
      const freshData = await freshCsrf.json();
      if (freshData?.csrfToken) submitToken = freshData.csrfToken;
    } catch {
      // Fall back to the mount-time token if the refetch fails.
    }

    const body = new URLSearchParams();
    body.set('csrfToken', submitToken || '');
    body.set('username', usernameInput?.value || '');
    body.set('password', passwordInput?.value || '');


    try {
      const res = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        credentials: 'same-origin',
        redirect: 'follow',
      });
      if (res.redirected) {
        const target = new URL(res.url);
        if (target.pathname.startsWith('/login')) {
          const code = target.searchParams.get('error') || 'Unknown';
          setError(code === 'CallbackRouteError'
            ? 'Too many attempts. Please wait a few minutes and try again.'
            : `Sign-in failed: ${code}`);
          setLoading(false);
          return;
        }
        const callbackParam = new URL(window.location.href).searchParams.get('callbackUrl');
        const safeTarget = callbackParam && callbackParam.startsWith('/') && !callbackParam.startsWith('//') ? callbackParam : '/';
        window.location.href = safeTarget;
        return;
      }
      if (res.ok) { window.location.href = '/'; return; }
      setError(`Sign-in failed with status ${res.status}`);
      setLoading(false);
    } catch (err) {
      console.error('[login] submit error:', err);
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  // ── Magic-link submit ─────────────────────────────────────────────────
  async function handleMagicLinkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = e.currentTarget;
    const email = (form.querySelector('input[name="email"]') as HTMLInputElement | null)?.value ?? '';

    const body = new URLSearchParams();
    body.set('csrfToken', csrfTokenRef.current);
    body.set('email', email);
    body.set('callbackUrl', '/');

    try {
      const res = await fetch('/api/auth/signin/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        credentials: 'same-origin',
        redirect: 'follow',
      });
      // NextAuth redirects to /api/auth/verify-request on success
      if (res.redirected || res.ok) {
        setMagicSent(true);
      } else {
        setError(`Failed to send magic link (${res.status})`);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Google SSO ────────────────────────────────────────────────────────
  function handleGoogleSignIn() {
    const callbackUrl = new URL(window.location.href).searchParams.get('callbackUrl') ?? '/';
    window.location.href = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }

  const handleSplashComplete = useCallback(() => {}, []);

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <div className={`flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted to-background ${showSplash ? 'invisible' : ''}`}>
        <div className="w-full max-w-sm space-y-6 px-4">
          {/* Logo */}
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-lg font-bold">
              cO
            </div>
            <h1 className="text-xl font-semibold tracking-tight">cortextOS</h1>
            <p className="text-sm text-muted-foreground">Persistent AI Agent Orchestration</p>
          </div>

          {/* Login Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Sign in</CardTitle>
              <CardDescription className="text-xs">
                {mode === 'credentials'
                  ? 'Enter your credentials to access the dashboard'
                  : 'Enter your email to receive a magic link'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Google SSO */}
              {googleAvailable && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                  >
                    <GoogleIcon />
                    Continue with Google
                  </Button>
                  <Divider label="or" />
                </>
              )}

              {/* Mode tabs */}
              <div className="flex rounded-md border p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => { setMode('credentials'); setError(''); setMagicSent(false); }}
                  className={`flex-1 rounded py-1 transition-colors ${mode === 'credentials' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('magic-link'); setError(''); }}
                  className={`flex-1 rounded py-1 transition-colors ${mode === 'magic-link' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Magic Link
                </button>
              </div>

              {/* Credentials form */}
              {mode === 'credentials' && (
                <form onSubmit={handleCredentialsSubmit} className="space-y-3" suppressHydrationWarning>
                  <input type="hidden" name="csrfToken" defaultValue="" suppressHydrationWarning />
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-xs">Username</Label>
                    <Input id="username" name="username" type="text" required autoFocus placeholder="admin" suppressHydrationWarning />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs">Password</Label>
                    <Input id="password" name="password" type="password" required placeholder="Enter password" suppressHydrationWarning />
                  </div>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading || !csrfReady}>
                    {loading ? 'Signing in…' : csrfReady ? 'Sign In' : 'Loading…'}
                  </Button>
                </form>
              )}

              {/* Magic link form */}
              {mode === 'magic-link' && !magicSent && (
                <form onSubmit={handleMagicLinkSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoFocus
                      placeholder="robert@piggybankmedia.com"
                    />
                  </div>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading || !csrfReady}>
                    {loading ? 'Sending…' : 'Send Magic Link'}
                  </Button>
                </form>
              )}

              {mode === 'magic-link' && magicSent && (
                <div className="rounded-md bg-muted px-4 py-3 text-sm text-center space-y-1">
                  <p className="font-medium">Check your inbox</p>
                  <p className="text-xs text-muted-foreground">
                    A sign-in link was sent to your email. Click it to log in.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMagicSent(false)}
                    className="text-xs text-muted-foreground underline mt-1"
                  >
                    Send again
                  </button>
                </div>
              )}

            </CardContent>
          </Card>

          <p className="text-center text-[11px] text-muted-foreground/60">cortextOS v2</p>
        </div>
      </div>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="relative flex items-center">
      <div className="flex-1 border-t" />
      <span className="mx-3 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1 border-t" />
    </div>
  );
}
