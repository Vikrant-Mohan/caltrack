import type {
  ActivityLevel,
  Goal,
  MacroTargets,
  UserProfile,
} from "./types";

/**
 * Mifflin-St Jeor Equation:
 * Men: (10 × weight) + (6.25 × height) - (5 × age) + 5
 * Women: (10 × weight) + (6.25 × height) - (5 × age) - 161
 */
export function calculateBasalMetabolicRate(profile: {
  weight: number;
  height: number;
  age: number;
  gender: string;
}): number {
  const { weight, height, age, gender } = profile;
  const bmr = 10 * weight + 6.25 * height - 5 * age;
  if (gender === "male") return bmr + 5;
  if (gender === "female") return bmr - 161;
  // "other": use the midpoint of the male/female constants
  return bmr - 78;
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  "very-active": 1.9,
};

export const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: 500,
  // The custom goal ignores the adjustment and uses customCalories instead.
  custom: 0,
};

/**
 * TDEE = BMR × Activity Factor, then adjust for goal (±500 kcal for 0.5kg/week).
 * Macros: Protein 30%, Carbs 40%, Fat 30% of total calories.
 * 1g protein = 4 kcal, 1g carb = 4 kcal, 1g fat = 9 kcal.
 */
export function calculateTdee(profile: UserProfile): MacroTargets {
  let targetCalories: number;
  if (
    profile.goal === "custom" &&
    typeof profile.customCalories === "number" &&
    profile.customCalories > 0
  ) {
    // A user-defined budget wins over the formula entirely.
    targetCalories = Math.round(profile.customCalories);
  } else {
    const bmr = calculateBasalMetabolicRate(profile);
    const tdee = bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel];
    targetCalories = Math.round(tdee + GOAL_ADJUSTMENTS[profile.goal]);
  }

  const proteinKcal = targetCalories * 0.3;
  const carbsKcal = targetCalories * 0.4;
  const fatKcal = targetCalories * 0.3;

  return {
    calories: targetCalories,
    protein: Math.round(proteinKcal / 4),
    carbs: Math.round(carbsKcal / 4),
    fat: Math.round(fatKcal / 9),
  };
}

/** Round a number to a given precision. */
export function round(value: number, decimals = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
