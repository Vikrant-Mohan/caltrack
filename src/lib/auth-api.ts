"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
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
      return "The sign-in popup was closed before finishing.";
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
  await signInWithPopup(fb, provider);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const fb = requireAuth();
  await sendPasswordResetEmail(fb, email);
}
