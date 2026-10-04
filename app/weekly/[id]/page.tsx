"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ProgressBar from "@/components/shared/ProgressBar";
import { inputClass } from "@/components/shared/styles";
import WeekGrid from "@/components/weekly/WeekGrid";
import WeeklyGoalItem from "@/components/weekly/WeeklyGoalItem";
import { ApiClientError } from "@/lib/apiClient";
import { formatWeekRange } from "@/lib/date";
import { useStore } from "@/store";
import { MAX_WEEKLY_GOALS, type WeeklyPlan } from "@/types";

const cardClass = "rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4";
const buttonClass = "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "요청에 실패했습니다.";
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const plan = useStore((s) => s.weeklyPlans.find((p) => p._id === id));
  const { fetchWeeklyPlan, fetchTodos, fetchGoals } = useStore();
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWeeklyPlan(id).catch((e: unknown) => {
      if (e instanceof ApiClientError && e.status === 404) setNotFound(true);
      else setError(errMsg(e));
    });
    void fetchTodos().catch(() => {});
    void fetchGoals().catch(() => {});
  }, [id, fetchWeeklyPlan, fetchTodos, fetchGoals]);

  if (notFound) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-slate-700 dark:text-neutral-300">주간 계획을 찾을 수 없습니다</p>
        <Link href="/weekly" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          주간 계획 목록으로
        </Link>
      </div>
    );
  }
  if (!plan) {
    return error ? (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    ) : (
      <p className="text-slate-500 dark:text-neutral-400">불러오는 중...</p>
    );
  }
  return <PlanDetail key={plan._id} plan={plan} />;
}

function PlanDetail({ plan }: { plan: WeeklyPlan }) {
  const router = useRouter();
  const { goals, updateWeeklyPlan, deleteWeeklyPlan } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [memo, setMemo] = useState(plan.memo);
  const [retro, setRetro] = useState(plan.retrospective);
  const [saved, setSaved] = useState<"memo" | "retrospective" | null>(null);
  const [newGoal, setNewGoal] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  const saveText = (field: "memo" | "retrospective", value: string) =>
    run(async () => {
      setSaved(null);
      await updateWeeklyPlan(plan._id, { [field]: value });
      setSaved(field);
    });

  // 기존 목표는 _id 를 함께 보내야 연결된 할 일이 유지된다.
  const saveGoals = (goalsNext: { _id?: string; text: string }[]) =>
    run(() => updateWeeklyPlan(plan._id, { goals: goalsNext }));
  const currentGoals = () => plan.goals.map(({ _id, text }) => ({ _id, text }));

  function onAddGoal(e: FormEvent) {
    e.preventDefault();
    const text = newGoal.trim();
    if (!text) return;
    setNewGoal("");
    void saveGoals([...currentGoals(), { text }]);
  }

  const onDelete = () =>
    run(async () => {
      if (!window.confirm("이 주간 계획을 삭제할까요?")) return;
      await deleteWeeklyPlan(plan._id);
      router.push("/weekly");
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Link href="/weekly" className="text-xs text-slate-500 dark:text-neutral-400 hover:underline">
            ← 주간 계획
          </Link>
          <h1 className="text-xl font-bold">{formatWeekRange(plan.weekStart)}</h1>
        </div>
        <button type="button" onClick={onDelete} className="rounded-lg border border-red-300 dark:border-red-500/40 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
          삭제
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <section className={`${cardClass} flex flex-col gap-1`}>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <ProgressBar label="주간 진행률" value={plan.progress} />
          </div>
          <span className="text-sm text-slate-600 dark:text-neutral-400">
            완료 {plan.todoStats.done} / 전체 {plan.todoStats.total}
          </span>
        </div>
      </section>

      <section className={`${cardClass} flex flex-col gap-3`}>
        <div>
          <h2 className="font-semibold">주간 목표</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">연결된 할 일이 모두 완료되면 자동으로 완료됩니다.</p>
        </div>
        <ul className="flex flex-col gap-2">
          {plan.goals.map((g) => (
            <WeeklyGoalItem key={g._id} goal={g}>
              <button
                type="button"
                aria-label={`${g.text} 삭제`}
                onClick={() => {
                  if (g.todoTotal > 0 && !window.confirm(`연결된 할 일 ${g.todoTotal}개의 주간 목표 연결이 해제됩니다. 삭제할까요?`)) return;
                  void saveGoals(currentGoals().filter((item) => item._id !== g._id));
                }}
                className="rounded px-2 text-slate-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
              >
                ✕
              </button>
            </WeeklyGoalItem>
          ))}
        </ul>
        {plan.goals.length < MAX_WEEKLY_GOALS && (
          <form onSubmit={onAddGoal} className="flex gap-2">
            <input className={inputClass} aria-label="새 주간 목표" value={newGoal} maxLength={200} onChange={(e) => setNewGoal(e.target.value)} />
            <button type="submit" className="shrink-0 rounded-lg border border-slate-300 dark:border-neutral-700 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-neutral-800">
              목표 추가
            </button>
          </form>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium">
          1년 목표
          <select
            className={inputClass}
            value={plan.goalId ?? ""}
            onChange={(e) => void run(() => updateWeeklyPlan(plan._id, { goalId: e.target.value || null }))}
          >
            <option value="">연결 안 함</option>
            {goals.map((g) => (
              <option key={g._id} value={g._id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
      </section>

      <WeekGrid plan={plan} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className={`${cardClass} flex flex-col gap-2`}>
          <label className="flex flex-col gap-1 text-sm font-medium">
            메모
            <textarea className={inputClass} rows={4} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>
          <div className="flex items-center justify-end gap-3">
            {saved === "memo" && <span className="text-sm text-green-600 dark:text-green-400">저장됨</span>}
            <button type="button" className={buttonClass} onClick={() => void saveText("memo", memo)}>
              메모 저장
            </button>
          </div>
        </section>
        <section className={`${cardClass} flex flex-col gap-2`}>
          <label className="flex flex-col gap-1 text-sm font-medium">
            회고
            <textarea className={inputClass} rows={4} value={retro} onChange={(e) => setRetro(e.target.value)} />
          </label>
          <div className="flex items-center justify-end gap-3">
            {saved === "retrospective" && <span className="text-sm text-green-600 dark:text-green-400">저장됨</span>}
            <button type="button" className={buttonClass} onClick={() => void saveText("retrospective", retro)}>
              회고 저장
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
