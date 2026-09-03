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

/** Uid bucket that old single-user (pre-auth) data is migrated into. */
const LOCAL_BUCKET = "_local";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface UserData {
  profile: UserProfile;
  logsByDate: Record<string, FoodLog[]>;
  recentFoods: FoodItem[];
  weightByDate: Record<string, number>;
}

export interface AppState {
  /** Per-account data keyed by auth uid (the persisted source of truth). */
  users: Record<string, UserData>;
  /** Uid of the signed-in user (null when signed out). */
  activeUserId: string | null;
  // Mirrors of the active user's data — components read these as before.
  profile: UserProfile;
  logsByDate: Record<string, FoodLog[]>;
  recentFoods: FoodItem[];
  weightByDate: Record<string, number>;
  // Actions
  setProfile: (updates: Partial<UserProfile>) => void;
  completeOnboarding: (profile: UserProfile) => void;
  addLog: (date: string, logData: Omit<FoodLog, "id" | "loggedAt">) => FoodLog;
  removeLog: (date: string, logId: string) => void;
  updateLog: (date: string, log: FoodLog) => void;
  getLogsForDate: (date: string) => FoodLog[];
  checkInWeight: (date: string, weightKg: number) => void;
  removeWeightEntry: (date: string) => void;
  signInAs: (uid: string) => void;
  signOutUser: () => void;
  // UI state
  activeMeal: MealType;
  setActiveMeal: (meal: MealType) => void;
}

export const initialProfile: UserProfile = {
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

function emptyUser(): UserData {
  return {
    profile: { ...initialProfile },
    logsByDate: {},
    recentFoods: [],
    weightByDate: {},
  };
}

/** Profile as persisted by very old builds (raw macro keys instead of target*). */
function repairProfile(profile?: Partial<UserProfile & MacroTargets>): UserProfile {
  const base = { ...initialProfile, ...(profile ?? {}) };
  const p = base as UserProfile;
  const legacy = profile as (UserProfile & Partial<MacroTargets>) | undefined;
  if (
    legacy &&
    legacy.targetCalories === undefined &&
    typeof legacy.calories === "number"
  ) {
    p.targetCalories = legacy.calories;
    p.targetProtein = legacy.protein;
    p.targetCarbs = legacy.carbs;
    p.targetFat = legacy.fat;
  }
  return p;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      users: {},
      activeUserId: null,
      profile: initialProfile,
      logsByDate: {},
      recentFoods: [],
      weightByDate: {},
      activeMeal: "breakfast",

      setProfile: (updates: Partial<UserProfile>) => {
        set((state) => {
          const uid = state.activeUserId;
          if (!uid) return {};
          const user = state.users[uid] ?? emptyUser();
          const profile = { ...user.profile, ...updates };
          const targets = calculateTdee(profile);
          const nextUser = {
            ...user,
            profile: {
              ...profile,
              targetCalories: targets.calories,
              targetProtein: targets.protein,
              targetCarbs: targets.carbs,
              targetFat: targets.fat,
            },
          };
          return withActive(state, uid, nextUser);
        });
      },

      completeOnboarding: (profile: UserProfile) => {
        set((state) => {
          const uid = state.activeUserId;
          if (!uid) return {};
          const user = state.users[uid] ?? emptyUser();
          const targets = calculateTdee(profile);
          const nextUser = {
            ...user,
            profile: {
              ...profile,
              targetCalories: targets.calories,
              targetProtein: targets.protein,
              targetCarbs: targets.carbs,
              targetFat: targets.fat,
              onboarded: true,
            },
          };
          return withActive(state, uid, nextUser);
        });
      },

      addLog: (date: string, logData: Omit<FoodLog, "id" | "loggedAt">) => {
        const log: FoodLog = {
          ...logData,
          id: makeId(),
          loggedAt: new Date().toISOString(),
        };
        set((state) => {
          const uid = state.activeUserId;
          if (!uid) return {};
          const user = state.users[uid] ?? emptyUser();
          // Track the food in recents (deduped by id, newest first, capped).
          const recentFoods = [
            logData.food,
            ...user.recentFoods.filter((f) => f.id !== logData.food.id),
          ].slice(0, 12);
          const nextUser = {
            ...user,
            logsByDate: {
              ...user.logsByDate,
              [date]: [...(user.logsByDate[date] || []), log],
            },
            recentFoods,
          };
          return withActive(state, uid, nextUser);
        });
        return log;
      },

      removeLog: (date: string, logId: string) => {
        set((state) => {
          const uid = state.activeUserId;
          if (!uid) return {};
          const user = state.users[uid] ?? emptyUser();
          const nextUser = {
            ...user,
            logsByDate: {
              ...user.logsByDate,
              [date]: (user.logsByDate[date] || []).filter(
                (l) => l.id !== logId,
              ),
            },
          };
          return withActive(state, uid, nextUser);
        });
      },

      updateLog: (date: string, log: FoodLog) => {
        set((state) => {
          const uid = state.activeUserId;
          if (!uid) return {};
          const user = state.users[uid] ?? emptyUser();
          const nextUser = {
            ...user,
            logsByDate: {
              ...user.logsByDate,
              [date]: (user.logsByDate[date] || []).map((l) =>
                l.id === log.id ? log : l,
              ),
            },
          };
          return withActive(state, uid, nextUser);
        });
      },

      getLogsForDate: (date: string) => get().logsByDate[date] || [],

      checkInWeight: (date: string, weightKg: number) => {
        set((state) => {
          const uid = state.activeUserId;
          if (!uid) return {};
          const user = state.users[uid] ?? emptyUser();
          const nextUser = {
            ...user,
            weightByDate: { ...user.weightByDate, [date]: weightKg },
          };
          return withActive(state, uid, nextUser);
        });
      },

      removeWeightEntry: (date: string) => {
        set((state) => {
          const uid = state.activeUserId;
          if (!uid) return {};
          const user = state.users[uid] ?? emptyUser();
          const weightByDate = { ...user.weightByDate };
          delete weightByDate[date];
          const nextUser = { ...user, weightByDate };
          return withActive(state, uid, nextUser);
        });
      },

      signInAs: (uid: string) => {
        set((state) => {
          if (!uid) return {};
          let users = state.users;
          let user = users[uid];
          if (!user) {
            // First account on this device: adopt the pre-auth local data
            // (if any) so existing profiles/logs survive the migration.
            const local = users[LOCAL_BUCKET];
            if (local) {
              const rest = { ...users };
              delete rest[LOCAL_BUCKET];
              users = { ...rest, [uid]: local };
              user = local;
            } else {
              user = emptyUser();
              users = { ...users, [uid]: user };
            }
          }
          return {
            users,
            activeUserId: uid,
            profile: user.profile,
            logsByDate: user.logsByDate,
            recentFoods: user.recentFoods,
            weightByDate: user.weightByDate,
          };
        });
      },

      signOutUser: () => {
        set({
          activeUserId: null,
          profile: initialProfile,
          logsByDate: {},
          recentFoods: [],
          weightByDate: {},
        });
      },

      setActiveMeal: (meal: MealType) => set({ activeMeal: meal }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        users: state.users,
        activeUserId: state.activeUserId,
      }),
      merge: (persistedRaw, current) => {
        const state = (persistedRaw ?? {}) as Partial<AppState> & {
          profile?: Partial<UserProfile & MacroTargets>;
          logsByDate?: Record<string, FoodLog[]>;
          recentFoods?: FoodItem[];
          weightByDate?: Record<string, number>;
        };
        if (state.users && typeof state.users === "object") {
          // Current shape: per-user buckets. Restore the mirrors for the
          // persisted active user so reloads don't boot into an empty profile.
          const users = state.users as Record<string, UserData>;
          const activeUserId = state.activeUserId ?? null;
          const activeUser = activeUserId ? users[activeUserId] : undefined;
          return {
            ...current,
            users,
            activeUserId,
            profile: activeUser?.profile ?? current.profile,
            logsByDate: activeUser?.logsByDate ?? {},
            recentFoods: activeUser?.recentFoods ?? [],
            weightByDate: activeUser?.weightByDate ?? {},
          };
        }
        // Legacy shape: one device-wide user saved before auth existed.
        const user: UserData = {
          profile: repairProfile(state.profile),
          logsByDate: state.logsByDate ?? {},
          recentFoods: state.recentFoods ?? [],
          weightByDate: state.weightByDate ?? {},
        };
        return {
          ...current,
          users: { [LOCAL_BUCKET]: user },
          activeUserId: null,
        };
      },
    },
  ),
);

/** Helper for actions: write the updated user and refresh the mirrors. */
function withActive(
  state: AppState,
  uid: string,
  userData: UserData,
): Partial<AppState> {
  return {
    users: { ...state.users, [uid]: userData },
    profile: userData.profile,
    logsByDate: userData.logsByDate,
    recentFoods: userData.recentFoods,
    weightByDate: userData.weightByDate,
  };
}

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
