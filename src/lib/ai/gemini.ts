import type { FoodItem } from "../types";
import { round } from "../tdee";
import {
  type MealPhotoItem,
  type PhotoEstimateResult,
  type EstimateConfidence,
  DEFAULT_AI_MODEL,
} from "./types";

/**
 * Google AI Studio (Gemini) client for meal-photo estimation.
 *
 * Bring-your-own-key: the key lives on the user's device (zustand persist)
 * and requests go browser → Gemini directly, so nothing touches our server.
 * Responses are forced into JSON with `responseSchema` (structured output),
 * so no fragile free-text parsing.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Upper bounds so a bad/hallucinated response can't poison the diary. */
const MAX_ITEMS = 12;
const MAX_GRAMS = 5000;
const MAX_KCAL = 3000;
const MAX_MACRO_G = 500;

/** Permitted tokens for `confidence`; anything else maps to "low". */
const CONFIDENCES: EstimateConfidence[] = ["low", "medium", "high"];

export class AiNotConfiguredError extends Error {
  constructor() {
    super("Add your Gemini API key in Profile to scan meal photos.");
    this.name = "AiNotConfiguredError";
  }
}

export class AiRequestError extends Error {
  constructor(
    message: string,
    /** HTTP status from Gemini, when the failure came from the API. */
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiRequestError";
  }
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { code?: number; message?: string };
}

function clamp(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, min), max);
}

function asConfidence(value: unknown): EstimateConfidence {
  return CONFIDENCES.includes(value as EstimateConfidence)
    ? (value as EstimateConfidence)
    : "low";
}

/**
 * Drop unusable entries and clamp the rest. An item is unusable when it has
 * no name, or every nutrition value is zero (the model sometimes returns
 * placeholder rows for ambiguous objects).
 */
function sanitizeItems(raw: unknown): MealPhotoItem[] {
  if (!Array.isArray(raw)) return [];
  const items: MealPhotoItem[] = [];
  for (const entry of raw.slice(0, MAX_ITEMS)) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const name = typeof e.name === "string" ? e.name.trim().slice(0, 80) : "";
    if (!name) continue;
    const grams = clamp(e.portion_grams ?? e.portionGrams, 1, MAX_GRAMS);
    const calories = clamp(e.calories, 0, MAX_KCAL);
    const protein = clamp(e.protein_g ?? e.protein, 0, MAX_MACRO_G);
    const carbs = clamp(e.carbs_g ?? e.carbs, 0, MAX_MACRO_G);
    const fat = clamp(e.fat_g ?? e.fat, 0, MAX_MACRO_G);
    if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) continue;
    items.push({
      name,
      portionGrams: Math.round(grams),
      calories: round(calories, 0),
      protein: round(protein, 1),
      carbs: round(carbs, 1),
      fat: round(fat, 1),
      confidence: asConfidence(e.confidence),
    });
  }
  return items;
}

/**
 * Estimate the foods in a meal photo with Gemini.
 *
 * @param base64Jpeg JPEG image, base64-encoded (no data: prefix).
 * @param apiKey     Gemini API key (Google AI Studio).
 * @param model      Optional model id override.
 * @returns Sanitized per-item estimates. Empty `items` = no food detected.
 */
export async function estimateMealFromPhoto(
  base64Jpeg: string,
  apiKey: string,
  model: string = DEFAULT_AI_MODEL,
): Promise<PhotoEstimateResult> {
  if (!apiKey.trim()) throw new AiNotConfiguredError();

  const prompt =
    "You are an expert nutritionist analyzing a photo of a meal. " +
    "Identify each distinct food or drink item in the image. " +
    "For each item, estimate the portion size in grams using visual cues " +
    "(plate and bowl dimensions, utensils, hands, packaging) for scale. " +
    "Estimate calories, protein, carbs, and fat as TOTALS for that estimated portion. " +
    "Be conservative when unsure; a typical restaurant main is 300-600 g. " +
    "If a food is partially hidden, estimate only the visible portion. " +
    "If the image contains no food, return an empty items array. " +
    "Do not include non-food objects like plates, cutlery, or tables.";

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: base64Jpeg } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                portion_grams: { type: "number" },
                calories: { type: "number" },
                protein_g: { type: "number" },
                carbs_g: { type: "number" },
                fat_g: { type: "number" },
                confidence: {
                  type: "string",
                  enum: CONFIDENCES,
                },
              },
              required: [
                "name",
                "portion_grams",
                "calories",
                "protein_g",
                "carbs_g",
                "fat_g",
                "confidence",
              ],
            },
          },
        },
        required: ["items"],
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey.trim(),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiRequestError("Could not reach Gemini. Check your connection.");
  }

  if (!res.ok) {
    let message = `Gemini request failed (${res.status}).`;
    if (res.status === 400 || res.status === 403) {
      message =
        "Gemini rejected the API key or request. Check the key in Profile.";
    } else if (res.status === 429) {
      message =
        "Gemini rate limit reached. Wait a moment and try again.";
    }
    try {
      const data = (await res.json()) as GeminiResponse;
      if (data.error?.message) {
        message = `Gemini error: ${data.error.message}`;
      }
    } catch {
      // Keep the generic message.
    }
    throw new AiRequestError(message, res.status);
  }

  const data = (await res.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  if (!candidate || candidate.finishReason === "SAFETY") {
    throw new AiRequestError(
      "Gemini could not analyze this photo. Try another one.",
    );
  }
  const text = candidate.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw new AiRequestError("Gemini returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiRequestError("Gemini returned an unreadable response.");
  }
  const items = sanitizeItems(
    parsed && typeof parsed === "object" && "items" in parsed
      ? (parsed as { items?: unknown }).items
      : [],
  );
  return { items };
}

/**
 * Minimal health check for a stored key: one tiny text-only request.
 * Resolves when the key and model are usable; rejects with AiRequestError
 * otherwise (never sends user data).
 */
export async function testGeminiKey(
  apiKey: string,
  model: string = DEFAULT_AI_MODEL,
): Promise<void> {
  if (!apiKey.trim()) throw new AiNotConfiguredError();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Reply with the single word OK." }] }],
        generationConfig: { maxOutputTokens: 512 },
      }),
    });
  } catch {
    throw new AiRequestError("Could not reach Gemini. Check your connection.");
  }
  if (!res.ok) {
    const message =
      res.status === 400 || res.status === 403
        ? "Key rejected — check it and try again."
        : res.status === 429
          ? "Rate limit reached — key is valid, try again shortly."
          : `Gemini request failed (${res.status}).`;
    throw new AiRequestError(message, res.status);
  }
}

/**
 * Convert a sanitized photo item into the app's FoodItem shape so it can be
 * logged through the normal pipeline (addLog, daily summaries, recents).
 * The estimated grams become the serving size; servings is always 1.
 */
export function photoItemToFoodItem(
  item: MealPhotoItem,
  index: number,
): FoodItem {
  return {
    id: `photo-${Date.now()}-${index}`,
    name: item.name,
    servingSize: item.portionGrams,
    servingLabel: `${item.portionGrams} g (est.)`,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    source: "photo",
  };
}
