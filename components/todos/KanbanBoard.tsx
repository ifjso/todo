"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useMemo, useState } from "react";
import { iconButtonClass, pageTitleClass, primaryButtonClass } from "@/components/shared/styles";
import { groupByStatus, sortForBoard, STATUS_LABEL } from "@/lib/todoSort";
import { useStore } from "@/store";
import { TODO_STATUSES, type Todo, type TodoStatus } from "@/types";
import { resolveDrop, statusFromColumnId } from "./boardDnd";
import KanbanColumn from "./KanbanColumn";
import { TodoCardPreview } from "./TodoCard";
import TodoFormModal from "./TodoFormModal";

/** 포인터 아래의 카드를 컬럼보다 우선하고, 포인터 좌표가 없으면(키보드) 가장 가까운 대상을 고른다. */
const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length === 0) return closestCorners(args);
  const cards = within.filter((c) => statusFromColumnId(String(c.id)) === null);
  return cards.length > 0 ? cards : within;
};

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

type FormState = { open: false } | { open: true; todo: Todo | null };

export default function KanbanBoard() {
  const todos = useStore((s) => s.todos);
  const todosLoaded = useStore((s) => s.todosLoaded);
  const fetchTodos = useStore((s) => s.fetchTodos);
  const moveTodo = useStore((s) => s.moveTodo);
  const deleteTodo = useStore((s) => s.deleteTodo);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TodoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ open: false });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // 터치는 길게 눌러야 드래그가 시작되어 카드 위에서도 스크롤할 수 있다.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    fetchTodos().catch((e) => setError(errorMessage(e, "할 일을 불러오지 못했습니다.")));
  }, [fetchTodos]);

  const columns = useMemo(() => {
    const groups = groupByStatus(todos);
    return Object.fromEntries(TODO_STATUSES.map((s) => [s, sortForBoard(groups[s])])) as Record<TodoStatus, Todo[]>;
  }, [todos]);

  const titleOf = (id: string | number) => todos.find((t) => t._id === id)?.title ?? "카드";
  const statusOf = (id: string): TodoStatus | null => statusFromColumnId(id) ?? todos.find((t) => t._id === id)?.status ?? null;
  const activeTodo = activeId ? todos.find((t) => t._id === activeId) : undefined;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `${titleOf(active.id)} 카드를 들었습니다.`,
    onDragOver: ({ over }) => {
      const status = over ? statusOf(String(over.id)) : null;
      return status ? `${STATUS_LABEL[status]} 컬럼 위에 있습니다.` : "드롭 영역 밖입니다.";
    },
    onDragEnd: ({ active, over }) => (over ? `${titleOf(active.id)} 카드를 놓았습니다.` : "이동을 취소했습니다."),
    onDragCancel: () => "이동을 취소했습니다.",
  };

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setError(null);
  }

  function onDragOver({ over }: DragOverEvent) {
    setOverStatus(over ? statusOf(String(over.id)) : null);
  }

  function onDragCancel() {
    setActiveId(null);
    setOverStatus(null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    onDragCancel();
    if (!over) return;
    const id = String(active.id);
    const overId = String(over.id);
    const status = statusOf(overId);
    if (!status) return;
    const translated = active.rect.current.translated;
    const placeAfter = !!translated && translated.top + translated.height / 2 > over.rect.top + over.rect.height / 2;
    const target = { status, overId: statusFromColumnId(overId) ? null : overId, placeAfter };
    let result: ReturnType<typeof resolveDrop>;
    try {
      result = resolveDrop(todos, id, target);
    } catch (e) {
      setError(`이동 위치를 계산하지 못했습니다. (${errorMessage(e, "알 수 없는 오류")})`);
      return;
    }
    if (!result) return;
    moveTodo(id, result.status, result.order).catch((e) =>
      setError(`이동에 실패해 원래 위치로 되돌렸습니다. (${errorMessage(e, "알 수 없는 오류")})`),
    );
  }

  async function onDelete(todo: Todo) {
    if (!window.confirm(`'${todo.title}' 할 일을 삭제할까요?`)) return;
    try {
      await deleteTodo(todo._id);
    } catch (e) {
      setError(`삭제에 실패했습니다. (${errorMessage(e, "알 수 없는 오류")})`);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className={pageTitleClass}>할 일</h1>
          {!todosLoaded && <span className="text-sm text-muted">불러오는 중…</span>}
        </div>
        <button
          type="button"
          onClick={() => setForm({ open: true, todo: null })}
          className={primaryButtonClass}
        >
          새 할 일
        </button>
      </div>

      {error && (
        <div role="alert" data-testid="board-error" className="flex items-center justify-between gap-3 rounded-sm bg-error-soft px-4 py-3 text-sm text-error">
          <span>{error}</span>
          <button type="button" aria-label="오류 알림 숨기기" onClick={() => setError(null)} className={`${iconButtonClass} text-error hover:bg-transparent hover:text-error-hover`}>
            ✕
          </button>
        </div>
      )}

      <DndContext
        id="kanban-board"
        sensors={sensors}
        collisionDetection={collisionDetection}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: "스페이스나 엔터로 카드를 들고, 방향키로 옮긴 뒤 다시 스페이스나 엔터로 놓습니다. ESC 로 취소합니다.",
          },
        }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TODO_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              todos={columns[status]}
              highlighted={activeId !== null && overStatus === status}
              onEdit={(todo) => setForm({ open: true, todo })}
              onDelete={onDelete}
            />
          ))}
        </div>
        <DragOverlay>{activeTodo ? <TodoCardPreview todo={activeTodo} /> : null}</DragOverlay>
      </DndContext>

      <TodoFormModal
        open={form.open}
        todo={form.open ? form.todo : null}
        onClose={() => setForm({ open: false })}
      />
    </div>
  );
}
