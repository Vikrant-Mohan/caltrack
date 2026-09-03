"use client";

import { format } from "date-fns";
import type { FoodLog } from "@/lib/types";
import { parseDateKey, todayKey, weekDaysFor } from "@/lib/date";
import { logCalories, logFactor } from "@/lib/food-utils";
import { MacroBar } from "@/components/MacroBar";
import { cn } from "@/lib/utils";

/** Status colors: green under budget, amber near, red over. */
function ringColor(pct: number, net: number): string {
  if (net <= 0) return "#ef4444";
  if (pct >= 85) return "#f59e0b";
  return "#16a34a";
}

function MiniRing({ pct, color }: { pct: number; color: string }) {
  const size = 42;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(pct, 0), 100);
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/50"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

interface WeekSummaryProps {
  logsByDate: Record<string, FoodLog[]>;
  targetCalories: number;
  /** Daily macro targets (the 30/40/30 split) that averages are compared to. */
  macroTargets?: { protein: number; carbs: number; fat: number };
  /** The diary's currently viewed date — highlighted in the strip. */
  viewedDate: string;
  /** Called when the user taps a day in the strip. */
  onSelectDay: (dateKey: string) => void;
}

/**
 * The Monday→Sunday week containing the viewed day. Each cell shows a mini
 * ring with that day's net calories; tapping a day hands it back to the
 * dashboard, which opens it in the diary below.
 */
export function WeekSummary({
  logsByDate,
  targetCalories,
  macroTargets,
  viewedDate,
  onSelectDay,
}: WeekSummaryProps) {
  const today = todayKey();

  const days = weekDaysFor(viewedDate).map((key) => {
    const date = parseDateKey(key) ?? new Date();
    const logs = logsByDate[key] ?? [];
    const eaten = logs.reduce((sum, l) => sum + logCalories(l), 0);
    const macros = logs.reduce(
      (acc, l) => {
        const f = logFactor(l);
        return {
          protein: acc.protein + l.food.protein * f,
          carbs: acc.carbs + l.food.carbs * f,
          fat: acc.fat + l.food.fat * f,
        };
      },
      { protein: 0, carbs: 0, fat: 0 },
    );
    const net = targetCalories - eaten;
    const pct = targetCalories ? (eaten / targetCalories) * 100 : 0;
    return {
      key,
      date,
      isToday: key === today,
      isViewed: key === viewedDate,
      eaten,
      macros,
      net,
      pct,
      color: ringColor(pct, net),
    };
  });

  const isCurrentWeek = days.some((d) => d.isToday);

  // Average eaten per day across the seven days shown in the strip, compared
  // against the daily 30/40/30 targets.
  const macroAverages = (["protein", "carbs", "fat"] as const).map(
    (macro) => {
      const total = days.reduce((sum, d) => sum + d.macros[macro], 0);
      return { macro, perDay: total / 7 };
    },
  );

  const netStr = (net: number) => {
    const r = Math.round(net);
    return r > 0
      ? `+${r.toLocaleString()}`
      : r < 0
        ? `−${Math.abs(r).toLocaleString()}`
        : "0";
  };

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-display text-base font-bold tracking-tight">
          {isCurrentWeek ? "This week" : `Week of ${format(days[0].date, "MMM d")}`}
        </h2>
        <span className="text-xs text-muted-foreground">
          budget {Math.round(targetCalories)} kcal
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Net = budget − eaten. Tap a day to open it in your diary.
      </p>

      {/* 7 day cells (Monday → Sunday of the viewed date's week) */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => (
          <button
            key={d.key}
            onClick={() => onSelectDay(d.key)}
            aria-pressed={d.isViewed}
            aria-label={`${format(d.date, "EEEE, MMM d")}, ${Math.round(d.eaten)} kcal eaten, ${netStr(d.net)} net`}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl px-0.5 py-2 transition-colors",
              d.isViewed
                ? "bg-primary/10 ring-1 ring-primary/50"
                : "hover:bg-muted/70",
            )}
          >
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wide tabular-nums",
                d.isViewed
                  ? "text-primary"
                  : d.isToday
                    ? "text-foreground"
                    : "text-muted-foreground",
              )}
            >
              {format(d.date, "EEE d")}
            </span>
            <MiniRing pct={d.pct} color={d.color} />
            <span
              className={cn(
                "text-[11px] font-bold leading-none tabular-nums",
                d.net < 0
                  ? "text-red-500"
                  : d.isViewed
                    ? "text-primary"
                    : "text-emerald-600",
              )}
            >
              {netStr(d.net)}
            </span>
            <span className="flex items-center gap-1 text-[9px] leading-none text-muted-foreground tabular-nums">
              {d.isToday && !d.isViewed && (
                <span className="inline-block h-1 w-1 rounded-full bg-primary" />
              )}
              {Math.round(d.eaten).toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {/* Average macros per day vs the 30/40/30 targets */}
      {macroTargets && (
        <div className="mt-4 space-y-3 rounded-2xl bg-secondary/40 p-3">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Daily average macros
            </p>
            <span className="text-[11px] font-medium text-muted-foreground">
              {format(days[0].date, "MMM d")} – {format(days[6].date, "MMM d")}
            </span>
          </div>
          {macroAverages.map(({ macro, perDay }) => {
            const target = macroTargets[macro] || 0;
            const styles = {
              protein: { label: "Protein", color: "bg-blue-500" },
              carbs: { label: "Carbs", color: "bg-amber-500" },
              fat: { label: "Fat", color: "bg-violet-500" },
            }[macro];
            return (
              <MacroBar
                key={macro}
                label={`${styles.label} / day`}
                consumed={perDay}
                target={target}
                colorClass={styles.color}
              />
            );
          })}
          <p className="text-[11px] leading-snug text-muted-foreground">
            Average eaten per day across the week, compared with your 30 / 40 /
            30 daily targets.
          </p>
        </div>
      )}
    </section>
  );
}
