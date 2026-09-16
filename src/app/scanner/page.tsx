"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useHasHydrated } from "@/store/useAppStore";
import { useMounted } from "@/hooks/use-mounted";
import { useDateParam } from "@/hooks/use-date-param";
import { useAuth } from "@/components/AuthProvider";
import { Loader2, CalendarDays } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { MealPhotoScanner } from "@/components/MealPhotoScanner";
import { formatDateLong, todayKey } from "@/lib/date";
import { cn } from "@/lib/utils";

type ScanMode = "barcode" | "photo";

const MODE_STORAGE_KEY = "caltrack-scan-mode";

function loadInitialMode(): ScanMode {
  if (typeof window === "undefined") return "photo";
  return localStorage.getItem(MODE_STORAGE_KEY) === "barcode"
    ? "barcode"
    : "photo";
}

function ScannerContent() {
  const router = useRouter();
  const onboarded = useAppStore((s) => s.profile.onboarded);
  const activeUserId = useAppStore((s) => s.activeUserId);
  const hasHydrated = useHasHydrated();
  const mounted = useMounted();
  const auth = useAuth();
  // Diary date scanned foods will be logged into, carried from the dashboard.
  const date = useDateParam();
  const synced =
    auth.status === "signedIn" && activeUserId === auth.user.uid;
  // `mode` reads localStorage lazily so it is correct on first client render
  // (no flash of the wrong mode); server render always gets "photo".
  const [mode, setMode] = useState<ScanMode>(loadInitialMode);

  useEffect(() => {
    if (!hasHydrated || auth.status === "loading") return;
    if (auth.status === "signedOut") {
      window.location.replace("/auth");
      return;
    }
    if (activeUserId !== auth.user.uid) return;
    if (!onboarded) window.location.replace("/onboarding");
  }, [hasHydrated, auth, onboarded, activeUserId]);

  if (!mounted || !synced) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!onboarded) return null;

  const loggingToday = date === todayKey();

  const switchMode = (next: ScanMode) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Storage unavailable — mode just won't persist.
    }
  };

  return (
    <main className="min-h-screen pb-28">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="font-display text-xl font-bold tracking-tight">
            Scan
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "barcode"
              ? "Scan a product barcode to look it up in OpenFoodFacts."
              : "Photograph a meal — AI estimates calories and macros."}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pt-4">
        {!loggingToday && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-3.5 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
              <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">
                Adding to {formatDateLong(date)}
              </span>
            </span>
            <button
              onClick={() => router.push("/scanner")}
              className="shrink-0 text-xs font-bold text-primary hover:underline"
            >
              Today
            </button>
          </div>
        )}

        {/* Barcode / Photo mode toggle */}
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
          {(
            [
              { id: "barcode", label: "Barcode" },
              { id: "photo", label: "Photo" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchMode(tab.id)}
              className={cn(
                "rounded-xl py-2.5 text-sm font-semibold transition-colors",
                mode === tab.id
                  ? "bg-card text-foreground shadow-md shadow-black/5"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={mode === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Only the active mode is mounted, so switching releases the camera. */}
        {mode === "barcode" ? (
          <div className="flex justify-center">
            <BarcodeScanner dateKey={date} />
          </div>
        ) : (
          <MealPhotoScanner dateKey={date} />
        )}
      </div>
    </main>
  );
}

export default function ScannerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ScannerContent />
    </Suspense>
  );
}
