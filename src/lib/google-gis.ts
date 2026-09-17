"use client";

/**
 * Google Identity Services (GIS) fallback for "Continue with Google".
 *
 * Firebase's signInWithRedirect / signInWithPopup both rely on navigating to
 * (or popping) an external Google page. Some environments — embedded webviews,
 * preview iframes, strict PWAs — silently suppress those navigations, so the
 * button appears to do nothing. GIS instead renders a browser-native account
 * chooser in-page (FedCM on modern browsers) and returns an ID token, which we
 * exchange for a Firebase credential via signInWithCredential. No navigation,
 * no popups.
 *
 * Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID — the OAuth 2.0 "Web application"
 * client ID from the same Google Cloud project as Firebase, with the app's
 * origin (e.g. http://localhost:3000) listed under "Authorized JavaScript
 * origins". See .env.local.example.
 */

import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "./firebase";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GisCredentialResponse {
  credential?: string;
}

interface GisNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
}

interface GisIdApi {
  initialize(config: {
    client_id: string;
    auto_select?: boolean;
    callback: (response: GisCredentialResponse) => void;
  }): void;
  prompt(listener?: (notification: GisNotification) => void): void;
}

interface GoogleAccountsNamespace {
  accounts: { id: GisIdApi };
}

let gisPromise: Promise<void> | null = null;

/** Load the GIS client script once. */
function loadGis(): Promise<void> {
  const existing = (window as unknown as { google?: GoogleAccountsNamespace })
    .google?.accounts?.id;
  if (existing) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        gisPromise = null;
        reject(new Error("gis-load-failed"));
      };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

/** True when the GIS fallback can be attempted (client id configured). */
export function isGisEnabled(): boolean {
  return Boolean(CLIENT_ID && auth);
}

/**
 * Sign in with Google through the in-page GIS account chooser and hand the
 * resulting ID token to Firebase. Resolves once Firebase accepts the token.
 * Rejects when the chooser can't be shown, is dismissed, or times out.
 */
export async function logInWithGoogleGis(): Promise<void> {
  const fb = auth;
  if (!fb || !CLIENT_ID) throw new Error("gis-unavailable");
  await loadGis();
  const google = (window as unknown as { google?: GoogleAccountsNamespace })
    .google;
  if (!google?.accounts?.id) throw new Error("gis-unavailable");

  const idToken = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response) => {
        if (response?.credential) {
          done(() => resolve(response.credential as string));
        } else {
          done(() => reject(new Error("gis-no-credential")));
        }
      },
    });
    // prompt() renders the browser-native chooser. The notification tells us
    // when the moment never displays or the user closes it — reject right
    // away instead of waiting out the safety timeout.
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        done(() => reject(new Error("gis-not-displayed")));
      } else if (notification.isSkippedMoment()) {
        done(() => reject(new Error("gis-skipped")));
      } else if (notification.isDismissedMoment()) {
        done(() => reject(new Error("gis-dismissed")));
      }
    });
    // Safety net: the chooser sometimes never shows nor notifies (e.g. FedCM
    // unsupported and third-party cookies blocked). Don't leave the button
    // spinning forever.
    setTimeout(() => done(() => reject(new Error("gis-timeout"))), 90_000);
  });

  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(fb, credential);
}
