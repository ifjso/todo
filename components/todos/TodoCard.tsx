"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { isOverdue } from "@/lib/todoSort";
import type { Todo } from "@/types";

interface TodoCardProps {
  todo: Todo;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

function formatDue(dueDate: string): string {
  const [, month, day] = dueDate.split("-");
  return `~ ${month}/${day}`;
}

const cardClass = "rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 shadow-sm";

function CardBody({ todo, onEdit, onDelete }: Partial<TodoCardProps> & { todo: Todo }) {
  const overdue = isOverdue(todo);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 break-words text-sm font-medium text-slate-800 dark:text-neutral-200">{todo.title}</p>
        <div className="-mr-1 -mt-1 flex shrink-0">
          <button
            type="button"
            aria-label={`${todo.title} 수정`}
            onClick={() => onEdit?.(todo)}
            className="rounded p-1 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-200"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M13.6 2.6a2 2 0 0 1 2.8 2.8l-8.7 8.7-3.7.9.9-3.7 8.7-8.7Z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={`${todo.title} 삭제`}
            onClick={() => onDelete?.(todo)}
            className="rounded p-1 text-slate-400 dark:text-neutral-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M8 2h4a1 1 0 0 1 1 1v1h4v2H3V4h4V3a1 1 0 0 1 1-1Zm-3 5h10l-.8 9.1A2 2 0 0 1 12.2 18H7.8a2 2 0 0 1-2-1.9L5 7Z" />
            </svg>
          </button>
        </div>
      </div>
      {todo.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-neutral-400">{todo.description}</p>}
      <div className="mt-2 flex items-center gap-2">
        <PriorityBadge priority={todo.priority} />
        {todo.dueDate && (
          <span data-overdue={overdue ? "true" : "false"} className={`text-xs ${overdue ? "font-semibold text-red-600 dark:text-red-400" : "text-slate-500 dark:text-neutral-400"}`}>
            {formatDue(todo.dueDate)}
          </span>
        )}
      </div>
    </>
  );
}

export default function TodoCard({ todo, onEdit, onDelete }: TodoCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: todo._id,
    data: { type: "card", status: todo.status },
    // 카드 안에 버튼이 있으므로 기본 role="button" 대신 listitem 으로 둔다.
    attributes: { role: "listitem" },
  });

  return (
    <li
      ref={(node) => {
        setNodeRef(node);
        setActivatorNodeRef(node);
      }}
      data-testid="todo-card"
      data-id={todo._id}
      data-status={todo.status}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${cardClass} cursor-grab touch-manipulation select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        isDragging ? "opacity-40" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <CardBody todo={todo} onEdit={onEdit} onDelete={onDelete} />
    </li>
  );
}

/** DragOverlay 에 표시하는 드래그 중 카드 (E2E 셀렉터와 겹치지 않도록 testid 없음) */
export function TodoCardPreview({ todo }: { todo: Todo }) {
  return (
    <div className={`${cardClass} cursor-grabbing shadow-lg ring-2 ring-indigo-400`}>
      <CardBody todo={todo} />
    </div>
  );
}
