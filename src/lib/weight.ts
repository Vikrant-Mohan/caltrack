import type { Goal } from "./types";

/** Target rate of weight change in kg per week for each onboarding goal. */
export const GOAL_RATE_KG_PER_WEEK: Record<Goal, number> = {
  lose: -0.5,
  maintain: 0,
  gain: 0.5,
  custom: 0,
};

export function goalRateKgPerDay(goal: Goal): number {
  return GOAL_RATE_KG_PER_WEEK[goal] / 7;
}

/** Human label for the goal pace, e.g. "0.5 kg/wk loss". */
export function goalPaceLabel(goal: Goal): string {
  if (goal === "lose") return "0.5 kg/wk loss";
  if (goal === "gain") return "0.5 kg/wk gain";
  return "";
}

export interface PaceResult {
  /** Signed actual change (kg): first check-in → latest. Negative = lost. */
  change: number;
  /** Signed change the goal pace expected over the same span. */
  expectedChange: number;
  /** How far off the pace line the latest check-in is, in kg (0 = on pace). */
  gap: number;
  /** True when the latest check-in is ahead of the goal pace. */
  ahead: boolean;
  /** True when a meaningful pace comparison exists (lose/gain + ≥2 days). */
  comparable: boolean;
}

/**
 * Compare the latest check-in against the straight line implied by the goal
 * (anchored at the first check-in and sloping at ±0.5 kg/week).
 */
export function weightPace(
  firstWeight: number,
  latestWeight: number,
  daysBetween: number,
  goal: Goal,
): PaceResult {
  const rate = goalRateKgPerDay(goal);
  const change = latestWeight - firstWeight;
  const expectedChange = rate * daysBetween;
  const gap = change - expectedChange;
  if (goal !== "lose" && goal !== "gain") {
    return { change, expectedChange, gap, ahead: false, comparable: false };
  }
  // Losing: a more negative change is ahead. Gaining: a more positive one is.
  const ahead = goal === "lose" ? gap < 0 : gap > 0;
  return { change, expectedChange, gap, ahead, comparable: daysBetween >= 1 };
}
