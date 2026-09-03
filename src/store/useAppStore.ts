import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  FoodItem,
  FoodLog,
  MacroTargets,
  MealType,
  UserProfile,
} from "../lib/types";
import { todayKey } from "../lib/date";
import { calculateTdee } from "../lib/tdee";
import { logFactor } from "../lib/food-utils";

// Persisted-state key. Migrate data saved under the app's old name so a
// rename never wipes a user's logs.
const STORAGE_KEY = "caltrack-storage";
const LEGACY_STORAGE_KEY = "loseit-storage";
if (typeof window !== "undefined") {
  try {
    if (
      !localStorage.getItem(STORAGE_KEY) &&
      localStorage.getItem(LEGACY_STORAGE_KEY)
    ) {
      localStorage.setItem(
        STORAGE_KEY,
        localStorage.getItem(LEGACY_STORAGE_KEY) as string,
      );
    }
  } catch {
    // Storage unavailable — ignore.
  }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface AppState {
  // User profile & goals
  profile: UserProfile;
  setProfile: (updates: Partial<UserProfile>) => void;
  completeOnboarding: (profile: UserProfile) => void;
  // Food logs keyed by date string "yyyy-MM-dd"
  logsByDate: Record<string, FoodLog[]>;
  addLog: (date: string, logData: Omit<FoodLog, "id" | "loggedAt">) => FoodLog;
  removeLog: (date: string, logId: string) => void;
  updateLog: (date: string, log: FoodLog) => void;
  getLogsForDate: (date: string) => FoodLog[];
  // Recently logged foods (most recent first) for quick re-adding.
  recentFoods: FoodItem[];
  // Weight check-ins keyed by date "yyyy-MM-dd" (one per day, kg).
  weightByDate: Record<string, number>;
  checkInWeight: (date: string, weightKg: number) => void;
  removeWeightEntry: (date: string) => void;
  // UI state
  activeMeal: MealType;
  setActiveMeal: (meal: MealType) => void;
}

const initialProfile: UserProfile = {
  name: "",
  age: 0,
  gender: "male",
  weight: 0,
  height: 0,
  activityLevel: "moderate",
  goal: "maintain",
  targetCalories: 2000,
  targetProtein: 150,
  targetCarbs: 200,
  targetFat: 67,
  onboarded: false,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: initialProfile,
      logsByDate: {},
      recentFoods: [],
      weightByDate: {},
      activeMeal: "breakfast",
      setProfile: (updates: Partial<UserProfile>) => {
        const profile = { ...get().profile, ...updates };
        const targets = calculateTdee(profile);
        set({
          profile: {
            ...profile,
            targetCalories: targets.calories,
            targetProtein: targets.protein,
            targetCarbs: targets.carbs,
            targetFat: targets.fat,
          },
        });
      },
      completeOnboarding: (profile: UserProfile) => {
        const targets = calculateTdee(profile);
        set({
          profile: {
            ...profile,
            targetCalories: targets.calories,
            targetProtein: targets.protein,
            targetCarbs: targets.carbs,
            targetFat: targets.fat,
            onboarded: true,
          },
        });
      },
      addLog: (date: string, logData: Omit<FoodLog, "id" | "loggedAt">) => {
        const log: FoodLog = {
          ...logData,
          id: makeId(),
          loggedAt: new Date().toISOString(),
        };
        set((state) => {
          // Track the food in recents (deduped by id, newest first, capped).
          const recentFoods = [
            logData.food,
            ...state.recentFoods.filter((f) => f.id !== logData.food.id),
          ].slice(0, 12);
          return {
            logsByDate: {
              ...state.logsByDate,
              [date]: [...(state.logsByDate[date] || []), log],
            },
            recentFoods,
          };
        });
        return log;
      },
      removeLog: (date: string, logId: string) => {
        set((state) => ({
          logsByDate: {
            ...state.logsByDate,
            [date]: (state.logsByDate[date] || []).filter((l) => l.id !== logId),
          },
        }));
      },
      checkInWeight: (date: string, weightKg: number) => {
        set((state) => ({
          weightByDate: { ...state.weightByDate, [date]: weightKg },
        }));
      },
      removeWeightEntry: (date: string) => {
        set((state) => {
          const next = { ...state.weightByDate };
          delete next[date];
          return { weightByDate: next };
        });
      },
      updateLog: (date: string, log: FoodLog) => {
        set((state) => ({
          logsByDate: {
            ...state.logsByDate,
            [date]: (state.logsByDate[date] || []).map((l) =>
              l.id === log.id ? log : l,
            ),
          },
        }));
      },
      getLogsForDate: (date: string) => get().logsByDate[date] || [],
      setActiveMeal: (meal: MealType) => set({ activeMeal: meal }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        profile: state.profile,
        logsByDate: state.logsByDate,
        recentFoods: state.recentFoods,
        weightByDate: state.weightByDate,
      }),
      // Repair profiles persisted before targets were stored under `target*`
      // keys — an earlier build merged the raw MacroTargets keys instead.
      merge: (persisted, current) => {
        const state = (persisted ?? {}) as Partial<AppState>;
        const profile: UserProfile = {
          ...current.profile,
          ...(state.profile ?? {}),
        };
        const legacy = state.profile as
          | (UserProfile & Partial<MacroTargets>)
          | undefined;
        if (
          legacy &&
          legacy.targetCalories === undefined &&
          typeof legacy.calories === "number"
        ) {
          profile.targetCalories = legacy.calories;
          profile.targetProtein = legacy.protein;
          profile.targetCarbs = legacy.carbs;
          profile.targetFat = legacy.fat;
        }
        return { ...current, ...state, profile };
      },
    },
  ),
);

// Selectors.
// IMPORTANT: selectors must return referentially stable values. `getLogsForDate`
// returns a fresh `[]` when a date has no logs, which combined with zustand v5's
// useSyncExternalStore would trigger an infinite re-render loop — so fall back to
// a module-level constant instead.
const EMPTY_LOGS: FoodLog[] = [];

export const useProfile = () => useAppStore((s) => s.profile);
export const useTodayLogs = () =>
  useAppStore((s) => s.logsByDate[todayKey()] ?? EMPTY_LOGS);
export const useLogsByDate = (date: string) =>
  useAppStore((s) => s.logsByDate[date] ?? EMPTY_LOGS);
export const useActiveMeal = () => useAppStore((s) => s.activeMeal);

/**
 * True once zustand has rehydrated persisted state from localStorage.
 * persist hydrates asynchronously (microtask after store creation), so
 * redirect logic must wait for it or it will misread the initial defaults
 * (e.g. onboarded=false) on a fresh page load.
 *
 * NOTE: on the server (SSR/prerender) zustand's persist middleware early-returns
 * without attaching `.persist` because localStorage doesn't exist, so guard
 * every access — never call useAppStore.persist unguarded.
 */
export function useHasHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!useAppStore.persist) return () => {};
      // Fires when hydration finishes; hasHydrated() flips, notifying React.
      return useAppStore.persist.onFinishHydration(onStoreChange);
    },
    () => (useAppStore.persist ? useAppStore.persist.hasHydrated() : false),
    () => false,
  );
}

export function getDailySummary(
  date = todayKey(),
): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  logs: FoodLog[];
} {
  const logs = useAppStore.getState().getLogsForDate(date);
  const totals = logs.reduce(
    (acc, log) => {
      const factor = logFactor(log);
      return {
        calories: acc.calories + log.food.calories * factor,
        protein: acc.protein + log.food.protein * factor,
        carbs: acc.carbs + log.food.carbs * factor,
        fat: acc.fat + log.food.fat * factor,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { ...totals, logs };
}

export function getMacroPct(consumed: number, target: number): number {
  if (!target || target === 0) return 0;
  return Math.min((consumed / target) * 100, 100);
}
