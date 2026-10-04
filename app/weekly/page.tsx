"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { emptyStateClass, errorTextClass, pageTitleClass, primaryButtonClass } from "@/components/shared/styles";
import WeeklyPlanCard from "@/components/weekly/WeeklyPlanCard";
import WeeklyPlanForm from "@/components/weekly/WeeklyPlanForm";
import { useStore } from "@/store";

function WeeklyPage() {
  const searchParams = useSearchParams();
  const { weeklyPlans, weeklyLoaded, goals, goalsLoaded, fetchWeeklyPlans, fetchGoals } = useStore();
  const [formOpen, setFormOpen] = useState(() => searchParams.get("new") === "1");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWeeklyPlans().catch((e: Error) => setError(e.message));
  }, [fetchWeeklyPlans]);

  useEffect(() => {
    if (!goalsLoaded) void fetchGoals().catch(() => {});
  }, [fetchGoals, goalsLoaded]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className={pageTitleClass}>주간 계획</h1>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className={primaryButtonClass}
        >
          새 주간 계획
        </button>
      </div>
      {error && (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      )}
      {weeklyLoaded && weeklyPlans.length === 0 && (
        <p className={emptyStateClass}>
          아직 주간 계획이 없습니다.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {weeklyPlans.map((p) => (
          <WeeklyPlanCard key={p._id} plan={p} goal={goals.find((g) => g._id === p.goalId)} />
        ))}
      </div>
      <WeeklyPlanForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WeeklyPage />
    </Suspense>
  );
}
