"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useAppStore, useHasHydrated } from "@/store/useAppStore";
import { useMounted } from "@/hooks/use-mounted";
import { useAuth } from "@/components/AuthProvider";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Loader2,
  ScanBarcode,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { CalorieRing } from "@/components/CalorieRing";
import { MacroBar } from "@/components/MacroBar";
import { WeekSummary } from "@/components/WeekSummary";
import { WeightCard } from "@/components/WeightCard";
import { Button } from "@/components/ui/button";
import type { FoodLog, MealType } from "@/lib/types";
import { MEAL_ORDER, MEAL_LABELS } from "@/lib/types";
import {
  addDaysToKey,
  formatDateShort,
  parseDateKey,
  todayKey,
} from "@/lib/date";
import { logCalories, logFactor, logGrams } from "@/lib/food-utils";
import { cn } from "@/lib/utils";

const NO_LOGS: FoodLog[] = [];

// Remember the diary day the user was viewing so back/forth navigation between
// the dashboard, search and scanner keeps them on the same date (per tab).
const VIEWED_DATE_KEY = "caltrack-viewed-date";
function restoreViewedDate(): string {
  if (typeof window === "undefined") return todayKey();
  try {
    const saved = window.sessionStorage.getItem(VIEWED_DATE_KEY);
    if (saved && parseDateKey(saved)) return saved;
  } catch {
    // Storage unavailable — ignore.
  }
  return todayKey();
}

const MACRO_COLORS: Record<
  string,
  { fill: string; dot: string }
> = {
  Protein: { fill: "bg-blue-500", dot: "bg-blue-500" },
  Carbs: { fill: "bg-amber-500", dot: "bg-amber-500" },
  Fat: { fill: "bg-violet-500", dot: "bg-violet-500" },
};

export default function DashboardPage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const removeLog = useAppStore((s) => s.removeLog);
  const logsByDate = useAppStore((s) => s.logsByDate);
  const onboarded = profile.onboarded;
  const hasHydrated = useHasHydrated();
  const mounted = useMounted();
  const auth = useAuth();
  const activeUserId = useAppStore((s) => s.activeUserId);
  const synced =
    auth.status === "signedIn" && activeUserId === auth.user.uid;

  // The diary day currently on screen (today by default). Everything below —
  // the ring, macros, week strip highlight and diary — follows this date.
  const [viewedDate, setViewedDate] = useState<string>(restoreViewedDate);

  useEffect(() => {
    if (!hasHydrated || auth.status === "loading") return;
    if (auth.status === "signedOut") {
      window.location.replace("/auth");
      return;
    }
    // Wait until the store mirrors this user's data.
    if (activeUserId !== auth.user.uid) return;
    if (!onboarded) window.location.replace("/onboarding");
  }, [hasHydrated, auth, onboarded, activeUserId]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(VIEWED_DATE_KEY, viewedDate);
    } catch {
      // Storage unavailable — ignore.
    }
  }, [viewedDate]);

  const today = todayKey();
  const isTodayView = viewedDate === today;
  const viewedDateObj = parseDateKey(viewedDate) ?? new Date();
  const viewedLabel = format(viewedDateObj, "EEEE, MMMM d");
  const relLabel =
    viewedDate === today
      ? "Today"
      : viewedDate === addDaysToKey(today, -1)
        ? "Yesterday"
        : viewedDate === addDaysToKey(today, 1)
          ? "Tomorrow"
          : "";

  const viewedLogs = useMemo(
    () => logsByDate[viewedDate] ?? NO_LOGS,
    [logsByDate, viewedDate],
  );

  const dailySummary = useMemo(() => {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const log of viewedLogs) {
      const f = logFactor(log);
      totals.calories += log.food.calories * f;
      totals.protein += log.food.protein * f;
      totals.carbs += log.food.carbs * f;
      totals.fat += log.food.fat * f;
    }
    return totals;
  }, [viewedLogs]);

  const targetCalories = profile.targetCalories ?? 2000;
  const caloriePct = targetCalories
    ? (dailySummary.calories / targetCalories) * 100
    : 0;
  const remaining = targetCalories - dailySummary.calories;

  const logsByMeal = useMemo(() => {
    const grouped: Record<MealType, FoodLog[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const log of viewedLogs) grouped[log.mealType].push(log);
    return grouped;
  }, [viewedLogs]);

  const totalMealsWithFood = MEAL_ORDER.filter(
    (m) => logsByMeal[m].length > 0,
  ).length;

  // Keep the SSR tree and the first client render identical to avoid a
  // hydration mismatch once persisted state arrives.
  if (!mounted || !synced) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!onboarded) {
    return null;
  }

  const macros = [
    {
      label: "Protein",
      consumed: dailySummary.protein,
      target: profile.targetProtein || 0,
      colors: MACRO_COLORS.Protein,
    },
    {
      label: "Carbs",
      consumed: dailySummary.carbs,
      target: profile.targetCarbs || 0,
      colors: MACRO_COLORS.Carbs,
    },
    {
      label: "Fat",
      consumed: dailySummary.fat,
      target: profile.targetFat || 0,
      colors: MACRO_COLORS.Fat,
    },
  ];

  return (
    <main className="min-h-screen pb-28">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground shadow-md">
              <Flame className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-lg font-bold leading-tight tracking-tight">
                {profile.name ? `Hi, ${profile.name}` : "Caltrack"}
              </h1>
              <p className="text-xs text-muted-foreground">{viewedLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold capitalize text-secondary-foreground">
              {profile.goal === "maintain"
                ? "Maintain"
                : profile.goal === "lose"
                  ? "Losing · 0.5kg/wk"
                  : profile.goal === "gain"
                    ? "Gaining · 0.5kg/wk"
                    : `Custom · ${profile.customCalories ?? profile.targetCalories ?? ""} kcal`}
            </span>
            <button
              onClick={() => router.push("/profile")}
              aria-label="Profile and settings"
              title="Profile & goals"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-5 px-4 pt-5">
        {/* Hero: day navigator + remaining ring + summary */}
        <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-2xl" />

          {/* Prev / next day arrows */}
          <div className="relative mb-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setViewedDate(addDaysToKey(viewedDate, -1))}
              aria-label="Previous day"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-center px-1">
              <span className="max-w-full truncate font-display text-[15px] font-bold tracking-tight tabular-nums">
                {viewedLabel}
              </span>
              {relLabel ? (
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  {relLabel}
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {format(viewedDateObj, "MMMM yyyy")}
                </span>
              )}
              {!isTodayView && (
                <button
                  onClick={() => setViewedDate(today)}
                  className="mt-0.5 text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                >
                  Back to today
                </button>
              )}
            </div>
            <button
              onClick={() => setViewedDate(addDaysToKey(viewedDate, 1))}
              aria-label="Next day"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground active:scale-95"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="relative flex flex-col items-center">
            <CalorieRing
              progress={caloriePct}
              consumed={dailySummary.calories}
              remaining={remaining}
            />
            <p className="mt-3 text-center text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {Math.round(dailySummary.calories)}
              </span>{" "}
              eaten of{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {Math.round(targetCalories)}
              </span>{" "}
              kcal
            </p>
            <div className="mt-4 flex w-full justify-center gap-2 text-xs">
              {[
                {
                  label: "Protein",
                  value: Math.round(dailySummary.protein),
                  target: profile.targetProtein || 0,
                  className: "bg-blue-500",
                },
                {
                  label: "Carbs",
                  value: Math.round(dailySummary.carbs),
                  target: profile.targetCarbs || 0,
                  className: "bg-amber-500",
                },
                {
                  label: "Fat",
                  value: Math.round(dailySummary.fat),
                  target: profile.targetFat || 0,
                  className: "bg-violet-500",
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl bg-muted/70 px-2 py-2 text-center"
                >
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                    <span className={cn("h-2 w-2 rounded-full", m.className)} />
                    {m.label}
                  </span>
                  <span className="text-[13px] font-bold leading-none tabular-nums">
                    {m.value}g{" "}
                    <span className="font-medium text-muted-foreground">
                      /{m.target}g
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Add food CTA */}
        <section className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            className="h-14 gap-2 rounded-2xl text-base shadow-md shadow-primary/20"
            onClick={() => router.push(`/search?date=${viewedDate}`)}
          >
            <Search className="h-5 w-5" />
            Search food
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-14 gap-2 rounded-2xl border-2 bg-card text-base"
            onClick={() => router.push(`/scanner?date=${viewedDate}`)}
          >
            <ScanBarcode className="h-5 w-5" />
            Scan
          </Button>
        </section>

        {/* Macros */}
        <section className="space-y-4 rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-base font-bold tracking-tight">
              Macronutrients
            </h2>
            <span className="text-xs text-muted-foreground">
              30 / 40 / 30 split
            </span>
          </div>
          {macros.map((m) => (
            <MacroBar
              key={m.label}
              label={m.label}
              consumed={m.consumed}
              target={m.target}
              colorClass={m.colors.fill}
              dotClass={m.colors.dot}
            />
          ))}
        </section>

        {/* Weight check-ins & trend */}
        <WeightCard />

        {/* Weekly summary — highlights the viewed day */}
        <WeekSummary
          logsByDate={logsByDate}
          targetCalories={targetCalories}
          macroTargets={{
            protein: profile.targetProtein || 0,
            carbs: profile.targetCarbs || 0,
            fat: profile.targetFat || 0,
          }}
          viewedDate={viewedDate}
          onSelectDay={setViewedDate}
        />

        {/* Diary for the viewed day */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="font-display text-lg font-bold tracking-tight">
              Diary
            </h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {formatDateShort(viewedDate)}
            </span>
          </div>
          {totalMealsWithFood === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
              <div className="mb-2 text-4xl">🍽️</div>
              <p className="font-semibold text-foreground">
                {isTodayView
                  ? "Nothing logged yet today"
                  : viewedDate > today
                    ? "Nothing planned for this day yet"
                    : "Nothing logged on this day yet"}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                {isTodayView
                  ? "Search for a food or scan a barcode to add your first meal."
                  : `Search for a food or scan a barcode to log it for ${formatDateShort(viewedDate)}.`}
              </p>
              <Button
                className="mt-4 rounded-2xl"
                onClick={() => router.push(`/search?date=${viewedDate}`)}
              >
                {isTodayView ? "Add your first food" : "Add food for this day"}
              </Button>
            </div>
          ) : (
            MEAL_ORDER.map((meal) => {
              const mealLogs = logsByMeal[meal];
              if (mealLogs.length === 0) return null;
              const mealKcal = mealLogs.reduce((sum, l) => sum + logCalories(l), 0);
              return (
                <div key={meal} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                      {MEAL_LABELS[meal]}
                    </h3>
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                      {Math.round(mealKcal)} kcal
                    </span>
                  </div>
                  {mealLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm"
                    >
                      {log.food.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={log.food.image}
                          alt={log.food.name}
                          className="h-12 w-12 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            No img
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="truncate text-sm font-medium">
                          {log.food.name}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {log.servings !== 1 ? `${log.servings} × ` : ""}
                          {log.portion
                            ? `${log.portion.label} (${Math.round(logGrams(log))} g)`
                            : `${Math.round(logGrams(log))} g`}{" "}
                          · {Math.round(logCalories(log))} kcal
                          {log.food.protein > 0
                            ? ` · ${Math.round(log.food.protein * logFactor(log))}p`
                            : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => removeLog(viewedDate, log.id)}
                        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
                        title="Remove"
                        aria-label="Remove entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
