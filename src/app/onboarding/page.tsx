"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Flame, Loader2 } from "lucide-react";

export default function OnboardingPage() {
  // The persisted profile rehydrates from localStorage after the first client
  // render, so the server HTML and the first client render must stay
  // identical (a loader) — the form only mounts once hydration has finished
  // AND the signed-in user's data is synced, which also lets it prefill
  // cleanly from an existing profile.
  const mounted = useMounted();
  const hasHydrated = useHasHydrated();
  const auth = useAuth();
  const onboarded = useAppStore((s) => s.profile.onboarded);
  const activeUserId = useAppStore((s) => s.activeUserId);
  const synced =
    auth.status === "signedIn" && activeUserId === auth.user.uid;

  useEffect(() => {
    if (!hasHydrated || auth.status === "loading") return;
    if (auth.status === "signedOut") {
      window.location.replace("/auth");
      return;
    }
    if (activeUserId !== auth.user.uid) return;
    // Already set up (e.g. the race while the store syncs) — go to dashboard.
    if (onboarded) window.location.replace("/dashboard");
  }, [hasHydrated, auth, onboarded, activeUserId]);

  if (!mounted || !hasHydrated || !synced) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return <OnboardingForm />;
}

function OnboardingForm() {
  const router = useRouter();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const existingProfile = useAppStore((s) => s.profile);

  const [form, setForm] = useState<UserProfile>({
    name: existingProfile.name || "",
    age: existingProfile.age || 25,
    gender: existingProfile.gender || "male",
    weight: existingProfile.weight || 75,
    height: existingProfile.height || 175,
    activityLevel: existingProfile.activityLevel || "moderate",
    goal: existingProfile.goal || "lose",
    customCalories: existingProfile.customCalories || 0,
    onboarded: true,
  });

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Switching to "Custom" pre-fills the budget with the current estimate so
  // the user just edits the number (e.g. 2672 -> 1990).
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
      setForm((f) => ({ ...f, goal }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    completeOnboarding(form);
    router.replace("/dashboard");
  };

  // Live preview of the day's budget while the form is being filled in.
  const preview =
    form.age > 0 && form.weight > 0 && form.height > 0
      ? calculateTdee(form)
      : null;

  const goalCopy: Record<Goal, string> = {
    lose: "to lose weight",
    maintain: "to maintain weight",
    gain: "to gain weight",
    custom: "with your custom budget",
  };

  return (
    <main className="min-h-screen pb-10">
      {/* Hero */}
      <div className="bg-gradient-to-b from-primary/15 via-primary/5 to-transparent pb-8 pt-10">
        <div className="mx-auto max-w-lg px-5 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground shadow-lg shadow-primary/30">
            <Flame className="h-7 w-7" />
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Welcome to CalTrack
          </h1>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
            Your free calorie coach. We&apos;ll build your daily budget from
            your body and goals.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4">
        <Card className="rounded-3xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="font-display text-xl tracking-tight">
              Tell us about yourself
            </CardTitle>
            <CardDescription>
              This takes about a minute — you can change it later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-bold">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Your name"
                    className="h-11 rounded-2xl text-base"
                    required
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
                    onChange={(e) =>
                      set("age", parseInt(e.target.value) || 0)
                    }
                    className="h-11 rounded-2xl text-base"
                    required
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
                    <SelectTrigger id="gender" className="h-11 w-full rounded-2xl">
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
                  <Select
                    value={form.goal}
                    onValueChange={handleGoalChange}
                  >
                    <SelectTrigger id="goal" className="h-11 w-full rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lose">Lose · 0.5 kg/wk</SelectItem>
                      <SelectItem value="maintain">Maintain</SelectItem>
                      <SelectItem value="gain">Gain · 0.5 kg/wk</SelectItem>
                      <SelectItem value="custom">
                        Custom calorie budget
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.goal === "custom" && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="customCalories"
                    className="text-xs font-bold"
                  >
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
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Your exact daily budget — it overrides the formula estimate
                    below. Macros still split 30 / 40 / 30.
                  </p>
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
                    required
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
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="activity" className="text-xs font-bold">
                  Activity level
                </Label>
                <Select
                  value={form.activityLevel}
                  onValueChange={(v) =>
                    set("activityLevel", v as ActivityLevel)
                  }
                >
                  <SelectTrigger id="activity" className="h-11 w-full rounded-2xl">
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
                        <span className={`font-display text-lg font-bold tabular-nums ${m.cls}`}>
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

              <Button
                type="submit"
                size="lg"
                className="h-13 w-full rounded-2xl py-3.5 text-base shadow-lg shadow-primary/25"
              >
                Start tracking
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-4 pb-6 text-center text-xs text-muted-foreground">
          Estimates use the Mifflin-St Jeor formula. Macros split 30 / 40 / 30.
        </p>
      </div>
    </main>
  );
}