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

/** Map Firebase auth error codes to human-friendly messages. */
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: string }).code)
      : "";
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
      return "This domain isn't authorized for Google sign-in in your Firebase project.";
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

export async function logInWithGoogle(): Promise<void> {
  const fb = requireAuth();
  const provider = new GoogleAuthProvider();
  // Redirect instead of popup: embedded webviews, installed PWAs and strict
  // browsers block signInWithPopup (auth/popup-blocked). A full-page redirect
  // to Google's consent screen works in every environment.
  await signInWithRedirect(fb, provider);
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
