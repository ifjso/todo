import { describe, expect, it } from "vitest";
import { buildDropVisual, columnDroppableId, resolveDrop, statusFromColumnId } from "@/components/todos/boardDnd";
import { sortForBoard } from "@/lib/todoSort";
import type { Priority, Todo, TodoStatus } from "@/types";

function todo(id: string, status: TodoStatus, order: string, priority: Priority = "medium"): Todo {
  return {
    _id: id,
    title: id,
    description: "",
    status,
    priority,
    dueDate: null,
    dayOfWeek: null,
    order,
    weeklyPlanId: null,
    weeklyGoalId: null,
    createdAt: "",
    updatedAt: "",
  };
}

/** 드롭 결과를 적용한 뒤 해당 컬럼의 화면 순서 */
function columnAfter(todos: Todo[], id: string, result: { status: TodoStatus; order: string }) {
  const next = todos.map((t) => (t._id === id ? { ...t, ...result } : t));
  return sortForBoard(next.filter((t) => t.status === result.status)).map((t) => t._id);
}

const ids = (list: Todo[] | null) => list?.map((t) => t._id);

describe("column droppable id", () => {
  it("status 와 컬럼 id 를 상호 변환하고 카드 id 는 null", () => {
    expect(statusFromColumnId(columnDroppableId("doing"))).toBe("doing");
    expect(statusFromColumnId("665f1c2e9b1e8a0012345678")).toBeNull();
    expect(statusFromColumnId("column-unknown")).toBeNull();
  });
});

describe("buildDropVisual / resolveDrop", () => {
  const base = [todo("a", "todo", "a0"), todo("b", "todo", "a1"), todo("c", "todo", "a2"), todo("x", "doing", "a0")];

  it("같은 컬럼 아래로 이동: over 카드 뒤 (arrayMove)", () => {
    expect(ids(buildDropVisual(base, "a", { status: "todo", overId: "c" }))).toEqual(["b", "c", "a"]);
    const result = resolveDrop(base, "a", { status: "todo", overId: "c" });
    expect(result?.status).toBe("todo");
    expect(columnAfter(base, "a", result!)).toEqual(["b", "c", "a"]);
  });

  it("같은 컬럼 위로 이동: over 카드 앞 (arrayMove)", () => {
    const result = resolveDrop(base, "c", { status: "todo", overId: "a" });
    expect(columnAfter(base, "c", result!)).toEqual(["c", "a", "b"]);
  });

  it("위치 변화가 없으면 null (자기 자신 위, 같은 컬럼 맨 끝 카드를 컬럼 빈 영역에 드롭)", () => {
    expect(resolveDrop(base, "b", { status: "todo", overId: "b" })).toBeNull();
    expect(resolveDrop(base, "c", { status: "todo", overId: null })).toBeNull();
  });

  it("다른 컬럼 카드 위에 드롭: placeAfter 에 따라 앞/뒤에 삽입하고 status 를 바꾼다", () => {
    const before = resolveDrop(base, "b", { status: "doing", overId: "x", placeAfter: false });
    expect(before?.status).toBe("doing");
    expect(columnAfter(base, "b", before!)).toEqual(["b", "x"]);
    const after = resolveDrop(base, "b", { status: "doing", overId: "x", placeAfter: true });
    expect(columnAfter(base, "b", after!)).toEqual(["x", "b"]);
  });

  it("빈 컬럼(카드 없음)에 드롭할 수 있다", () => {
    const result = resolveDrop(base, "a", { status: "done", overId: null });
    expect(result?.status).toBe("done");
    expect(columnAfter(base, "a", result!)).toEqual(["a"]);
  });

  it("컬럼 빈 영역에 드롭하면 맨 끝에 추가", () => {
    const result = resolveDrop(base, "x", { status: "todo", overId: null });
    expect(columnAfter(base, "x", result!)).toEqual(["a", "b", "c", "x"]);
  });

  describe("High 상단 고정", () => {
    // 화면: H1, H2, M1, M2 (order 는 H2 < M1 < H1 < M2 로 섞여 있음)
    const pinned = [
      todo("H1", "todo", "a2", "high"),
      todo("H2", "todo", "a3", "high"),
      todo("M1", "todo", "a1"),
      todo("M2", "todo", "a4"),
      todo("Hx", "doing", "a0", "high"),
      todo("Mx", "doing", "a0"),
    ];

    it("High 그룹 안에서 순서 변경", () => {
      const result = resolveDrop(pinned, "H2", { status: "todo", overId: "H1" });
      expect(columnAfter(pinned, "H2", result!)).toEqual(["H2", "H1", "M1", "M2"]);
    });

    it("일반 카드 그룹 안에서 순서 변경 (High 카드 order 와 무관)", () => {
      const result = resolveDrop(pinned, "M2", { status: "todo", overId: "M1" });
      expect(columnAfter(pinned, "M2", result!)).toEqual(["H1", "H2", "M2", "M1"]);
    });

    it("일반 카드를 High 카드 위로 드롭해도 High 아래 그룹 맨 앞에 놓인다", () => {
      const result = resolveDrop(pinned, "M2", { status: "todo", overId: "H1" });
      expect(columnAfter(pinned, "M2", result!)).toEqual(["H1", "H2", "M2", "M1"]);
    });

    it("그룹 내 순서가 그대로면 null (일반 카드를 High 위로 옮겼지만 이미 그룹 맨 앞)", () => {
      expect(resolveDrop(pinned, "M1", { status: "todo", overId: "H1" })).toBeNull();
    });

    it("다른 컬럼의 High 카드를 일반 카드 사이에 드롭하면 High 그룹 끝에 놓인다", () => {
      const result = resolveDrop(pinned, "Hx", { status: "todo", overId: "M1", placeAfter: true });
      expect(result?.status).toBe("todo");
      expect(columnAfter(pinned, "Hx", result!)).toEqual(["H1", "H2", "Hx", "M1", "M2"]);
    });

    it("다른 컬럼의 일반 카드를 High 카드 사이에 드롭하면 일반 그룹 맨 앞에 놓인다", () => {
      const result = resolveDrop(pinned, "Mx", { status: "todo", overId: "H2", placeAfter: false });
      expect(columnAfter(pinned, "Mx", result!)).toEqual(["H1", "H2", "Mx", "M1", "M2"]);
    });
  });
});
