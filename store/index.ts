import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createGoalSlice, type GoalSlice } from "./goalSlice";
import { createTodoSlice, type TodoSlice } from "./todoSlice";
import { createWeeklySlice, type WeeklySlice } from "./weeklySlice";
import { api } from "@/lib/apiClient";
import type { Me } from "@/types";

interface SharedSlice {
  /** 할 일/주간 계획 변경 후 서버에서 계산된 주간·목표 진행률을 다시 불러온다. */
  refreshProgress: () => Promise<void>;
  /** 로그인 사용자 */
  me: Me | null;
  fetchMe: () => Promise<void>;
}

export type Store = TodoSlice & WeeklySlice & GoalSlice & SharedSlice;
export type StoreMiddlewares = [["zustand/devtools", never]];

export const useStore = create<Store>()(
  devtools(
    (...a) => ({
      ...createTodoSlice(...a),
      ...createWeeklySlice(...a),
      ...createGoalSlice(...a),
      refreshProgress: async () => {
        const [, get] = a;
        const { weeklyLoaded, goalsLoaded, weeklyPlans, fetchWeeklyPlans, fetchWeeklyPlan, fetchGoals } = get();
        await Promise.all([
          // 전체 목록을 불러온 적이 없으면 화면에 있는 주간 계획만 갱신한다.
          weeklyLoaded ? fetchWeeklyPlans() : Promise.all(weeklyPlans.map((p) => fetchWeeklyPlan(p._id))),
          goalsLoaded ? fetchGoals() : Promise.resolve(),
        ]).catch((error) => console.error("진행률 갱신 실패", error));
      },
      me: null,
      fetchMe: async () => {
        const [set] = a;
        set({ me: await api.me() }, false, "auth/me");
      },
    }),
    { name: "todo-planner" },
  ),
);
