"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/shared/Modal";
import { inputClass } from "@/components/shared/styles";
import { getWeekStart, parseDate } from "@/lib/date";
import { useStore } from "@/store";
import { MAX_WEEKLY_GOALS } from "@/types";

export default function WeeklyPlanForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <WeeklyPlanFormInner onClose={onClose} />;
}

function WeeklyPlanFormInner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { goals, goalsLoaded, fetchGoals, addWeeklyPlan } = useStore();
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [goalTexts, setGoalTexts] = useState<string[]>([""]);
  const [memo, setMemo] = useState("");
  const [goalId, setGoalId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!goalsLoaded) void fetchGoals().catch(() => {});
  }, [goalsLoaded, fetchGoals]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const date = parseDate(weekStart);
    if (!date) {
      setError("주 시작일을 입력하세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const plan = await addWeeklyPlan({
        weekStart: getWeekStart(date),
        goals: goalTexts.map((t) => t.trim()).filter(Boolean).map((text) => ({ text })),
        memo,
        goalId: goalId || null,
      });
      onClose();
      router.push(`/weekly/${plan._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setSaving(false);
    }
  }

  return (
    <Modal open title="새 주간 계획" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          주 시작일
          <input type="date" className={inputClass} value={weekStart} onChange={(e) => setWeekStart(e.target.value)} required />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">주간 목표</legend>
          {goalTexts.map((text, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={inputClass}
                aria-label={`주간 목표 ${i + 1}`}
                value={text}
                maxLength={200}
                onChange={(e) => setGoalTexts((list) => list.map((t, j) => (j === i ? e.target.value : t)))}
              />
              <button
                type="button"
                aria-label={`주간 목표 ${i + 1} 삭제`}
                onClick={() => setGoalTexts((list) => list.filter((_, j) => j !== i))}
                className="rounded px-2 text-slate-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={goalTexts.length >= MAX_WEEKLY_GOALS}
            onClick={() => setGoalTexts((list) => [...list, ""])}
            className="self-start rounded-lg border border-slate-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            목표 추가
          </button>
        </fieldset>
        <label className="flex flex-col gap-1 text-sm font-medium">
          메모
          <textarea className={inputClass} rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          1년 목표
          <select className={inputClass} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">연결 안 함</option>
            {goals.map((g) => (
              <option key={g._id} value={g._id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800">
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </form>
    </Modal>
  );
}
