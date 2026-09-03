"use client";

import { useMemo, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/store/useAppStore";
import { formatDateShort, parseDateKey, todayKey } from "@/lib/date";
import { goalPaceLabel, weightPace } from "@/lib/weight";
import { WeightChart, type WeightPoint } from "@/components/WeightChart";
import { cn } from "@/lib/utils";

const MIN_KG = 20;
const MAX_KG = 600;

/**
 * Daily weight check-ins: quick upsert dialog plus the latest weight, change
 * since the first check-in, goal-pace status, and the trend chart.
 */
export function WeightCard() {
  const profile = useAppStore((s) => s.profile);
  const weightByDate = useAppStore((s) => s.weightByDate);
  const checkInWeight = useAppStore((s) => s.checkInWeight);
  const removeWeightEntry = useAppStore((s) => s.removeWeightEntry);

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayKey());
  const [weightInput, setWeightInput] = useState("");

  const entries = useMemo<WeightPoint[]>(
    () =>
      Object.entries(weightByDate)
        .map(([d, w]) => ({ date: d, weight: w }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [weightByDate],
  );

  const first = entries[0];
  const latest = entries[entries.length - 1];
  const hasEntries = entries.length > 0;

  const goal = profile.goal;
  const paceLabel = goalPaceLabel(goal);

  const openDialog = () => {
    const today = todayKey();
    const existing = weightByDate[today];
    const fallback =
      (existing ?? latest?.weight ?? profile.weight) > 0
        ? (existing ?? latest?.weight ?? profile.weight)
        : 70;
    setDate(today);
    setWeightInput(String(fallback));
    setOpen(true);
  };

  const existingOnDate = weightByDate[date];
  const parsedWeight = parseFloat(weightInput);
  const weightValid =
    Number.isFinite(parsedWeight) &&
    parsedWeight >= MIN_KG &&
    parsedWeight <= MAX_KG;

  const handleDateChange = (next: string) => {
    setDate(next);
    if (weightByDate[next] !== undefined) {
      setWeightInput(String(weightByDate[next]));
    }
  };

  const handleSave = () => {
    if (!weightValid) return;
    checkInWeight(date, Math.round(parsedWeight * 10) / 10);
    setOpen(false);
  };

  const handleRemove = () => {
    removeWeightEntry(date);
    setOpen(false);
  };

  // Stats for the latest check-in vs the first one and the goal pace.
  const stats = useMemo(() => {
    if (!first || !latest) return null;
    const daysBetween = differenceInCalendarDays(
      parseDateKey(latest.date) ?? new Date(),
      parseDateKey(first.date) ?? new Date(),
    );
    const pace = weightPace(first.weight, latest.weight, daysBetween, goal);
    const change = latest.weight - first.weight;
    // Direction that is "good" for the goal.
    const good =
      goal === "lose"
        ? change < 0
        : goal === "gain"
          ? change > 0
          : null;
    return { daysBetween, pace, change, good };
  }, [first, latest, goal]);

  const gapAbs =
    stats && stats.pace.comparable ? Math.abs(stats.pace.gap) : 0;
  const onPace = stats && stats.pace.comparable && gapAbs < 0.05;

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-bold tracking-tight">
          Weight
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={openDialog}
          className="gap-1.5 rounded-full border-primary/40 text-primary hover:bg-primary/5"
        >
          <Scale className="h-3.5 w-3.5" />
          {latest ? "Check in" : "Check in today"}
        </Button>
      </div>

      {!hasEntries || !latest ? (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-8 text-center">
          <div className="mb-2 text-4xl">⚖️</div>
          <p className="font-semibold">No weigh-ins yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {paceLabel
              ? `Log your weight to see your trend against your ${paceLabel} goal.`
              : "Log your weight each day to start spotting your trend."}
          </p>
          <Button onClick={openDialog} className="mt-4 rounded-2xl">
            Check in today
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-4xl font-bold leading-none tracking-tight tabular-nums">
                {latest.weight.toFixed(1)}
                <span className="ml-1 text-base font-semibold text-muted-foreground">
                  kg
                </span>
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                latest · {formatDateShort(latest.date)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 text-right">
              {stats && first.date !== latest.date && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
                    stats.good === null
                      ? "bg-secondary text-muted-foreground"
                      : stats.good
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600",
                  )}
                >
                  {stats.change > 0 ? "+" : ""}
                  {stats.change.toFixed(1)} kg since{" "}
                  {formatDateShort(first.date)}
                </span>
              )}
              {stats && stats.pace.comparable && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    onPace
                      ? "bg-emerald-500/10 text-emerald-600"
                      : stats.pace.ahead
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600",
                  )}
                >
                  {onPace
                    ? `On your ${paceLabel} pace`
                    : `${gapAbs.toFixed(1)} kg ${
                        stats.pace.ahead ? "ahead of" : "behind"
                      } your ${paceLabel} pace`}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4">
            <WeightChart entries={entries} goal={goal} />
          </div>

          {entries.length > 0 && (
            <div className="mt-1 flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-3 rounded-full bg-emerald-600" />
                You
              </span>
              {paceLabel && (
                <span className="flex items-center gap-1.5">
                  <span className="h-0 w-4 border-t-2 border-dashed border-slate-400" />
                  {paceLabel} goal pace
                </span>
              )}
            </div>
          )}
          {entries.length === 1 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Check in again tomorrow to start plotting your trend.
            </p>
          )}
          {!paceLabel && hasEntries && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Set a Lose or Gain goal (onboarding) to compare against a pace
              line.
            </p>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[94vw] max-w-md rounded-3xl sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-lg tracking-tight">
              {existingOnDate !== undefined
                ? `Update check-in · ${formatDateShort(date)}`
                : "Weight check-in"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="weight-kg"
                className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                Weight (kg)
              </Label>
              <div className="relative">
                <Input
                  id="weight-kg"
                  type="number"
                  inputMode="decimal"
                  min={MIN_KG}
                  max={MAX_KG}
                  step={0.1}
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder="e.g. 75.0"
                  autoFocus
                  className="h-12 rounded-2xl pr-12 text-lg tabular-nums"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  kg
                </span>
              </div>
              {weightInput !== "" && !weightValid && (
                <p className="text-xs text-red-500">
                  Enter a weight between {MIN_KG} and {MAX_KG} kg.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="weight-date"
                className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
              >
                Date
              </Label>
              <Input
                id="weight-date"
                type="date"
                value={date}
                max={todayKey()}
                onChange={(e) => handleDateChange(e.target.value)}
                className="h-12 rounded-2xl"
              />
              <p className="text-xs text-muted-foreground">
                One entry per day — picking a date with an existing check-in
                lets you edit it.
              </p>
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            {existingOnDate !== undefined ? (
              <Button
                variant="ghost"
                onClick={handleRemove}
                className="mr-auto rounded-2xl text-red-500 hover:bg-red-50 hover:text-red-600"
              >
                Remove entry
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="rounded-2xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!weightValid}
                className="flex-1 rounded-2xl"
              >
                {existingOnDate !== undefined ? "Update" : "Save check-in"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
