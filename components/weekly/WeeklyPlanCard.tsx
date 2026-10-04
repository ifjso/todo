import Link from "next/link";
import ProgressBar from "@/components/shared/ProgressBar";
import { formatWeekRange } from "@/lib/date";
import type { Goal, WeeklyPlan } from "@/types";

export default function WeeklyPlanCard({ plan, goal }: { plan: WeeklyPlan; goal?: Goal }) {
  const doneGoals = plan.goals.filter((g) => g.done).length;
  return (
    <Link
      href={`/weekly/${plan._id}`}
      data-testid="weekly-card"
      className="block rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm transition hover:border-indigo-300 dark:hover:border-indigo-500"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{formatWeekRange(plan.weekStart)}</h2>
        <span className="text-xs text-slate-500 dark:text-neutral-400">
          주간 목표 {doneGoals}/{plan.goals.length}
        </span>
      </div>
      <ProgressBar value={plan.progress} label="주간 진행률" size="sm" />
      {goal && <p className="mt-2 truncate text-xs text-indigo-600 dark:text-indigo-400">목표: {goal.title}</p>}
    </Link>
  );
}
