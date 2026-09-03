"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns false during SSR/hydration and true after mount.
 * During React hydration useSyncExternalStore returns the server snapshot
 * (false), then flips to the client snapshot (true) after mount — so gating
 * client-only UI on this keeps the server HTML and first client render
 * identical and avoids hydration mismatches.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
