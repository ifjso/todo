"use client";

import { useEffect, useState } from "react";
import GoalCard from "@/components/goals/GoalCard";
import GoalForm from "@/components/goals/GoalForm";
import { emptyStateClass, errorTextClass, pageTitleClass, primaryButtonClass } from "@/components/shared/styles";
import { useStore } from "@/store";
import type { Goal } from "@/types";

export default function GoalsPage() {
  const goals = useStore((s) => s.goals);
  const goalsLoaded = useStore((s) => s.goalsLoaded);
  const fetchGoals = useStore((s) => s.fetchGoals);
  const deleteGoal = useStore((s) => s.deleteGoal);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  useEffect(() => {
    fetchGoals().catch((err) => setError(err instanceof Error ? err.message : "목표를 불러오지 못했습니다."));
  }, [fetchGoals]);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditing(goal);
    setFormOpen(true);
  }

  async function onDelete(goal: Goal) {
    if (!window.confirm(`"${goal.title}" 목표를 삭제할까요?`)) return;
    try {
      await deleteGoal(goal._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className={pageTitleClass}>1년 목표</h1>
        <button
          type="button"
          onClick={openNew}
          className={primaryButtonClass}
        >
          새 목표
        </button>
      </div>
      {error && (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      )}
      {!goalsLoaded && !error ? (
        <p className="text-sm text-muted">불러오는 중...</p>
      ) : goals.length === 0 ? (
        <p className={emptyStateClass}>
          아직 목표가 없습니다. &quot;새 목표&quot; 버튼으로 1년 목표를 추가해 보세요.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => (
            <GoalCard key={g._id} goal={g} onEdit={openEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
      <GoalForm open={formOpen} goal={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
}
