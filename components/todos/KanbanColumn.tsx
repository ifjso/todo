"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { STATUS_LABEL } from "@/lib/todoSort";
import type { Todo, TodoStatus } from "@/types";
import { columnDroppableId } from "./boardDnd";
import TodoCard from "./TodoCard";

interface KanbanColumnProps {
  status: TodoStatus;
  /** sortForBoard 로 정렬된 카드 목록 */
  todos: Todo[];
  highlighted: boolean;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

export default function KanbanColumn({ status, todos, highlighted, onEdit, onDelete }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: columnDroppableId(status), data: { type: "column", status } });
  const headingId = `column-heading-${status}`;

  return (
    <section
      ref={setNodeRef}
      data-testid={`column-${status}`}
      aria-labelledby={headingId}
      className={`flex min-h-40 min-w-0 flex-col rounded-xl bg-slate-100 dark:bg-neutral-800 p-3 transition-shadow ${
        highlighted ? "ring-2 ring-indigo-300" : ""
      }`}
    >
      <h2 id={headingId} className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-slate-700 dark:text-neutral-300">
        {STATUS_LABEL[status]}
        <span className="rounded-full bg-white dark:bg-neutral-900 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-neutral-400">{todos.length}</span>
      </h2>
      <SortableContext id={status} items={todos.map((t) => t._id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-1 flex-col gap-2">
          {todos.map((todo) => (
            <TodoCard key={todo._id} todo={todo} onEdit={onEdit} onDelete={onDelete} />
          ))}
          {todos.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-300 dark:border-neutral-700 py-6 text-center text-xs text-slate-400 dark:text-neutral-500">
              여기로 끌어다 놓으세요
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}
