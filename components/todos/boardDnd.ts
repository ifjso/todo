import { computeDropOrder, sortForBoard } from "@/lib/todoSort";
import { TODO_STATUSES, type Todo, type TodoStatus } from "@/types";

const COLUMN_PREFIX = "column-";

export function columnDroppableId(status: TodoStatus): string {
  return `${COLUMN_PREFIX}${status}`;
}

/** 컬럼 드롭 영역 id 이면 해당 status, 카드 id 이면 null */
export function statusFromColumnId(id: string): TodoStatus | null {
  if (!id.startsWith(COLUMN_PREFIX)) return null;
  const status = id.slice(COLUMN_PREFIX.length) as TodoStatus;
  return TODO_STATUSES.includes(status) ? status : null;
}

export interface DropTarget {
  status: TodoStatus;
  /** 드롭한 위치의 카드 id. 컬럼 빈 영역에 드롭했으면 null (맨 끝에 추가) */
  overId: string | null;
  /** 다른 컬럼의 카드 위에 드롭할 때 그 카드 아래에 넣을지 여부 */
  placeAfter?: boolean;
}

/**
 * 드롭 위치를 반영한 대상 컬럼의 화면 순서(이동 카드 포함)를 만든다.
 * 같은 컬럼 이동은 arrayMove 기준(over 카드의 인덱스로 이동), 다른 컬럼은 over 카드 앞/뒤에 삽입한다.
 */
export function buildDropVisual<T extends Todo>(todos: T[], activeId: string, target: DropTarget): T[] | null {
  const moved = todos.find((t) => t._id === activeId);
  if (!moved || target.overId === activeId) return null;
  const column = sortForBoard(todos.filter((t) => t.status === target.status && t._id !== activeId));
  const overIndex = target.overId ? column.findIndex((t) => t._id === target.overId) : -1;

  let insertAt: number;
  if (overIndex === -1) {
    insertAt = column.length;
  } else if (moved.status === target.status) {
    // arrayMove: 원래 위치보다 아래로 옮기면 over 카드 뒤, 위로 옮기면 over 카드 앞
    const original = sortForBoard(todos.filter((t) => t.status === target.status));
    const oldIndex = original.findIndex((t) => t._id === activeId);
    const newIndex = original.findIndex((t) => t._id === target.overId);
    insertAt = newIndex > oldIndex ? overIndex + 1 : overIndex;
  } else {
    insertAt = target.placeAfter ? overIndex + 1 : overIndex;
  }

  return [...column.slice(0, insertAt), { ...moved, status: target.status }, ...column.slice(insertAt)];
}

/** 드롭 결과로 저장할 status/order 를 계산한다. 위치 변화가 없으면 null. */
export function resolveDrop<T extends Todo>(
  todos: T[],
  activeId: string,
  target: DropTarget,
): { status: TodoStatus; order: string } | null {
  const moved = todos.find((t) => t._id === activeId);
  const visual = buildDropVisual(todos, activeId, target);
  if (!moved || !visual) return null;

  if (moved.status === target.status) {
    // 같은 고정 그룹(High / 그 외) 안의 순서가 그대로면 저장할 필요가 없다.
    const pinned = moved.priority === "high";
    const groupIds = (list: T[]) =>
      list.filter((t) => (t.priority === "high") === pinned).map((t) => t._id).join(",");
    const before = sortForBoard(todos.filter((t) => t.status === target.status));
    if (groupIds(before) === groupIds(visual)) return null;
  }

  return { status: target.status, order: computeDropOrder(visual, activeId) };
}
