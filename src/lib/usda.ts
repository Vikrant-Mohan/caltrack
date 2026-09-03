import type { FoodItem, FoodPortion } from "./types";
import { round } from "./tdee";

/**
 * USDA FoodData Central (FDC) helpers.
 *
 * FDC covers generic foods that OpenFoodFacts — being a product database —
 * often misses (e.g. "Bread, whole wheat, commercially prepared"). It is a
 * free service but requires an API key (sign up: https://fdc.nal.usda.gov/api-key-signup.html).
 * Requests go through the same-origin route handler /api/fdc/search, which
 * reads the key from the FDC_API_KEY environment variable. Without a key the
 * route returns an empty result and the app falls back to OpenFoodFacts.
 */

export interface FdcFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  foodNutrients?: Array<{
    nutrientId?: number;
    nutrientName?: string;
    nutrientNumber?: string;
    unitName?: string;
    value?: number | null;
  }>;
  foodPortions?: Array<{
    measureUnit?: { id?: number; name?: string; abbreviation?: string };
    gramWeight?: number | null;
    amount?: number | null;
    modifier?: string | null;
    portionDescription?: string | null;
  }>;
}

export interface FdcSearchResponse {
  foods?: FdcFood[];
  totalHits?: number;
}

// Stable FDC nutrient ids:
// 1008 = Energy (kcal), 1003 = Protein, 1005 = Carbohydrate by difference,
// 1004 = Total lipid (fat). Generic FDC foods report per 100 g.
const KCAL_ID = 1008;
const PROTEIN_ID = 1003;
const CARBS_ID = 1005;
const FAT_ID = 1004;

function nutrientValue(
  nutrients: FdcFood["foodNutrients"] | undefined,
  nutrientId: number,
): number {
  const match = (nutrients ?? []).find(
    (n) => n.nutrientId === nutrientId && n.value != null,
  );
  return match?.value ? Number(match.value) : 0;
}

/**
 * Map an FDC food to our FoodItem shape (all values are per 100 g).
 */
export function mapFdcFood(food: FdcFood | undefined): FoodItem | null {
  if (!food || !food.description) return null;
  const nutrients = food.foodNutrients;

  const calories = round(nutrientValue(nutrients, KCAL_ID), 1);
  const protein = round(nutrientValue(nutrients, PROTEIN_ID), 1);
  const carbs = round(nutrientValue(nutrients, CARBS_ID), 1);
  const fat = round(nutrientValue(nutrients, FAT_ID), 1);

  // Skip foods that carry no nutrient values at all.
  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null;

  return {
    id: `usda-${food.fdcId}`,
    name: food.description.replace(/\s+/g, " ").trim(),
    brand: food.brandOwner || undefined,
    source: "usda",
    servingSize: 100,
    servingLabel: "100 g",
    portions: mapFoodPortions(food.foodPortions),
    calories,
    protein,
    carbs,
    fat,
  };
}

/**
 * FDC ships household measures (foodPortions) like "1 slice", "1 cup", "1 oz"
 * with exact gram weights. Map them so the add dialog can offer, e.g.,
 * "1 slice (29 g)" alongside the plain "100 g" base serving.
 */
function mapFoodPortions(
  portions: FdcFood["foodPortions"] | undefined,
): FoodPortion[] | undefined {
  if (!portions || portions.length === 0) return undefined;
  const seen = new Set<string>();
  const out: FoodPortion[] = [];
  for (const p of portions) {
    const grams = Number(p.gramWeight);
    if (!Number.isFinite(grams) || grams <= 0) continue;

    let label = p.portionDescription?.trim() || "";
    if (!label) {
      const amount = p.amount != null ? Number(p.amount) : 1;
      // On the /food/{id} detail endpoint the measure unit is usually
      // "undetermined" and the real description lives in `modifier`
      // (e.g. "slice", "slice, thin", "cup, cubes").
      const unit =
        p.modifier ||
        p.measureUnit?.name ||
        p.measureUnit?.abbreviation ||
        "serving";
      label = `${formatAmount(amount)} ${unit}`.trim();
    }
    // Normalize "1.0 slice" -> "1 slice" and collapse whitespace.
    label = label.replace(/(\d)\.0(?=\D|$)/g, "$1").replace(/\s+/g, " ").trim();
    // Skip FNDDS placeholders that aren't real measures.
    if (!label || /not specified|unspecified|undetermined/i.test(label)) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, grams });
    if (out.length >= 8) break;
  }
  // Smallest measures first ("1 slice" before "1 loaf").
  out.sort((a, b) => a.grams - b.grams);
  return out.length > 0 ? out : undefined;
}

function formatAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : String(round(amount, 1));
}

export interface UsdaSearchResult {
  items: FoodItem[];
  /** True when no FDC_API_KEY is configured server-side. */
  noKey?: boolean;
  /** Set when the USDA FoodData Central service could not be reached. */
  error?: string;
}

export async function searchUsdaWithStatus(
  query: string,
): Promise<UsdaSearchResult> {
  if (!query.trim()) return { items: [] };
  try {
    const url = new URL("/api/fdc/search", window.location.origin);
    url.searchParams.set("q", query);
    url.searchParams.set("page_size", "20");

    const res = await fetch(url.toString());
    const data = (await res.json()) as FdcSearchResponse & {
      noApiKey?: boolean;
      error?: string;
    };
    if (data.error) return { items: [], error: data.error };
    const items = (data.foods ?? [])
      .map((f) => mapFdcFood(f))
      .filter((f): f is FoodItem => f !== null);
    return { items, noKey: data.noApiKey };
  } catch {
    return { items: [], error: "USDA FoodData Central could not be reached." };
  }
}

export async function searchUsda(query: string): Promise<FoodItem[]> {
  return (await searchUsdaWithStatus(query)).items;
}

/** Normalize a food name for cheap duplicate detection across databases. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// FDC search responses omit foodPortions for generic foods, but the per-food
// detail endpoint (/v1/food/{id}) includes them ("1 slice" = 29 g, "1 cup"…).
// We fetch them lazily when the add-food dialog opens, once per food per
// session.
const portionsCache = new Map<string, FoodPortion[] | undefined>();

export async function fetchUsdaPortions(
  fdcId: string,
): Promise<FoodPortion[] | undefined> {
  if (portionsCache.has(fdcId)) return portionsCache.get(fdcId);
  try {
    const res = await fetch(`/api/fdc/food/${encodeURIComponent(fdcId)}`);
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      foodPortions?: FdcFood["foodPortions"];
    };
    const portions = mapFoodPortions(data.foodPortions);
    portionsCache.set(fdcId, portions);
    return portions;
  } catch {
    return undefined;
  }
}
