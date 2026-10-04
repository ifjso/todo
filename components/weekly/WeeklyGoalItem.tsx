import type { ReactNode } from "react";
import type { WeeklyGoalItem as WeeklyGoal } from "@/types";

/** 주간 목표 한 줄. 완료 여부는 연결된 할 일로 자동 계산되며 직접 바꿀 수 없다. */
export default function WeeklyGoalItem({ goal, children }: { goal: WeeklyGoal; children?: ReactNode }) {
  const status = goal.done ? "완료" : goal.todoTotal === 0 ? "연결된 할 일 없음" : `${goal.todoDone}/${goal.todoTotal}`;
  return (
    <li data-testid="weekly-goal" data-done={goal.done} className="flex min-w-0 items-center gap-3 text-base text-ink">
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
          goal.done ? "border-ink bg-ink text-canvas" : "border-border-strong"
        }`}
      >
        {goal.done && "✓"}
      </span>
      <span
        className={`min-w-0 flex-1 break-words ${goal.done ? "text-muted-soft line-through" : ""}`}
      >
        {goal.text}
      </span>
      <span
        data-testid="weekly-goal-status"
        className={`shrink-0 text-sm ${goal.done ? "font-semibold text-success" : "text-muted"}`}
      >
        {status}
      </span>
      {children}
    </li>
  );
}
