"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useAppStore, useHasHydrated } from "@/store/useAppStore";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();
  const auth = useAuth();
  const onboarded = useAppStore((s) => s.profile.onboarded);
  const activeUserId = useAppStore((s) => s.activeUserId);
  const hasHydrated = useHasHydrated();

  useEffect(() => {
    if (!hasHydrated || auth.status === "loading") return;
    if (auth.status === "signedOut") {
      router.replace("/auth");
      return;
    }
    // Wait until the store mirrors the signed-in user's data.
    if (activeUserId !== auth.user.uid) return;
    router.replace(onboarded ? "/dashboard" : "/onboarding");
  }, [auth, hasHydrated, onboarded, activeUserId, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
