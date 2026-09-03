"use client";

import { useSearchParams } from "next/navigation";
import { parseDateKey, todayKey } from "@/lib/date";

/**
 * Reads `?date=yyyy-MM-dd` from the URL and returns a validated date key,
 * falling back to today when the param is missing or malformed. Reactive:
 * navigating to the same page without the param flips it back to today.
 */
export function useDateParam(): string {
  const params = useSearchParams();
  const raw = params.get("date");
  if (!raw) return todayKey();
  return parseDateKey(raw) ? raw : todayKey();
}
