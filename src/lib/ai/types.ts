/** Confidence the AI has in a single detected food item. */
export type EstimateConfidence = "low" | "medium" | "high";

/**
 * One food item detected in a meal photo, as returned by the vision model.
 * Macro amounts are totals for the estimated portion (not per 100 g).
 */
export interface MealPhotoItem {
  name: string;
  portionGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: EstimateConfidence;
}

/** Sanitized result of one photo analysis. */
export interface PhotoEstimateResult {
  items: MealPhotoItem[];
}

export interface AiSettings {
  /** Google AI Studio (Gemini) API key, stored only on this device. */
  apiKey: string;
  /** Model id override, e.g. "gemini-2.5-flash". */
  model?: string;
}

/** Model used when the user has not chosen an override. */
export const DEFAULT_AI_MODEL = "gemini-2.5-flash";
