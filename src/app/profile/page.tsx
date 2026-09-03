"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth as firebaseAuth, isAuthConfigured } from "@/lib/firebase";
import { useAppStore, useHasHydrated } from "@/store/useAppStore";
import { useMounted } from "@/hooks/use-mounted";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActivityLevel, Gender, Goal, UserProfile } from "@/lib/types";
import { calculateTdee } from "@/lib/tdee";
import { Loader2, LogOut, Settings } from "lucide-react";

export default function ProfilePage() {
  const mounted = useMounted();
  const hasHydrated = useHasHydrated();
  const auth = useAuth();
  const profile = useAppStore((s) => s.profile);
  const activeUserId = useAppStore((s) => s.activeUserId);
  const onboarded = profile.onboarded;
  const synced = auth.status === "signedIn" && activeUserId === auth.user.uid;

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

  return <ProfileEditor profile={profile} />;
}

function ProfileEditor({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const setProfile = useAppStore((s) => s.setProfile);
  const auth = useAuth();

  // Mounted only after hydration + auth sync, so this is safe to seed.
  const [form, setForm] = useState<UserProfile>({
    name: profile.name || "",
    age: profile.age || 25,
    gender: profile.gender || "male",
    weight: profile.weight || 75,
    height: profile.height || 175,
    activityLevel: profile.activityLevel || "moderate",
    goal: profile.goal || "lose",
    customCalories: profile.customCalories || 0,
    onboarded: true,
  });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleGoalChange = (value: string | null) => {
    if (!value) return;
    const goal = value as Goal;
    if (goal === "custom") {
      const estimate =
        form.age > 0 && form.weight > 0 && form.height > 0
          ? calculateTdee({ ...form, goal: "maintain" }).calories
          : 2000;
      setForm((f) => ({
        ...f,
        goal,
        customCalories: f.customCalories || estimate,
      }));
    } else {
      set("goal", goal);
    }
  };

  const handleSave = () => {
    setProfile(form);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      if (isAuthConfigured() && firebaseAuth) {
        await signOut(firebaseAuth);
      }
      router.replace("/auth");
    } finally {
      setBusy(false);
    }
  };

  const preview = useMemo(
    () =>
      form.age > 0 && form.weight > 0 && form.height > 0
        ? calculateTdee(form)
        : null,
    [form],
  );

  const goalCopy: Record<Goal, string> = {
    lose: "to lose weight",
    maintain: "to maintain weight",
    gain: "to gain weight",
    custom: "with your custom budget",
  };

  const accountLabel =
    auth.status === "signedIn" && auth.user.email
      ? auth.user.email
      : "Local device account";

  return (
    <main className="min-h-screen pb-28">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-2.5 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Settings className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-lg font-bold leading-tight tracking-tight">
              Profile &amp; goals
            </h1>
            <p className="text-xs text-muted-foreground">{accountLabel}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-5">
        <Card className="rounded-3xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-xl tracking-tight">
              Your details
            </CardTitle>
            <CardDescription>
              Update anything — your daily calorie budget recalculates from
              these instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-bold">
                  Name
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="h-11 rounded-2xl text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="age" className="text-xs font-bold">
                  Age
                </Label>
                <Input
                  id="age"
                  type="number"
                  min={10}
                  max={120}
                  value={form.age || ""}
                  onChange={(e) => set("age", parseInt(e.target.value) || 0)}
                  className="h-11 rounded-2xl text-base"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gender" className="text-xs font-bold">
                  Biological sex
                </Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => set("gender", v as Gender)}
                >
                  <SelectTrigger
                    id="gender"
                    className="h-11 w-full rounded-2xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal" className="text-xs font-bold">
                  Goal
                </Label>
                <Select value={form.goal} onValueChange={handleGoalChange}>
                  <SelectTrigger id="goal" className="h-11 w-full rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lose">Lose · 0.5 kg/wk</SelectItem>
                    <SelectItem value="maintain">Maintain</SelectItem>
                    <SelectItem value="gain">Gain · 0.5 kg/wk</SelectItem>
                    <SelectItem value="custom">Custom calorie budget</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.goal === "custom" && (
              <div className="space-y-1.5">
                <Label htmlFor="customCalories" className="text-xs font-bold">
                  Daily calorie budget (kcal)
                </Label>
                <Input
                  id="customCalories"
                  type="number"
                  min={800}
                  max={6000}
                  step={10}
                  value={form.customCalories || ""}
                  onChange={(e) =>
                    set("customCalories", parseInt(e.target.value) || 0)
                  }
                  placeholder="e.g. 1990"
                  className="h-11 rounded-2xl text-base"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="weight" className="text-xs font-bold">
                  Weight (kg)
                </Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  min={30}
                  max={300}
                  value={form.weight || ""}
                  onChange={(e) =>
                    set("weight", parseFloat(e.target.value) || 0)
                  }
                  className="h-11 rounded-2xl text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="height" className="text-xs font-bold">
                  Height (cm)
                </Label>
                <Input
                  id="height"
                  type="number"
                  min={100}
                  max={250}
                  value={form.height || ""}
                  onChange={(e) =>
                    set("height", parseFloat(e.target.value) || 0)
                  }
                  className="h-11 rounded-2xl text-base"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="activity" className="text-xs font-bold">
                Activity level
              </Label>
              <Select
                value={form.activityLevel}
                onValueChange={(v) => set("activityLevel", v as ActivityLevel)}
              >
                <SelectTrigger
                  id="activity"
                  className="h-11 w-full rounded-2xl"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">
                    Sedentary — desk job, little exercise
                  </SelectItem>
                  <SelectItem value="light">
                    Light — exercise 1–3×/week
                  </SelectItem>
                  <SelectItem value="moderate">
                    Moderate — exercise 3–5×/week
                  </SelectItem>
                  <SelectItem value="active">
                    Active — exercise 6–7×/week
                  </SelectItem>
                  <SelectItem value="very-active">
                    Very active — hard exercise daily
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {preview && (
              <div className="rounded-2xl bg-secondary/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
                  Your daily plan {goalCopy[form.goal]}
                </p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="font-display text-4xl font-bold tabular-nums text-primary">
                    {preview.calories}
                  </span>
                  <span className="mb-1 text-sm font-medium text-muted-foreground">
                    kcal / day
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Protein", g: preview.protein, cls: "text-blue-600" },
                    { label: "Carbs", g: preview.carbs, cls: "text-amber-600" },
                    { label: "Fat", g: preview.fat, cls: "text-violet-600" },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl bg-card py-2">
                      <span
                        className={`font-display text-lg font-bold tabular-nums ${m.cls}`}
                      >
                        {m.g}g
                      </span>
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {isAuthConfigured() && (
                <Button
                  variant="outline"
                  className="gap-2 rounded-2xl text-red-500 hover:bg-red-50 hover:text-red-600"
                  onClick={handleSignOut}
                  disabled={busy}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              )}
              <Button
                onClick={handleSave}
                className="flex-1 rounded-2xl"
                disabled={busy}
              >
                {saved ? "Saved ✓" : "Save changes"}
              </Button>
            </div>

            {!isAuthConfigured() && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Local device mode — add the NEXT_PUBLIC_FIREBASE_* keys to
                .env.local (see .env.local.example) to enable email/Google
                sign-in and per-account sign-out.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
