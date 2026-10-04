"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import ProgressBar from "@/components/shared/ProgressBar";
import { cardClass, errorTextClass, linkClass, pageTitleClass, sectionTitleClass } from "@/components/shared/styles";
import WeeklyGoalItem from "@/components/weekly/WeeklyGoalItem";
import { formatWeekRange, getWeekStart } from "@/lib/date";
import { STATUS_LABEL } from "@/lib/todoSort";
import { useStore } from "@/store";
import { TODO_STATUSES } from "@/types";

// 정적 프리렌더 시점이 아닌 브라우저의 현재 날짜로 이번 주를 계산한다.
const noopSubscribe = () => () => {};

export default function Dashboard() {
  const weeklyPlans = useStore((s) => s.weeklyPlans);
  const todos = useStore((s) => s.todos);
  const goals = useStore((s) => s.goals);
  const fetchWeeklyPlans = useStore((s) => s.fetchWeeklyPlans);
  const fetchTodos = useStore((s) => s.fetchTodos);
  const fetchGoals = useStore((s) => s.fetchGoals);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const weekStart = useSyncExternalStore(noopSubscribe, () => getWeekStart(), () => null);

  useEffect(() => {
    let active = true;
    // 일부 요청이 실패해도 나머지 데이터는 보여준다.
    Promise.allSettled([fetchWeeklyPlans(), fetchTodos(), fetchGoals()]).then((results) => {
      if (!active) return;
      const failed = results.find((r) => r.status === "rejected");
      if (failed) {
        const reason = (failed as PromiseRejectedResult).reason;
        setError(reason instanceof Error ? reason.message : "데이터를 불러오지 못했습니다.");
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchWeeklyPlans, fetchTodos, fetchGoals]);

  const plan = weekStart ? weeklyPlans.find((p) => p.weekStart === weekStart) : undefined;
  const planTodos = useMemo(() => (plan ? todos.filter((t) => t.weeklyPlanId === plan._id) : []), [todos, plan]);

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div>
        <h1 className={pageTitleClass}>대시보드</h1>
        <p className="text-base text-muted">이번 주 {weekStart && formatWeekRange(weekStart)}</p>
      </div>
      {error && (
        <p role="alert" className={errorTextClass}>
          {error}
        </p>
      )}
      {loading || !weekStart ? (
        <p className="text-sm text-muted">불러오는 중...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className={cardClass}>
            <div className="flex items-center justify-between gap-2">
              <h2 className={sectionTitleClass}>이번 주 계획</h2>
              {plan && (
                <Link href={`/weekly/${plan._id}`} className={`${linkClass} text-sm`}>
                  상세 보기
                </Link>
              )}
            </div>
            {plan ? (
              <div className="mt-5 flex flex-col gap-5">
                <ProgressBar value={plan.progress} label="주간 진행률" />
                {plan.goals.length === 0 ? (
                  <p className="text-sm text-muted">등록된 주간 목표가 없습니다.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {plan.goals.map((g) => (
                      <WeeklyGoalItem key={g._id} goal={g} />
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="mt-5 flex flex-col items-start gap-4">
                <p className="text-sm text-muted">이번 주 계획이 없습니다</p>
                <Link href="/weekly?new=1" className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active active:bg-primary-active">
                  이번 주 계획 만들기
                </Link>
              </div>
            )}
          </section>

          <section className={cardClass}>
            <h2 className={sectionTitleClass}>할 일 현황</h2>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {TODO_STATUSES.map((s) => (
                <div key={s} className="rounded-md bg-surface-soft px-3 py-5">
                  <div data-testid={`count-${s}`} className="text-[40px] font-bold leading-[1.1] tracking-[-1px] tabular-nums text-ink">
                    {planTodos.filter((t) => t.status === s).length}
                  </div>
                  <div className="mt-1 text-sm font-medium text-muted">{STATUS_LABEL[s]}</div>
                </div>
              ))}
            </div>
          </section>

          <section className={`${cardClass} md:col-span-2`}>
            <h2 className={sectionTitleClass}>1년 목표</h2>
            {goals.length === 0 ? (
              <p className="mt-5 text-sm text-muted">
                등록된 목표가 없습니다.{" "}
                <Link href="/goals" className={linkClass}>
                  목표 만들기
                </Link>
              </p>
            ) : (
              <ul className="mt-5 flex flex-col divide-y divide-hairline-soft">
                {goals.map((g) => {
                  // 할 일 → 주간 계획 → 1년 목표 연결이므로, 이번 주 계획이 이 목표에 연결돼 있으면 그 주의 할 일 전체가 해당된다.
                  const linked = plan?.goalId === g._id ? planTodos.length : 0;
                  return (
                    <li key={g._id} data-testid="dashboard-goal" className="min-w-0 py-4 first:pt-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 break-words text-base font-semibold text-ink">{g.title}</span>
                        <span className="shrink-0 text-sm text-muted">이번 주 연결 할 일 {linked}개</span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={g.progress} label={`${g.title} 진행률`} size="sm" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
