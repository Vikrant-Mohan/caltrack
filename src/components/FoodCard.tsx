"use client";

import { type FoodItem, MEAL_LABELS } from "@/lib/types";
import { Plus, Apple } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { todayKey } from "@/lib/date";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface FoodCardProps extends React.ComponentProps<"div"> {
  food: FoodItem;
  /** Diary date to quick-add into ("yyyy-MM-dd"); defaults to today. */
  dateKey?: string;
  onAdd?: () => void;
}

/**
 * A compact food row. When wrapped in a dialog trigger, extra props (onClick,
 * etc.) are spread onto the root so the trigger stays interactive.
 */
export function FoodCard({ food, dateKey, onAdd, className, ...rest }: FoodCardProps) {
  const addLog = useAppStore((s) => s.addLog);
  const activeMeal = useAppStore((s) => s.activeMeal);

  const handleQuickAdd = (e: React.MouseEvent) => {
    // Don't let the click bubble up to a wrapping dialog trigger.
    e.stopPropagation();
    addLog(dateKey ?? todayKey(), {
      food,
      mealType: activeMeal,
      servings: 1,
    });
    onAdd?.();
  };

  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.03]",
        className,
      )}
      {...rest}
    >
      {food.image ? (
        <Image
          src={food.image}
          alt={food.name}
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground/60">
          <Apple className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold leading-tight">
            {food.name}
          </p>
          {food.source === "usda" && (
            <span className="shrink-0 rounded bg-emerald-600/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
              USDA
            </span>
          )}
        </div>
        {food.brand && (
          <p className="truncate text-xs text-muted-foreground">
            {food.brand}
          </p>
        )}
        <p className="text-xs text-muted-foreground tabular-nums">
          <span className="font-bold text-foreground">
            {Math.round(food.calories)}
          </span>{" "}
          kcal · <span className="text-muted-foreground/80">per {food.servingLabel ?? `${food.servingSize} g`}</span>
          <span className="ml-1.5 text-muted-foreground/60">
            P {food.protein} · C {food.carbs} · F {food.fat}
          </span>
        </p>
      </div>
      {onAdd !== undefined && (
        <button
          onClick={handleQuickAdd}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 transition-transform active:scale-90"
          title={`Quick-add to ${MEAL_LABELS[activeMeal]}`}
          aria-label={`Quick-add ${food.name}`}
        >
          <Plus className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}