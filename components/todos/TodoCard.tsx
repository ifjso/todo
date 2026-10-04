"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PriorityBadge from "@/components/shared/PriorityBadge";
import { iconButtonClass } from "@/components/shared/styles";
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

const cardClass = "rounded-md border border-hairline bg-canvas p-4 transition-shadow";

function CardBody({ todo, onEdit, onDelete }: Partial<TodoCardProps> & { todo: Todo }) {
  const overdue = isOverdue(todo);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 break-words text-base font-semibold leading-[1.25] text-ink">{todo.title}</p>
        <div className="-mr-2 -mt-1.5 flex shrink-0">
          <button
            type="button"
            aria-label={`${todo.title} 수정`}
            onClick={() => onEdit?.(todo)}
            className={iconButtonClass}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M13.6 2.6a2 2 0 0 1 2.8 2.8l-8.7 8.7-3.7.9.9-3.7 8.7-8.7Z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={`${todo.title} 삭제`}
            onClick={() => onDelete?.(todo)}
            className={`${iconButtonClass} hover:bg-error-soft hover:text-error`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M8 2h4a1 1 0 0 1 1 1v1h4v2H3V4h4V3a1 1 0 0 1 1-1Zm-3 5h10l-.8 9.1A2 2 0 0 1 12.2 18H7.8a2 2 0 0 1-2-1.9L5 7Z" />
            </svg>
          </button>
        </div>
      </div>
      {todo.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{todo.description}</p>}
      <div className="mt-3 flex items-center gap-2">
        <PriorityBadge priority={todo.priority} />
        {todo.dueDate && (
          <span data-overdue={overdue ? "true" : "false"} className={`text-sm ${overdue ? "font-semibold text-error" : "text-muted"}`}>
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
      className={`${cardClass} cursor-grab touch-manipulation select-none hover:shadow-float focus:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
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
    <div className={`${cardClass} cursor-grabbing shadow-float`}>
      <CardBody todo={todo} />
    </div>
  );
}
