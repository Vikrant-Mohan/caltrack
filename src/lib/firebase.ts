"use client";

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Firebase client configuration. All values are PUBLIC by design (Firebase
 * web apps ship them to the browser) and come from `NEXT_PUBLIC_*` env vars:
 *
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 *
 * When none of them are set the app falls back to a fully-local "device
 * account" mode so the tracker keeps working without configuration.
 */
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

const config =
  apiKey && process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    ? {
        apiKey,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
      }
    : null;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (typeof window !== "undefined" && config) {
  try {
    app = initializeApp(config);
    auth = getAuth(app);
  } catch (err) {
    console.error("Firebase init failed:", err);
  }
}

/** True when Firebase (email + Google sign-in) is configured. */
export function isAuthConfigured(): boolean {
  return auth !== null;
}

export { app, auth };
