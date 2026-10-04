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
      className={`flex min-h-40 min-w-0 flex-col rounded-md bg-surface-soft p-4 transition-shadow ${
        highlighted ? "ring-2 ring-ink" : ""
      }`}
    >
      <h2 id={headingId} className="mb-4 flex items-center gap-2 px-1 text-base font-semibold text-ink">
        {STATUS_LABEL[status]}
        <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-muted">{todos.length}</span>
      </h2>
      <SortableContext id={status} items={todos.map((t) => t._id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-1 flex-col gap-3">
          {todos.map((todo) => (
            <TodoCard key={todo._id} todo={todo} onEdit={onEdit} onDelete={onDelete} />
          ))}
          {todos.length === 0 && (
            <li className="rounded-md border border-dashed border-hairline py-8 text-center text-sm text-muted">
              여기로 끌어다 놓으세요
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}
