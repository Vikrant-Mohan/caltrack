"use client";

import { useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type FoodItem, type FoodPortion, type MealType, MEAL_LABELS } from "@/lib/types";
import { MEAL_ORDER } from "@/lib/types";
import { fetchUsdaPortions } from "@/lib/usda";
import { useAppStore } from "@/store/useAppStore";
import { todayKey } from "@/lib/date";
import { scaleFoodByGrams } from "@/lib/food-utils";
import { FoodCard } from "@/components/FoodCard";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddFoodDialogProps {
  food: FoodItem;
  /** Diary date to log into ("yyyy-MM-dd"); defaults to today. */
  dateKey?: string;
  trigger?: React.ReactElement;
  children?: React.ReactElement;
  onAdd?: () => void;
}

const SERVING_CHIPS = [0.5, 1, 1.5, 2, 3];

/** The food's base serving + any household measures (e.g. "1 slice" = 29 g). */
function servingOptions(food: FoodItem): Array<{ label: string; grams: number }> {
  const base = {
    label: food.servingLabel ?? `${food.servingSize} g`,
    grams: food.servingSize,
  };
  const seen = new Set<number>();
  seen.add(base.grams);
  const out = [base];
  for (const p of food.portions ?? []) {
    if (seen.has(p.grams)) continue;
    seen.add(p.grams);
    out.push(p);
  }
  return out;
}

/**
 * Dialog to pick a meal, a serving size (household measure or plain grams),
 * and a number of servings before logging a food. The base `food` (1 serving =
 * food.servingSize grams) is stored together with the chosen `servings` and
 * optional `portion`, so daily summaries multiply exactly once.
 */
export function AddFoodDialog({
  food,
  dateKey,
  trigger,
  children,
  onAdd,
}: AddFoodDialogProps) {
  const addLog = useAppStore((s) => s.addLog);
  const activeMeal = useAppStore((s) => s.activeMeal);
  const [open, setOpen] = useState(false);
  const [servings, setServings] = useState(1);
  const [mealType, setMealType] = useState<MealType>(activeMeal);
  // The currently selected serving basis (grams + label).
  const [baseGrams, setBaseGrams] = useState(food.servingSize);
  const [baseLabel, setBaseLabel] = useState(
    food.servingLabel ?? `${food.servingSize} g`,
  );
  // Household measures fetched lazily from the USDA detail endpoint.
  const [extraPortions, setExtraPortions] = useState<FoodPortion[]>([]);
  const [portionsLoading, setPortionsLoading] = useState(false);
  // "Custom…" mode: type any gram amount.
  const [customMode, setCustomMode] = useState(false);
  const [customGrams, setCustomGrams] = useState("");
  const sizesRef = useRef<HTMLDivElement>(null);

  const options = useMemo(
    () => servingOptions({ ...food, portions: [...(food.portions ?? []), ...extraPortions] }),
    [food, extraPortions],
  );

  const scrollSizes = (dir: number) => {
    const el = sizesRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const handleCustomGrams = (raw: string) => {
    setCustomGrams(raw);
    const grams = parseFloat(raw);
    if (Number.isFinite(grams) && grams > 0) {
      setBaseGrams(grams);
      setBaseLabel(`${grams} g`);
    }
  };



  // Reset to defaults every time the dialog opens.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setServings(1);
      setMealType(activeMeal);
      setBaseGrams(food.servingSize);
      setBaseLabel(food.servingLabel ?? `${food.servingSize} g`);
      setCustomMode(false);
      setCustomGrams("");
      // USDA search results omit household measures; fetch them lazily from
      // the detail endpoint (cached per food) when the dialog opens.
      if (food.source === "usda" && !food.portions?.length) {
        setPortionsLoading(true);
        fetchUsdaPortions(food.id.replace(/^usda-/, "")).then((portions) => {
          setExtraPortions(portions ?? []);
          setPortionsLoading(false);
        });
      }
    }
  };

  // Display-only totals for the selected serving count × selected measure.
  const scaled = scaleFoodByGrams(food, baseGrams * servings);

  const stepServings = (delta: number) =>
    setServings((s) => Math.max(0.1, Math.round((s + delta) * 10) / 10));

  const handleAdd = () => {
    const defaultLabel = food.servingLabel ?? `${food.servingSize} g`;
    addLog(dateKey ?? todayKey(), {
      food,
      mealType,
      servings,
      // Only persist a portion when it differs from the food's base serving.
      portion:
        baseGrams === food.servingSize && baseLabel === defaultLabel
          ? undefined
          : { label: baseLabel, grams: baseGrams },
    });
    onAdd?.();
    setOpen(false);
    setServings(1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ?? children ?? <FoodCard food={food} />} />
      <DialogContent className="w-[94vw] max-w-md rounded-3xl sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-lg tracking-tight">
            {food.name}
          </DialogTitle>
        </DialogHeader>

        {/* Serving selector */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Amount
          </Label>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => stepServings(-1)}
              className="h-12 w-12 shrink-0 rounded-2xl"
              aria-label="Fewer servings"
            >
              <Minus className="h-5 w-5" />
            </Button>
            <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1.5">
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={servings}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setServings(
                    Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : 0.1,
                  );
                }}
                aria-label="Servings"
                className="w-16 shrink-0 bg-transparent text-center font-display text-2xl font-bold tabular-nums outline-none"
              />
              <span className="min-w-0 flex-1 truncate text-left text-sm text-muted-foreground">
                × {baseLabel}
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => stepServings(1)}
              className="h-12 w-12 shrink-0 rounded-2xl"
              aria-label="More servings"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {SERVING_CHIPS.map((s) => (
              <button
                key={s}
                onClick={() => setServings(s)}
                className={cn(
                  "rounded-xl py-2 text-sm font-semibold transition-colors",
                  servings === s
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Grams: {Math.round(baseGrams * servings)} g
          </p>
        </div>

        {/* Household measures, e.g. "1 slice (29 g)" for USDA breads, plus a
            free-form "Custom…" gram input. Horizontally scrollable. */}
        {portionsLoading && (
          <p className="text-xs text-muted-foreground">
            Loading serving sizes…
          </p>
        )}
        {!portionsLoading && (
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Serving size
            </Label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => scrollSizes(-1)}
                aria-label="Scroll serving sizes left"
                className="flex h-9 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div
                ref={sizesRef}
                className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto px-0.5 pb-1"
              >
                {options.map((option) => {
                  const selected =
                    !customMode &&
                    option.grams === baseGrams &&
                    option.label === baseLabel;
                  return (
                    <button
                      key={option.label}
                      onClick={() => {
                        setCustomMode(false);
                        setBaseGrams(option.grams);
                        setBaseLabel(option.label);
                        setServings(1);
                      }}
                      className={cn(
                        "shrink-0 snap-start whitespace-nowrap rounded-2xl border px-3.5 py-2 text-sm font-semibold transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {option.label}
                      {option.grams !== food.servingSize && (
                        <span className={cn("ml-1 text-xs", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          ({option.grams} g)
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCustomMode(true)}
                  className={cn(
                    "shrink-0 snap-start whitespace-nowrap rounded-2xl border px-3.5 py-2 text-sm font-semibold transition-colors",
                    customMode
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "border-dashed border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {customMode && Number(customGrams) > 0
                    ? `Custom · ${customGrams} g`
                    : "Custom…"}
                </button>
              </div>
              <button
                onClick={() => scrollSizes(1)}
                aria-label="Scroll serving sizes right"
                className="flex h-9 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {customMode && (
              <div className="space-y-1.5">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={customGrams}
                  onChange={(e) => handleCustomGrams(e.target.value)}
                  placeholder="Grams, e.g. 150"
                  autoFocus
                  className="h-11 rounded-2xl text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Type any amount — e.g. 150 g of this food.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Meal */}
        <div className="space-y-2">
          <Label
            htmlFor="meal"
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            Meal
          </Label>
          <Select
            value={mealType}
            onValueChange={(v) => setMealType(v as MealType)}
          >
            <SelectTrigger id="meal" className="h-11 w-full rounded-2xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEAL_ORDER.map((m) => (
                <SelectItem key={m} value={m}>
                  {MEAL_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary */}
        <div className="rounded-2xl bg-secondary/60 p-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-semibold text-secondary-foreground">
              Total ({servings} × {baseLabel})
            </span>
            <span className="font-display text-xl font-bold tabular-nums text-foreground">
              {Math.round(scaled.calories)}{" "}
              <span className="text-xs font-semibold text-muted-foreground">
                kcal
              </span>
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-center">
            <div className="rounded-xl bg-card py-1.5">
              <span className="font-bold text-blue-600 tabular-nums">
                {Math.round(scaled.protein)}g
              </span>
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Protein
              </div>
            </div>
            <div className="rounded-xl bg-card py-1.5">
              <span className="font-bold text-amber-600 tabular-nums">
                {Math.round(scaled.carbs)}g
              </span>
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Carbs
              </div>
            </div>
            <div className="rounded-xl bg-card py-1.5">
              <span className="font-bold text-violet-600 tabular-nums">
                {Math.round(scaled.fat)}g
              </span>
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Fat
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleAdd} className="flex-1 rounded-2xl">
            Add to {MEAL_LABELS[mealType]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}