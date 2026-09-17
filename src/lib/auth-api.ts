"use client";

import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithRedirect,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase";

function requireAuth() {
  if (!auth) {
    throw new Error(
      "Firebase isn't configured. Add NEXT_PUBLIC_FIREBASE_* vars to .env.local (see .env.local.example).",
    );
  }
  return auth;
}

/** Firebase-style `code`, or our own sentinel (`redirect-blocked`, `gis-*`). */
function authErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    if ("code" in error) return String((error as { code: string }).code);
    if ("message" in error) {
      const msg = String((error as { message: string }).message);
      if (msg === "redirect-blocked" || msg.startsWith("gis-")) return msg;
    }
  }
  return "";
}

/** Map Firebase auth error codes to human-friendly messages. */
export function authErrorMessage(error: unknown): string {
  const code = authErrorCode(error);
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with that email already exists — try signing in instead.";
    case "auth/invalid-email":
      return "That email address doesn't look valid.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return "Wrong email or password. Check them and try again.";
    case "auth/too-many-requests":
      return "Too many attempts — please wait a minute and try again.";
    case "auth/popup-closed-by-user":
      return "The sign-in window was closed before finishing — try again.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup — try again; Google now opens as a full-page redirect.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorized for Google sign-in. Add it in the Firebase console (Authentication → Settings → Authorized domains).";
    case "redirect-blocked":
      return "Google sign-in can't open from this embedded view. Open CalTrack in a normal browser tab, or sign in with email above.";
    case "gis-unavailable":
    case "gis-load-failed":
      return "Google sign-in isn't available right now — try again, or sign in with email.";
    case "gis-not-displayed":
    case "gis-skipped":
      return "Google couldn't show the account chooser here (embedded browsers often block it). Open CalTrack in a normal browser tab, or sign in with email above.";
    case "gis-dismissed":
      return "The Google account chooser was closed before finishing — try again.";
    case "gis-no-credential":
    case "gis-timeout":
      return "Google sign-in didn't finish — try again, or sign in with email above.";
    case "auth/operation-not-allowed":
      return "Email/password or Google sign-in isn't enabled in your Firebase console.";
    default:
      return code
        ? `Sign-in failed (${code}).`
        : "Something went wrong. Please try again.";
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  const fb = requireAuth();
  const cred = await createUserWithEmailAndPassword(fb, email, password);
  if (displayName.trim()) {
    try {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    } catch {
      // Non-fatal — the account still exists.
    }
  }
}

export async function logInWithEmail(email: string, password: string): Promise<void> {
  const fb = requireAuth();
  await signInWithEmailAndPassword(fb, email, password);
}

/** What happened after attempting a Google redirect sign-in. */
export type GoogleSignInOutcome = { kind: "navigating" } | { kind: "blocked" };

export async function logInWithGoogle(): Promise<GoogleSignInOutcome> {
  const fb = requireAuth();
  const provider = new GoogleAuthProvider();
  // Redirect instead of popup: embedded webviews, installed PWAs and strict
  // browsers block signInWithPopup (auth/popup-blocked). A full-page redirect
  // to Google's consent screen works in most environments.
  //
  // Race the SDK call itself: when an environment swallows the navigation,
  // signInWithRedirect can hang on its internal handshake and never settle —
  // don't leave the button spinning forever.
  const sdkSettled = await Promise.race([
    signInWithRedirect(fb, provider).then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 5000)),
  ]);
  if (!sdkSettled) return { kind: "blocked" };
  // The SDK resolving only means the navigation was *started*. Confirm the
  // page is actually going away — embedded views sometimes drop it here.
  const navigatedAway = await Promise.race([
    new Promise<true>((resolve) => {
      window.addEventListener("pagehide", () => resolve(true), { once: true });
    }),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000)),
  ]);
  return navigatedAway ? { kind: "navigating" } : { kind: "blocked" };
}

/**
 * Complete a pending Google redirect sign-in. Call once when the app loads:
 * after Google redirects back, the SDK finishes the exchange here. Returns
 * the signed-in user or the error (e.g. the user cancelled on Google).
 */
export async function handleGoogleRedirect(): Promise<{
  user: unknown;
  error: unknown;
}> {
  if (!auth) return { user: null, error: null };
  try {
    const result = await getRedirectResult(auth);
    return { user: result?.user ?? null, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const fb = requireAuth();
  await sendPasswordResetEmail(fb, email);
}
