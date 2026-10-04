"use client";

import { useEffect, useState, type FormEvent } from "react";
import Modal from "@/components/shared/Modal";
import { inputClass } from "@/components/shared/styles";
import { formatWeekRange, WEEK_DAYS } from "@/lib/date";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/todoSort";
import { useStore } from "@/store";
import { PRIORITIES, TODO_STATUSES, type Priority, type Todo, type TodoInput, type TodoStatus } from "@/types";

interface TodoFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 있으면 수정 모드 */
  todo?: Todo | null;
  /** 생성 모드 기본값 (예: 주간 계획 상세에서 요일/주간 계획 지정) */
  defaults?: Partial<TodoInput>;
  onSaved?: (todo: Todo) => void;
}

interface FormState {
  title: string;
  description: string;
  status: TodoStatus;
  priority: Priority;
  dueDate: string;
  dayOfWeek: string;
  weeklyPlanId: string;
  weeklyGoalId: string;
}

function initialState(todo?: Todo | null, defaults?: Partial<TodoInput>): FormState {
  const src = todo ?? defaults ?? {};
  return {
    title: src.title ?? "",
    description: src.description ?? "",
    status: src.status ?? "todo",
    priority: src.priority ?? "medium",
    dueDate: src.dueDate ?? "",
    dayOfWeek: src.dayOfWeek == null ? "" : String(src.dayOfWeek),
    weeklyPlanId: src.weeklyPlanId ?? "",
    weeklyGoalId: src.weeklyGoalId ?? "",
  };
}

export default function TodoFormModal(props: TodoFormModalProps) {
  if (!props.open) return null;
  // key 로 열 때마다 폼 상태를 초기화한다.
  return <TodoFormModalInner key={props.todo?._id ?? "new"} {...props} />;
}

function TodoFormModalInner({ open, onClose, todo, defaults, onSaved }: TodoFormModalProps) {
  const { weeklyPlans, weeklyLoaded, fetchWeeklyPlans, addTodo, updateTodo } = useStore();
  const [form, setForm] = useState<FormState>(() => initialState(todo, defaults));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!weeklyLoaded) void fetchWeeklyPlans().catch(() => {});
  }, [weeklyLoaded, fetchWeeklyPlans]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const weeklyGoals = weeklyPlans.find((p) => p._id === form.weeklyPlanId)?.goals ?? [];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("제목을 입력하세요.");
      return;
    }
    const input: TodoInput = {
      title: form.title.trim(),
      description: form.description,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate || null,
      dayOfWeek: form.dayOfWeek === "" ? null : Number(form.dayOfWeek),
      weeklyPlanId: form.weeklyPlanId || null,
      weeklyGoalId: form.weeklyGoalId || null,
    };
    setSaving(true);
    setError(null);
    try {
      const saved = todo ? await updateTodo(todo._id, input) : await addTodo(input);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title={todo ? "할 일 수정" : "새 할 일"} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          제목
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            autoFocus
            required
            maxLength={200}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          설명
          <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            상태
            <select className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value as TodoStatus)}>
              {TODO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            우선순위
            <select className={inputClass} value={form.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            마감일
            <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            요일
            <select className={inputClass} value={form.dayOfWeek} onChange={(e) => set("dayOfWeek", e.target.value)}>
              <option value="">미지정</option>
              {WEEK_DAYS.map((d) => (
                <option key={d.dayOfWeek} value={d.dayOfWeek}>
                  {d.label}요일
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          주간 계획
          <select
            className={inputClass}
            value={form.weeklyPlanId}
            // 주간 목표는 주간 계획에 속하므로 계획을 바꾸면 선택을 초기화한다.
            onChange={(e) => setForm((f) => ({ ...f, weeklyPlanId: e.target.value, weeklyGoalId: "" }))}
          >
            <option value="">연결 안 함</option>
            {weeklyPlans.map((p) => (
              <option key={p._id} value={p._id}>
                {formatWeekRange(p.weekStart)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          주간 목표
          <select
            className={inputClass}
            value={form.weeklyGoalId}
            disabled={!form.weeklyPlanId}
            onChange={(e) => set("weeklyGoalId", e.target.value)}
          >
            <option value="">{form.weeklyPlanId ? "연결 안 함" : "주간 계획을 먼저 선택하세요"}</option>
            {weeklyGoals.map((g) => (
              <option key={g._id} value={g._id}>
                {g.done ? "✓ " : ""}
                {g.text}
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
