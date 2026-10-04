"use client";

import ProgressBar from "@/components/shared/ProgressBar";
import { cardClass, dangerButtonClass, tertiaryButtonClass } from "@/components/shared/styles";
import type { Goal } from "@/types";

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}

export default function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  return (
    <div data-testid="goal-card" className={`${cardClass} flex flex-col transition-shadow hover:shadow-float`}>
      <h3 className="break-words text-base font-semibold leading-[1.25] text-ink">{goal.title}</h3>
      {goal.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-body">{goal.description}</p>}
      <div className="mt-5">
        <ProgressBar value={goal.progress} label={`${goal.title} 진행률`} />
      </div>
      <p className="mt-2 text-sm text-muted">연결된 주간 계획 {goal.weeklyPlanCount}개</p>
      <div className="-mx-3 -mb-2 mt-auto flex justify-end gap-1 pt-4">
        <button type="button" onClick={() => onEdit(goal)} className={tertiaryButtonClass}>
          수정
        </button>
        <button type="button" onClick={() => onDelete(goal)} className={dangerButtonClass}>
          삭제
        </button>
      </div>
    </div>
  );
}
