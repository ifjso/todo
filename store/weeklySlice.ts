import type { StateCreator } from "zustand";
import { api } from "@/lib/apiClient";
import type { WeeklyPlan, WeeklyPlanInput } from "@/types";
import type { Store, StoreMiddlewares } from "./index";

export interface WeeklySlice {
  /** weekStart 내림차순 */
  weeklyPlans: WeeklyPlan[];
  weeklyLoaded: boolean;
  fetchWeeklyPlans: () => Promise<void>;
  fetchWeeklyPlan: (id: string) => Promise<WeeklyPlan>;
  addWeeklyPlan: (input: WeeklyPlanInput) => Promise<WeeklyPlan>;
  updateWeeklyPlan: (id: string, input: Partial<WeeklyPlanInput>) => Promise<WeeklyPlan>;
  deleteWeeklyPlan: (id: string) => Promise<void>;
}

function upsert(plans: WeeklyPlan[], plan: WeeklyPlan): WeeklyPlan[] {
  const rest = plans.filter((p) => p._id !== plan._id);
  return [...rest, plan].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}

export const createWeeklySlice: StateCreator<Store, StoreMiddlewares, [], WeeklySlice> = (set, get) => ({
  weeklyPlans: [],
  weeklyLoaded: false,

  fetchWeeklyPlans: async () => {
    const weeklyPlans = await api.weekly.list();
    set({ weeklyPlans, weeklyLoaded: true }, false, "weekly/fetch");
  },

  fetchWeeklyPlan: async (id) => {
    const plan = await api.weekly.get(id);
    set((s) => ({ weeklyPlans: upsert(s.weeklyPlans, plan) }), false, "weekly/fetchOne");
    return plan;
  },

  addWeeklyPlan: async (input) => {
    const plan = await api.weekly.create(input);
    set((s) => ({ weeklyPlans: upsert(s.weeklyPlans, plan) }), false, "weekly/add");
    void get().refreshProgress();
    return plan;
  },

  updateWeeklyPlan: async (id, input) => {
    const plan = await api.weekly.update(id, input);
    // 서버와 동일하게, 삭제된 주간 목표에 연결된 할 일은 연결만 해제한다.
    const goalIds = new Set(plan.goals.map((g) => g._id));
    set(
      (s) => ({
        weeklyPlans: upsert(s.weeklyPlans, plan),
        todos: s.todos.map((t) =>
          t.weeklyPlanId === id && t.weeklyGoalId && !goalIds.has(t.weeklyGoalId) ? { ...t, weeklyGoalId: null } : t,
        ),
      }),
      false,
      "weekly/update",
    );
    if ("goalId" in input) void get().refreshProgress();
    return plan;
  },

  deleteWeeklyPlan: async (id) => {
    await api.weekly.remove(id);
    set(
      (s) => ({
        weeklyPlans: s.weeklyPlans.filter((p) => p._id !== id),
        todos: s.todos.map((t) =>
          t.weeklyPlanId === id ? { ...t, weeklyPlanId: null, weeklyGoalId: null, dayOfWeek: null } : t,
        ),
      }),
      false,
      "weekly/delete",
    );
    void get().refreshProgress();
  },
});
