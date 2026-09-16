"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type FoodItem, type MealType, MEAL_LABELS } from "@/lib/types";
import type { EstimateConfidence, MealPhotoItem } from "@/lib/ai/types";
import { scaleFoodByGrams } from "@/lib/food-utils";
import { photoItemToFoodItem } from "@/lib/ai/gemini";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

interface PhotoResultCardProps {
  item: MealPhotoItem;
  /** Current edited name/grams live in the parent (needed for bulk add). */
  name: string;
  grams: number;
  mealType: MealType;
  included: boolean;
  onChangeName: (name: string) => void;
  onChangeGrams: (grams: number) => void;
  onChangeMeal: (meal: MealType) => void;
  onToggleIncluded: (included: boolean) => void;
}

const CONFIDENCE_STYLES: Record<EstimateConfidence, string> = {
  high: "bg-emerald-600/10 text-emerald-700",
  medium: "bg-amber-600/10 text-amber-700",
  low: "bg-rose-600/10 text-rose-700",
};

/**
 * One editable AI-detected food item. The macro row rescales live when the
 * user edits grams; editing is disabled entirely while the item is excluded.
 */
export function PhotoResultCard({
  item,
  name,
  grams,
  mealType,
  included,
  onChangeName,
  onChangeGrams,
  onChangeMeal,
  onToggleIncluded,
}: PhotoResultCardProps) {
  // Anchor for rescaling: the AI's original estimate as a FoodItem.
  const base = useMemo(() => photoItemToFoodItem(item, 0), [item]);
  const scaled = useMemo<FoodItem>(
    () => scaleFoodByGrams(base, grams),
    [base, grams],
  );
  const confidence = item.confidence;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-3 shadow-sm transition-opacity",
        !included && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => onChangeName(e.target.value)}
              disabled={!included}
              className="h-9 flex-1 rounded-xl text-sm font-semibold"
              aria-label="Food name"
            />
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                CONFIDENCE_STYLES[confidence],
              )}
              title="AI confidence in this item"
            >
              {confidence}
            </span>
          </div>

          <div className="flex items-end gap-2">
            <div className="w-24 space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Grams
              </Label>
              <Input
                type="number"
                min={1}
                max={5000}
                value={grams}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onChangeGrams(Number.isFinite(v) && v > 0 ? Math.min(v, 5000) : 1);
                }}
                disabled={!included}
                className="h-9 rounded-xl tabular-nums"
                aria-label={`Grams of ${item.name}`}
              />
            </div>
            <div className="flex flex-1 gap-1 pb-0.5 text-center">
              <div className="flex-1 rounded-xl bg-secondary/60 py-1.5">
                <span className="text-xs font-bold text-blue-600 tabular-nums">
                  {Math.round(scaled.protein)}g
                </span>
                <div className="text-[9px] font-semibold uppercase text-muted-foreground">
                  P
                </div>
              </div>
              <div className="flex-1 rounded-xl bg-secondary/60 py-1.5">
                <span className="text-xs font-bold text-amber-600 tabular-nums">
                  {Math.round(scaled.carbs)}g
                </span>
                <div className="text-[9px] font-semibold uppercase text-muted-foreground">
                  C
                </div>
              </div>
              <div className="flex-1 rounded-xl bg-secondary/60 py-1.5">
                <span className="text-xs font-bold text-violet-600 tabular-nums">
                  {Math.round(scaled.fat)}g
                </span>
                <div className="text-[9px] font-semibold uppercase text-muted-foreground">
                  F
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-sm font-bold tabular-nums text-foreground">
              {Math.round(scaled.calories)}{" "}
              <span className="text-xs font-semibold text-muted-foreground">
                kcal
              </span>
            </span>
            <Select
              value={mealType}
              onValueChange={(v) => onChangeMeal(v as MealType)}
              disabled={!included}
            >
              <SelectTrigger className="h-8 w-[130px] rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MEAL_LABELS) as MealType[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {MEAL_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <button
          role="switch"
          aria-checked={included}
          aria-label={`Include ${item.name}`}
          onClick={() => onToggleIncluded(!included)}
          className={cn(
            "mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors",
            included ? "justify-end bg-primary" : "justify-start bg-muted",
          )}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow" />
        </button>
      </div>
    </div>
  );
}
