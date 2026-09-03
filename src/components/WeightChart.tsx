"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Goal } from "@/lib/types";
import { addDaysToKey, parseDateKey, todayKey } from "@/lib/date";
import { goalRateKgPerDay } from "@/lib/weight";

export interface WeightPoint {
  date: string; // "yyyy-MM-dd"
  weight: number; // kg
}

interface WeightChartProps {
  /** Entries sorted oldest → newest. */
  entries: WeightPoint[];
  goal: Goal;
}

const MAX_DAYS = 1100; // hard cap on the span we rasterize

/**
 * Plots the user's weight check-ins against the dashed goal-pace line that
 * starts at the first check-in and slopes at ±0.5 kg/week toward today.
 */
export function WeightChart({ entries, goal }: WeightChartProps) {
  const rows = useMemo(() => {
    if (entries.length === 0) return [];
    const first = entries[0];
    const last = entries[entries.length - 1];
    // Anchor the goal line on the first entry and run it out to today (or the
    // last entry, if check-ins stopped).
    const endDate =
      last.date > todayKey() || last.date === todayKey() ? last.date : todayKey();
    const slope = goalRateKgPerDay(goal);

    const byDay = new Map<string, { weight?: number; goal?: number }>();
    for (const e of entries) {
      byDay.set(e.date, { weight: e.weight });
    }

    let day = first.date;
    let guard = 0;
    while (day <= endDate && guard < MAX_DAYS) {
      const start = parseDateKey(first.date);
      const current = parseDateKey(day);
      if (start && current) {
        const elapsedDays = Math.round(
          (current.getTime() - start.getTime()) / 86_400_000,
        );
        const row = byDay.get(day) ?? {};
        row.goal = first.weight + slope * elapsedDays;
        byDay.set(day, row);
      }
      if (day === endDate) break;
      day = addDaysToKey(day, 1);
      guard++;
    }

    return [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, row]) => ({
        ts: (parseDateKey(date) ?? new Date()).getTime(),
        actual: row.weight,
        goal: row.goal,
      }));
  }, [entries, goal]);

  if (rows.length < 2) return null;

  const values = rows.flatMap((r) => [r.actual, r.goal]).filter((v): v is number => v !== undefined);
  const lo = values.length ? Math.min(...values) - 0.5 : 0;
  const hi = values.length ? Math.max(...values) + 0.5 : 100;

  const fmtTs = (ts: number) => format(new Date(ts), "MMM d");

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/30" />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={fmtTs}
            tick={{ fontSize: 10 }}
            tickCount={Math.min(rows.length, 5)}
            stroke="currentColor"
            className="text-muted-foreground/70"
          />
          <YAxis
            domain={[lo, hi]}
            tickFormatter={(v: number) => `${Math.round(v * 10) / 10}`}
            tick={{ fontSize: 10 }}
            width={38}
            stroke="currentColor"
            className="text-muted-foreground/70"
          />
          <Tooltip
            content={<ChartTip />}
            cursor={{ stroke: "currentColor", className: "text-muted/40" }}
          />
          {rows.some((r) => r.goal !== undefined) && (
            <Line
              type="linear"
              dataKey="goal"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
          <Line
            type="linear"
            dataKey="actual"
            stroke="#16a34a"
            strokeWidth={2.5}
            dot={{ r: 3.5, strokeWidth: 0, fill: "#16a34a" }}
            activeDot={{ r: 5 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTip(props: {
  active?: boolean;
  label?: number;
  payload?: Array<{ name?: string; value?: number }>;
}) {
  const { active, label, payload } = props;
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs shadow-md">
      <p className="mb-0.5 font-bold">{label ? fmtTipLabel(label) : ""}</p>
      {payload
        .filter((p) => p.value !== undefined)
        .map((p) => (
          <p key={p.name ?? "v"} className="text-muted-foreground">
            {p.name === "actual" ? "You" : "Goal"} ·{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {Number(p.value).toFixed(1)} kg
            </span>
          </p>
        ))}
    </div>
  );
}

function fmtTipLabel(ts: number): string {
  return format(new Date(ts), "EEE, MMM d");
}
