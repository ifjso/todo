"use client";

import ProgressBar from "@/components/shared/ProgressBar";
import type { Goal } from "@/types";

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}

export default function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  return (
    <div data-testid="goal-card" className="min-w-0 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h3 className="break-words text-base font-semibold">{goal.title}</h3>
      {goal.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-neutral-400">{goal.description}</p>}
      <div className="mt-3">
        <ProgressBar value={goal.progress} label={`${goal.title} 진행률`} />
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">연결된 주간 계획 {goal.weeklyPlanCount}개</p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => onEdit(goal)} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800">
          수정
        </button>
        <button type="button" onClick={() => onDelete(goal)} className="rounded-lg px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
          삭제
        </button>
      </div>
    </div>
  );
}
