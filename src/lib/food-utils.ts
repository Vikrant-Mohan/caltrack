import type { FoodItem, FoodLog } from "./types";
import { round } from "./tdee";

/** Scale a food item's macros from its per-100g basis to a given serving factor.
 *  food.servingSize is in grams; passing a different grams amount returns the
 *  macros for that gram count. */
export function scaleFoodByGrams(food: FoodItem, grams: number): FoodItem {
  const factor = grams / (food.servingSize || 100);
  return {
    ...food,
    servingSize: grams,
    calories: round(food.calories * factor, 1),
    protein: round(food.protein * factor, 1),
    carbs: round(food.carbs * factor, 1),
    fat: round(food.fat * factor, 1),
  };
}

/** Scale a food item by a number of servings (each serving = servingSize grams). */
export function scaleFoodByServings(food: FoodItem, servings: number): FoodItem {
  return scaleFoodByGrams(food, food.servingSize * servings);
}

/**
 * The base gram amount a log entry refers to: the household portion it was
 * logged with (e.g. 1 slice = 29 g), falling back to the food's base serving.
 */
export function logBaseGrams(log: FoodLog): number {
  const grams = log.portion?.grams;
  return grams && grams > 0 ? grams : log.food.servingSize;
}

/** Total grams for a log entry, including its serving multiplier. */
export function logGrams(log: FoodLog): number {
  return logBaseGrams(log) * log.servings;
}

/**
 * Multiplier that turns a food's per-serving macros into the logged amount's
 * totals. 1 slice of bread (29 g) on a 100 g serving food = 0.29x, so
 * calories = food.calories * factor.
 */
export function logFactor(log: FoodLog): number {
  return logGrams(log) / (log.food.servingSize || 100);
}

/** Total calories for a log entry, including its portion and multiplier. */
export function logCalories(log: FoodLog): number {
  return log.food.calories * logFactor(log);
}