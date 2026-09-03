"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useHasHydrated } from "@/store/useAppStore";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();
  const onboarded = useAppStore((s) => s.profile.onboarded);
  const hasHydrated = useHasHydrated();

  useEffect(() => {
    // Wait for persisted state to rehydrate before deciding where to go.
    if (!hasHydrated) return;
    router.replace(onboarded ? "/dashboard" : "/onboarding");
  }, [hasHydrated, onboarded, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}