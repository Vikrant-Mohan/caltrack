"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useHasHydrated } from "@/store/useAppStore";
import { useMounted } from "@/hooks/use-mounted";
import { useDateParam } from "@/hooks/use-date-param";
import { Loader2 } from "lucide-react";
import { FoodSearch } from "@/components/FoodSearch";

function SearchContent() {
  const router = useRouter();
  const onboarded = useAppStore((s) => s.profile.onboarded);
  const hasHydrated = useHasHydrated();
  const mounted = useMounted();
  // Diary date foods will be logged into, carried over from the dashboard.
  const date = useDateParam();

  useEffect(() => {
    if (hasHydrated && !onboarded) {
      router.replace("/onboarding");
    }
  }, [hasHydrated, onboarded, router]);

  if (!mounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!onboarded) return null;

  return (
    <main className="min-h-screen pb-28">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-md px-4 py-4">
          <h1 className="font-display text-xl font-bold tracking-tight">
            Search Foods
          </h1>
          <p className="text-sm text-muted-foreground">
            Find any product and add it to your food log.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pt-4">
        <FoodSearch dateKey={date} />
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
