"use client";

import { cn } from "@/lib/utils";

interface CalorieRingProps {
  progress: number; // 0-100 of the target eaten
  consumed?: number; // kcal eaten
  remaining?: number; // kcal left until target
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function CalorieRing({
  progress,
  consumed,
  remaining,
  size = 190,
  strokeWidth = 16,
  className,
}: CalorieRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 100);
  const offset = circumference - (clamped / 100) * circumference;

  const overGoal = remaining !== undefined && remaining <= 0;
  const getColor = () => {
    if (overGoal) return "#ef4444";
    if (clamped >= 85) return "#f59e0b";
    return "#16a34a";
  };
  const color = getColor();

  const showDetails = consumed !== undefined;

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block -rotate-90"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-primary/10"
          strokeLinecap="round"
        />
        {/* Progress */}
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
          style={{ filter: `drop-shadow(0 2px 6px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {showDetails ? (
          <>
            <span
              className={cn(
                "font-display text-5xl font-bold leading-none tracking-tight tabular-nums",
                overGoal ? "text-red-500" : "text-primary",
              )}
            >
              {Math.max(Math.round(remaining ?? 0), 0)}
            </span>
            <span className="mt-1 text-xs font-semibold text-muted-foreground">
              {overGoal ? "kcal over budget" : "kcal remaining"}
            </span>
          </>
        ) : (
          <>
            <span className="font-display text-3xl font-bold">
              {Math.round(progress)}%
            </span>
            <span className="text-xs text-muted-foreground">of goal</span>
          </>
        )}
      </div>
    </div>
  );
}
