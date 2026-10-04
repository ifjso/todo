import type { StateCreator } from "zustand";
import { api } from "@/lib/apiClient";
import type { Goal, GoalInput } from "@/types";
import type { Store, StoreMiddlewares } from "./index";

export interface GoalSlice {
  goals: Goal[];
  goalsLoaded: boolean;
  fetchGoals: () => Promise<void>;
  addGoal: (input: GoalInput) => Promise<Goal>;
  updateGoal: (id: string, input: Partial<GoalInput>) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;
}

export const createGoalSlice: StateCreator<Store, StoreMiddlewares, [], GoalSlice> = (set) => ({
  goals: [],
  goalsLoaded: false,

  fetchGoals: async () => {
    const goals = await api.goals.list();
    set({ goals, goalsLoaded: true }, false, "goals/fetch");
  },

  addGoal: async (input) => {
    const goal = await api.goals.create(input);
    set((s) => ({ goals: [goal, ...s.goals] }), false, "goals/add");
    return goal;
  },

  updateGoal: async (id, input) => {
    const goal = await api.goals.update(id, input);
    set((s) => ({ goals: s.goals.map((g) => (g._id === id ? goal : g)) }), false, "goals/update");
    return goal;
  },

  deleteGoal: async (id) => {
    await api.goals.remove(id);
    // 서버와 동일하게 연결만 해제한다.
    set(
      (s) => ({
        goals: s.goals.filter((g) => g._id !== id),
        weeklyPlans: s.weeklyPlans.map((p) => (p.goalId === id ? { ...p, goalId: null } : p)),
      }),
      false,
      "goals/delete",
    );
  },
});
