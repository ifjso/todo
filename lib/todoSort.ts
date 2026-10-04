import { compareOrder, orderBetween } from "@/lib/fractionalIndex";
import { formatDate } from "@/lib/date";
import type { Priority, Todo, TodoStatus } from "@/types";

/** order 사전순 정렬 (칸반 드래그 위치 계산 기준) */
export function sortByOrder<T extends Pick<Todo, "order">>(todos: T[]): T[] {
  return [...todos].sort((a, b) => compareOrder(a.order, b.order));
}

/** 칸반 표시용 정렬: High 우선순위를 상단에 고정하고, 나머지는 order 순 */
export function sortForBoard<T extends Pick<Todo, "order" | "priority">>(todos: T[]): T[] {
  return [...todos].sort((a, b) => {
    const pinA = a.priority === "high" ? 0 : 1;
    const pinB = b.priority === "high" ? 0 : 1;
    return pinA - pinB || compareOrder(a.order, b.order);
  });
}

/**
 * 드롭 후 화면 순서(visualIds, 이동한 카드 포함)를 기준으로 이동한 카드의 새 order 를 계산한다.
 * High 고정 정렬 때문에 화면 순서와 order 순서가 다를 수 있으므로,
 * 이동한 카드와 같은 고정 그룹(High / 그 외)에 속한 카드들 사이에서만 이웃을 찾는다.
 */
export function computeDropOrder<T extends Pick<Todo, "_id" | "order" | "priority">>(
  visual: T[],
  movedId: string,
): string {
  const moved = visual.find((t) => t._id === movedId);
  if (!moved) throw new Error(`이동한 카드가 목록에 없습니다: ${movedId}`);
  const isPinned = (t: T) => t.priority === "high";
  const group = visual.filter((t) => isPinned(t) === isPinned(moved));
  const index = group.findIndex((t) => t._id === movedId);
  const prev = group[index - 1]?.order ?? null;
  // 기존 데이터에 같은 order 가 있으면 prev 보다 큰 첫 키를 다음 이웃으로 삼아 예외를 피한다.
  const next = group.slice(index + 1).find((t) => prev === null || compareOrder(t.order, prev) > 0)?.order ?? null;
  return orderBetween(prev, next);
}

export function groupByStatus<T extends Pick<Todo, "status">>(todos: T[]): Record<TodoStatus, T[]> {
  const groups: Record<TodoStatus, T[]> = { todo: [], doing: [], done: [] };
  for (const todo of todos) groups[todo.status].push(todo);
  return groups;
}

/** 마감일이 오늘 이전이고 아직 완료되지 않았으면 true */
export function isOverdue(todo: Pick<Todo, "dueDate" | "status">, today: Date = new Date()): boolean {
  if (!todo.dueDate || todo.status === "done") return false;
  return todo.dueDate < formatDate(today);
}

export const PRIORITY_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low" };
export const STATUS_LABEL: Record<TodoStatus, string> = { todo: "할 일", doing: "진행 중", done: "완료" };
