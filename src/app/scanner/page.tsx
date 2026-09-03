"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useHasHydrated } from "@/store/useAppStore";
import { useMounted } from "@/hooks/use-mounted";
import { useDateParam } from "@/hooks/use-date-param";
import { useAuth } from "@/components/AuthProvider";
import { Loader2, CalendarDays } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { formatDateLong, todayKey } from "@/lib/date";

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

  return (
    <main className="min-h-screen pb-28">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="font-display text-xl font-bold tracking-tight">
            Scan Barcode
          </h1>
          <p className="text-sm text-muted-foreground">
            Scan a product to look it up in OpenFoodFacts.
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

        <div className="flex justify-center">
          <BarcodeScanner dateKey={date} />
        </div>
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
