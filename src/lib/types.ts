export type Gender = "male" | "female" | "other";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very-active";

export type Goal = "lose" | "maintain" | "gain" | "custom";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  "very-active": 1.9,
};

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export interface UserProfile {
  name: string;
  age: number;
  gender: Gender;
  weight: number; // kg
  height: number; // cm
  activityLevel: ActivityLevel;
  goal: Goal;
  /** Daily calorie budget when goal === "custom" (overrides the TDEE estimate). */
  customCalories?: number;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  onboarded: boolean;
}

export interface FoodItem {
  id: string; // barcode or generated id
  name: string;
  brand?: string;
  /** Where the nutrition data came from, shown on result rows. */
  source?: "usda" | "off" | "common" | "photo";
  image?: string;
  /** Grams that the macros below refer to (e.g. 100 or the product serving). */
  servingSize: number;
  /** Human label for that serving, e.g. "1 cup (240 ml)", "1 bar (40 g)". */
  servingLabel?: string;
  /** Alternative household measures (e.g. "1 slice", "1 cup") with gram weights. */
  portions?: FoodPortion[];
  calories: number; // per servingSize
  protein: number; // per servingSize (g)
  carbs: number; // per servingSize (g)
  fat: number; // per servingSize (g)
}

/** A household measure alternative to the base serving, e.g. "1 slice" = 29 g. */
export interface FoodPortion {
  label: string; // e.g. "1 slice"
  grams: number; // e.g. 29
}

export interface FoodLog {
  id: string;
  food: FoodItem;
  mealType: MealType;
  servings: number;
  /** The household measure this entry was logged with (optional; falls back to food.servingSize). */
  portion?: FoodPortion;
  loggedAt: string; // ISO string
}

export interface DailySummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  logs: FoodLog[];
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
