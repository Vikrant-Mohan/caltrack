"use client";

import { useEffect } from "react";

/**
 * Registers CalTrack's service worker (public/sw.js) so the app can be
 * installed as a PWA and opened offline. Deliberately skipped in `next dev`
 * — dev-mode hot reloading and a caching service worker don't mix.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch (err) {
        console.warn("Service worker registration failed:", err);
      }
    };
    register();
  }, []);

  return null;
}
