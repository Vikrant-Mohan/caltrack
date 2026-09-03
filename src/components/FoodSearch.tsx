"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search as SearchIcon,
  Loader2,
  ScanBarcode,
  History,
  CalendarDays,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchProductsWithStatus } from "@/lib/openfoodfacts";
import { searchUsdaWithStatus, normalizeName } from "@/lib/usda";
import { AddFoodDialog } from "@/components/AddFoodDialog";
import { FoodCard } from "@/components/FoodCard";
import { COMMON_FOODS } from "@/lib/common-foods";
import { useAppStore } from "@/store/useAppStore";
import { formatDateLong, todayKey } from "@/lib/date";
import type { FoodItem } from "@/lib/types";

interface SearchOutcome {
  foods: FoodItem[];
  /** Human-readable notices about unavailable/disabled sources. */
  notices: string[];
}

/** Combine USDA (authoritative generics) and OpenFoodFacts, deduped by name. */
async function searchAllFoods(query: string): Promise<SearchOutcome> {
  const [usda, off] = await Promise.all([
    searchUsdaWithStatus(query),
    searchProductsWithStatus(query),
  ]);
  const notices: string[] = [];
  if (usda.noKey) {
    notices.push(
      "USDA generic foods aren't enabled — add a free FDC_API_KEY for better results (see .env.local.example).",
    );
  }
  if (usda.error) notices.push(usda.error);
  if (off.error) notices.push(off.error);

  const seen = new Set<string>();
  const out: FoodItem[] = [];
  for (const food of [...usda.items, ...off.items]) {
    const key = normalizeName(food.name) + "|" + normalizeName(food.brand ?? "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(food);
  }
  return { foods: out, notices };
}

/**
 * Debounced food search across USDA + OpenFoodFacts. Each result row opens an
 * AddFoodDialog so the user can pick a serving and meal before logging. Foods
 * are logged into `dateKey` (defaults to today) so users can back-fill past
 * days or pre-log future ones.
 */
export function FoodSearch({ dateKey }: { dateKey?: string }) {
  const router = useRouter();
  const targetDate = dateKey ?? todayKey();
  const loggingToday = targetDate === todayKey();
  const recentFoods = useAppStore((s) => s.recentFoods);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  // The query whose results are currently shown in `results`.
  const [settledQuery, setSettledQuery] = useState("");
  const requestId = useRef(0);

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;
  // True while the debounce timer or the network request is pending.
  const searching = hasQuery && settledQuery !== trimmed;

  useEffect(() => {
    if (trimmed.length < 2) return;
    const id = ++requestId.current;
    const handler = setTimeout(async () => {
      const found = await searchAllFoods(trimmed);
      if (id === requestId.current) {
        setResults(found.foods);
        setNotices(found.notices);
        setSettledQuery(trimmed);
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [trimmed]);

  const showNoResults = hasQuery && !searching && results.length === 0;

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder={'Search foods, e.g. "peanut butter"…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 rounded-2xl border-2 border-border bg-card pl-11 pr-10 text-base shadow-sm focus-visible:border-primary"
          autoFocus
        />
        {searching && (
          <Loader2 className="absolute right-3.5 top-3.5 h-5 w-5 animate-spin text-primary" />
        )}
      </div>

      {!loggingToday && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-3.5 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">
              Adding to {formatDateLong(targetDate)}
            </span>
          </span>
          <button
            onClick={() => router.push("/search")}
            className="shrink-0 text-xs font-bold text-primary hover:underline"
          >
            Today
          </button>
        </div>
      )}

      <Button
        variant="outline"
        className="h-11 w-full gap-2 rounded-2xl border-2 bg-card"
        onClick={() => router.push(`/scanner?date=${targetDate}`)}
      >
        <ScanBarcode className="h-4 w-4" />
        Scan a barcode instead
      </Button>

      {searching && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Searching USDA FoodData Central + OpenFoodFacts…
        </p>
      )}

      {showNoResults && (
        <div className="py-4 text-center">
          <p className="text-sm text-muted-foreground">
            No foods found for &quot;{query}&quot;. Try a simpler term.
          </p>
          {notices.map((notice, i) => (
            <p key={i} className="mx-auto mt-2 max-w-sm text-xs text-amber-600 dark:text-amber-400">
              {notice}
            </p>
          ))}
        </div>
      )}

      {results.length > 0 && !searching && notices.length > 0 && (
        <div className="space-y-1 rounded-2xl border border-amber-500/30 bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          {notices.map((notice, i) => (
            <p key={i}>{notice}</p>
          ))}
        </div>
      )}

      {results.length > 0 && !searching && (
        <div className="space-y-2">
          {notices.length === 0 && (
            <p className="text-xs font-medium text-muted-foreground">
              USDA generic foods come first; branded products from OpenFoodFacts
              follow. Tap a food to choose a serving size and meal.
            </p>
          )}
          <div className="space-y-2">
            {results.map((food) => (
              <QuickFood key={food.id} food={food} dateKey={targetDate} />
            ))}
          </div>
        </div>
      )}

      {!hasQuery && (
        <div className="space-y-5">
          {recentFoods.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <History className="h-3.5 w-3.5" /> Recent
              </h2>
              <div className="space-y-2">
                {recentFoods.slice(0, 5).map((food) => (
                  <QuickFood
                    key={food.id}
                    food={food}
                    dateKey={targetDate}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Quick picks
            </h2>
            <div className="space-y-2">
              {COMMON_FOODS.slice(0, 6).map((food) => (
                <QuickFood key={food.id} food={food} dateKey={targetDate} />
              ))}
            </div>
          </section>

          <p className="pb-2 text-center text-xs text-muted-foreground">
            Can&apos;t find it? Search the free OpenFoodFacts database above —
            no account needed.
          </p>
        </div>
      )}
    </div>
  );
}

/** A food row that opens the serving/meal dialog on tap. */
function QuickFood({ food, dateKey }: { food: FoodItem; dateKey: string }) {
  return (
    <AddFoodDialog food={food} dateKey={dateKey}>
      <FoodCard food={food} dateKey={dateKey} onAdd={() => {}} />
    </AddFoodDialog>
  );
}