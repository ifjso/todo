"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">주간 계획</h1>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          새 주간 계획
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {weeklyLoaded && weeklyPlans.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-8 text-center text-sm text-slate-500 dark:text-neutral-400">
          아직 주간 계획이 없습니다.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
