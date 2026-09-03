import type { FoodItem } from "./types";
import { round } from "./tdee";

/**
 * OpenFoodFacts API helpers — 100% free, no API key required.
 * Requests go through same-origin Next.js route handlers (src/app/api/*) because
 * the OpenFoodFacts endpoints do not send CORS headers to browsers.
 *   Barcode:   /api/product/{barcode}
 *   Text search: /api/search?q=...
 */

export interface OffNutriments {
  "energy-kcal_100g"?: number | string;
  "energy_100g"?: number | string;
  "proteins_100g"?: number | string;
  "carbohydrates_100g"?: number | string;
  "fat_100g"?: number | string;
  "energy-kcal_serving"?: number | string;
  "energy_serving"?: number | string;
  "proteins_serving"?: number | string;
  "carbohydrates_serving"?: number | string;
  "fat_serving"?: number | string;
  [key: string]: unknown;
}

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  image_url?: string;
  image_front_url?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments?: OffNutriments;
}

export interface OffSearchResponse {
  count: number;
  products: OffProduct[];
}

function num(value: unknown): number {
  const n =
    typeof value === "string"
      ? parseFloat(value)
      : typeof value === "number"
        ? value
        : NaN;
  return Number.isFinite(n) ? n : 0;
}

function energyKcal(nutr: OffNutriments, basis: "100g" | "serving"): number {
  const kcal = num(nutr[`energy-kcal_${basis}`]);
  if (kcal > 0) return round(kcal, 1);
  // Fall back to kJ (energy_*) -> kcal.
  const kj = num(nutr[`energy_${basis}`]);
  return kj > 0 ? round(kj / 4.184, 1) : 0;
}

/**
 * Map an OpenFoodFacts product to our FoodItem shape.
 *
 * Like Lose It! entries, the macros are anchored to a serving: when the
 * product declares a serving (serving_quantity + per-serving nutriments) we
 * use that (e.g. "1 cup (240 ml)"), otherwise we fall back to per-100g.
 */
export function mapOffProduct(product: OffProduct | undefined): FoodItem | null {
  if (!product) return null;

  const nutr = product.nutriments ?? {};
  const servingGrams = num(product.serving_quantity);
  const hasServingNutriments =
    nutr["energy-kcal_serving"] !== undefined ||
    nutr["energy_serving"] !== undefined ||
    nutr["proteins_serving"] !== undefined;
  const useServing = hasServingNutriments && servingGrams > 0;

  const basis: "100g" | "serving" = useServing ? "serving" : "100g";
  const servingSize = useServing ? servingGrams : 100;
  const servingLabel = useServing
    ? product.serving_size || `${servingGrams} g`
    : "100 g";

  const calories = energyKcal(nutr, basis);
  const protein = round(num(nutr[`proteins_${basis}`]), 1);
  const carbs = round(num(nutr[`carbohydrates_${basis}`]), 1);
  const fat = round(num(nutr[`fat_${basis}`]), 1);

  const name =
    product.product_name ||
    product.product_name_en ||
    product.generic_name ||
    "Unknown product";
  const brand = product.brands || undefined;
  const image = product.image_url || product.image_front_url || undefined;

  return {
    id: product.code || `off-${name}-${product.brands ?? ""}`,
    name,
    brand,
    image,
    servingSize,
    servingLabel,
    calories,
    protein,
    carbs,
    fat,
  };
}

export async function fetchProductByBarcode(
  barcode: string,
): Promise<FoodItem | null> {
  try {
    const res = await fetch(`/api/product/${encodeURIComponent(barcode)}`);
    const data = (await res.json()) as { status?: number; product?: OffProduct };
    if (data.status !== 1 || !data.product) return null;
    return mapOffProduct(data.product);
  } catch {
    return null;
  }
}

export interface OffSearchResult {
  items: FoodItem[];
  /** Set when the OpenFoodFacts search service could not be reached. */
  error?: string;
}

export async function searchProductsWithStatus(
  query: string,
): Promise<OffSearchResult> {
  if (!query.trim()) return { items: [] };
  try {
    const url = new URL("/api/search", window.location.origin);
    url.searchParams.set("q", query);
    url.searchParams.set("page_size", "30");

    const res = await fetch(url.toString());
    const data = (await res.json()) as OffSearchResponse & {
      error?: string;
    };
    if (data.error) return { items: [], error: data.error };
    const items = (data.products || [])
      .map((p) => mapOffProduct(p))
      .filter((p): p is FoodItem => p !== null)
      // Skip products with no nutrition data at all.
      .filter(
        (p) => p.calories > 0 || p.protein > 0 || p.carbs > 0 || p.fat > 0,
      );
    return { items };
  } catch {
    return { items: [], error: "OpenFoodFacts could not be reached." };
  }
}

export async function searchProducts(query: string): Promise<FoodItem[]> {
  return (await searchProductsWithStatus(query)).items;
}