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
      className="block rounded-md border border-hairline bg-canvas p-6 transition-shadow hover:shadow-float"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold leading-[1.25] text-ink">{formatWeekRange(plan.weekStart)}</h2>
        <span className="text-sm text-muted">
          주간 목표 {doneGoals}/{plan.goals.length}
        </span>
      </div>
      <ProgressBar value={plan.progress} label="주간 진행률" size="sm" />
      {goal && <p className="mt-3 truncate text-sm text-muted">목표: {goal.title}</p>}
    </Link>
  );
}
