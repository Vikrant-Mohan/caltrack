"use client";

import { useEffect, useState } from "react";
import { Flame, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAuth,
  useAuthError,
  useClearAuthError,
} from "@/components/AuthProvider";
import { isAuthConfigured } from "@/lib/firebase";
import {
  authErrorMessage,
  logInWithEmail,
  logInWithGoogle,
  sendPasswordReset,
  signUpWithEmail,
} from "@/lib/auth-api";
import { isGisEnabled, logInWithGoogleGis } from "@/lib/google-gis";
import { useAppStore, useHasHydrated } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export default function AuthPage() {
  const authState = useAuth();
  const redirectError = useAuthError();
  const clearRedirectError = useClearAuthError();
  const onboarded = useAppStore((s) => s.profile.onboarded);
  const hasHydrated = useHasHydrated();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const configured = isAuthConfigured();

  // Already signed in — go where the profile says.
  useEffect(() => {
    if (authState.status !== "signedIn" || !hasHydrated) return;
    window.location.replace(onboarded ? "/dashboard" : "/onboarding");
  }, [authState.status, hasHydrated, onboarded]);

  if (authState.status === "signedIn") {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    clearRedirectError();
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email.trim(), password, name);
        // onAuthStateChanged signs the user in and the redirect above runs.
      } else {
        await logInWithEmail(email.trim(), password);
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    setError(null);
    setNotice(null);
    clearRedirectError();
    setBusy(true);
    try {
      // Try the standard Firebase redirect flow first. Some embedded views
      // (preview iframes, in-app webviews) silently drop the navigation —
      // logInWithGoogle detects that and returns "blocked", and we fall back
      // to Google Identity Services (an in-page account chooser, no
      // navigation or popup needed) when a client ID is configured.
      const outcome = await logInWithGoogle();
      if (outcome.kind === "navigating") return; // browser is leaving
      if (isGisEnabled()) {
        await logInWithGoogleGis();
        return; // onAuthStateChanged takes over
      }
      setError(authErrorMessage(new Error("redirect-blocked")));
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    setError(null);
    clearRedirectError();
    try {
      await sendPasswordReset(email.trim());
      setNotice("Password reset email sent — check your inbox.");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground shadow-lg shadow-primary/30">
            <Flame className="h-7 w-7" />
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Welcome to CalTrack
          </h1>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Sign in to keep your diary, goals and weight — one account per
            person.
          </p>
        </div>

        {!configured && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            <p className="font-semibold">Firebase isn&apos;t configured yet</p>
            <p className="mt-1 leading-snug">
              Add NEXT_PUBLIC_FIREBASE_API_KEY, _AUTH_DOMAIN, _PROJECT_ID and
              _APP_ID to .env.local (see .env.local.example), then restart the
              dev server. Until then, sign-ins run on a local demo account.
            </p>
          </div>
        )}

        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
          {/* Mode tabs */}
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
            {(
              [
                { key: "signin", label: "Sign in" },
                { key: "signup", label: "Create account" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setMode(t.key);
                  setError(null);
                  setNotice(null);
                  clearRedirectError();
                }}
                className={cn(
                  "rounded-full py-2 text-sm font-semibold transition-colors",
                  mode === t.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-bold">
                  Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="h-11 rounded-2xl text-base"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="h-11 rounded-2xl text-base"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold">
                  Password
                </Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={forgotPassword}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                className="h-11 rounded-2xl text-base"
              />
            </div>

            {(redirectError || error) && (
              <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600">
                {redirectError ?? error}
              </p>
            )}
            {notice && (
              <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700">
                {notice}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={busy}
              className="h-12 w-full rounded-2xl text-base"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {busy
                ? "Please wait…"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in with email"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy || !configured}
            onClick={googleSignIn}
            className="h-12 w-full gap-2.5 rounded-2xl text-base"
          >
            <GoogleG />
            Continue with Google
          </Button>

          {!configured && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Google sign-in unlocks once Firebase is configured.
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          New account? Finish sign-up, then we&apos;ll set up your calorie
          budget in under a minute.
        </p>
      </div>
    </main>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
