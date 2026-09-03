"use client";

import { cn } from "@/lib/utils";

interface MacroBarProps {
  label: string;
  consumed: number;
  target: number;
  unit?: string;
  /** Tailwind bg class for the fill, e.g. "bg-blue-500". */
  colorClass?: string;
  /** Dot color for the label, falls back to colorClass. */
  dotClass?: string;
}

export function MacroBar({
  label,
  consumed,
  target,
  unit = "g",
  colorClass = "bg-green-500",
  dotClass,
}: MacroBarProps) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  const isOver = target > 0 && consumed > target;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              dotClass ?? (isOver ? "bg-red-500" : colorClass),
            )}
          />
          {label}
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              isOver ? "text-red-500" : "text-muted-foreground",
            )}
          >
            {Math.round(consumed)}/{Math.round(target)}
            {unit}
          </span>
        </span>
        <span
          className={cn(
            "text-xs font-bold tabular-nums",
            isOver ? "text-red-500" : "text-muted-foreground",
          )}
        >
          {target > 0 ? Math.round((consumed / target) * 100) : 0}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            isOver ? "bg-red-500" : colorClass,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}