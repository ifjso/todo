"use client";

import { useState } from "react";
import PriorityBadge from "@/components/shared/PriorityBadge";
import TodoFormModal from "@/components/todos/TodoFormModal";
import { addDays, WEEK_DAYS } from "@/lib/date";
import { sortByOrder, STATUS_LABEL } from "@/lib/todoSort";
import { useStore } from "@/store";
import type { Todo, WeeklyPlan } from "@/types";

type ModalState = { todo: Todo | null; dayOfWeek: number | null } | null;

function TodoItem({ todo, goalText, onClick }: { todo: Todo; goalText?: string; onClick: () => void }) {
  const done = todo.status === "done";
  return (
    <li data-testid="day-todo">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col gap-1 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/60 p-2 text-left text-sm hover:border-indigo-300 dark:hover:border-indigo-500"
      >
        <span className={`break-words ${done ? "text-slate-400 dark:text-neutral-500 line-through" : ""}`}>{todo.title}</span>
        <span className="flex flex-wrap items-center gap-1">
          <span className="rounded bg-indigo-50 dark:bg-indigo-500/15 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">{STATUS_LABEL[todo.status]}</span>
          <PriorityBadge priority={todo.priority} />
        </span>
        {goalText && (
          <span data-testid="day-todo-goal" className="break-words text-xs text-slate-500 dark:text-neutral-400">
            ◎ {goalText}
          </span>
        )}
      </button>
    </li>
  );
}

export default function WeekGrid({ plan }: { plan: WeeklyPlan }) {
  const todos = useStore((s) => s.todos);
  const [modal, setModal] = useState<ModalState>(null);
  const planTodos = sortByOrder(todos.filter((t) => t.weeklyPlanId === plan._id));
  const unassigned = planTodos.filter((t) => t.dayOfWeek === null);
  const goalTextOf = (t: Todo) => plan.goals.find((g) => g._id === t.weeklyGoalId)?.text;

  return (
    <section className="flex flex-col gap-4">
      <div data-testid="week-grid" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {WEEK_DAYS.map((d) => (
          <div
            key={d.dayOfWeek}
            data-testid={`day-${d.dayOfWeek}`}
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{d.label}</p>
                <p className="text-xs text-slate-500 dark:text-neutral-400">{addDays(plan.weekStart, d.offset).slice(5).replace("-", ".")}</p>
              </div>
              <button
                type="button"
                aria-label={`${d.label}요일 할 일 추가`}
                onClick={() => setModal({ todo: null, dayOfWeek: d.dayOfWeek })}
                className="h-7 w-7 rounded-full border border-slate-300 dark:border-neutral-700 text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
              >
                +
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {planTodos
                .filter((t) => t.dayOfWeek === d.dayOfWeek)
                .map((t) => (
                  <TodoItem key={t._id} todo={t} goalText={goalTextOf(t)} onClick={() => setModal({ todo: t, dayOfWeek: d.dayOfWeek })} />
                ))}
            </ul>
          </div>
        ))}
      </div>
      {unassigned.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <h3 className="mb-2 text-sm font-semibold">요일 미지정</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {unassigned.map((t) => (
              <TodoItem key={t._id} todo={t} goalText={goalTextOf(t)} onClick={() => setModal({ todo: t, dayOfWeek: null })} />
            ))}
          </ul>
        </div>
      )}
      <TodoFormModal
        open={modal !== null}
        todo={modal?.todo}
        defaults={{ weeklyPlanId: plan._id, dayOfWeek: modal?.dayOfWeek ?? null }}
        onClose={() => setModal(null)}
      />
    </section>
  );
}
