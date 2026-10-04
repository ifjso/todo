import type { ReactNode } from "react";
import type { WeeklyGoalItem as WeeklyGoal } from "@/types";

/** 주간 목표 한 줄. 완료 여부는 연결된 할 일로 자동 계산되며 직접 바꿀 수 없다. */
export default function WeeklyGoalItem({ goal, children }: { goal: WeeklyGoal; children?: ReactNode }) {
  const status = goal.done ? "완료" : goal.todoTotal === 0 ? "연결된 할 일 없음" : `${goal.todoDone}/${goal.todoTotal}`;
  return (
    <li data-testid="weekly-goal" data-done={goal.done} className="flex min-w-0 items-center gap-2 text-sm">
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
          goal.done
            ? "border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500"
            : "border-slate-300 dark:border-neutral-700"
        }`}
      >
        {goal.done && "✓"}
      </span>
      <span
        className={`min-w-0 flex-1 break-words ${goal.done ? "text-slate-400 line-through dark:text-neutral-500" : ""}`}
      >
        {goal.text}
      </span>
      <span
        data-testid="weekly-goal-status"
        className={`shrink-0 text-xs ${goal.done ? "text-green-600 dark:text-green-400" : "text-slate-500 dark:text-neutral-400"}`}
      >
        {status}
      </span>
      {children}
    </li>
  );
}
