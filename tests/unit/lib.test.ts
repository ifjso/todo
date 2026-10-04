import { describe, expect, it } from "vitest";
import { addDays, formatWeekRange, getWeekStart, parseDate } from "@/lib/date";
import { compareOrder, isValidOrderKey, orderAfter, orderBetween } from "@/lib/fractionalIndex";
import { computeGoalProgress, computeTodoStats, computeWeeklyProgress, isWeeklyGoalDone } from "@/lib/progress";
import { computeDropOrder, groupByStatus, isOverdue, sortForBoard } from "@/lib/todoSort";
import type { Priority, TodoStatus } from "@/types";

describe("date", () => {
  it("getWeekStart 는 월요일을 반환한다 (일요일은 직전 월요일)", () => {
    expect(getWeekStart(new Date(2026, 9, 4))).toBe("2026-09-28"); // 일
    expect(getWeekStart(new Date(2026, 8, 28))).toBe("2026-09-28"); // 월
    expect(getWeekStart(new Date(2026, 9, 3))).toBe("2026-09-28"); // 토
    expect(getWeekStart(new Date(2026, 9, 5))).toBe("2026-10-05"); // 다음 월
  });

  it("parseDate 는 존재하지 않는 날짜를 거부한다", () => {
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("2026-2-3")).toBeNull();
    expect(parseDate("2026-02-28")).not.toBeNull();
  });

  it("addDays / formatWeekRange", () => {
    expect(addDays("2026-09-28", 6)).toBe("2026-10-04");
    expect(formatWeekRange("2026-09-28")).toBe("2026.09.28 ~ 10.04");
  });
});

describe("progress", () => {
  it("주간 진행률은 done 비율, 할 일이 없으면 0", () => {
    expect(computeWeeklyProgress(computeTodoStats([]))).toBe(0);
    expect(computeWeeklyProgress(computeTodoStats(["todo", "doing", "done"]))).toBe(33);
    expect(computeWeeklyProgress(computeTodoStats(["done", "done"]))).toBe(100);
  });

  it("목표 달성률은 할 일이 있는 주간 계획 진행률의 평균", () => {
    const week = (statuses: TodoStatus[]) => {
      const todoStats = computeTodoStats(statuses);
      return { todoStats, progress: computeWeeklyProgress(todoStats) };
    };
    expect(computeGoalProgress([])).toBe(0);
    expect(computeGoalProgress([week([])])).toBe(0);
    expect(computeGoalProgress([week(["done", "todo"]), week(["done"]), week([])])).toBe(75);
  });
});

describe("isWeeklyGoalDone", () => {
  it("연결된 할 일이 1개 이상이고 모두 완료일 때만 완료", () => {
    expect(isWeeklyGoalDone(0, 0)).toBe(false);
    expect(isWeeklyGoalDone(2, 1)).toBe(false);
    expect(isWeeklyGoalDone(2, 2)).toBe(true);
  });
});

describe("fractional index", () => {
  it("사이 키는 사전순으로 양 끝 사이에 위치한다", () => {
    const a = orderAfter(null);
    const c = orderAfter(a);
    const b = orderBetween(a, c);
    expect(compareOrder(a, b)).toBe(-1);
    expect(compareOrder(b, c)).toBe(-1);
    expect(compareOrder(orderBetween(null, a), a)).toBe(-1);
  });
});

type Card = { _id: string; order: string; priority: Priority; status: TodoStatus; dueDate: string | null };
const card = (id: string, order: string, priority: Priority = "medium"): Card => ({
  _id: id,
  order,
  priority,
  status: "todo",
  dueDate: null,
});

describe("todoSort", () => {
  it("sortForBoard 는 High 를 상단에 고정하고 그룹 안에서는 order 순", () => {
    const sorted = sortForBoard([card("m1", "a0"), card("h2", "a3", "high"), card("l1", "a1", "low"), card("h1", "a2", "high")]);
    expect(sorted.map((c) => c._id)).toEqual(["h1", "h2", "m1", "l1"]);
  });

  it("order 비교는 대소문자 바이트 순서를 따른다", () => {
    const sorted = sortForBoard([card("lower", "a0"), card("upper", "Zz")]);
    expect(sorted.map((c) => c._id)).toEqual(["upper", "lower"]);
  });

  it("computeDropOrder: 같은 그룹 이웃 사이 키를 만든다", () => {
    // 화면: h1, [moved m], m1, m2  → m 은 m1 앞
    const visual = [card("h1", "a5", "high"), card("m", "a9"), card("m1", "a1"), card("m2", "a2")];
    const order = computeDropOrder(visual, "m");
    expect(compareOrder(order, "a1")).toBe(-1);

    // 화면: m1, [moved m], m2 → 사이
    const between = computeDropOrder([card("m1", "a1"), card("m", "a9"), card("m2", "a2")], "m");
    expect(compareOrder("a1", between)).toBe(-1);
    expect(compareOrder(between, "a2")).toBe(-1);

    // 빈 컬럼
    expect(typeof computeDropOrder([card("m", "a9")], "m")).toBe("string");
  });

  it("computeDropOrder: 이웃 order 가 같은 기존 데이터에서도 예외 없이 키를 만든다", () => {
    // 화면: d1(a0), [moved m], d2(a0), d3(a1)
    const visual = [card("d1", "a0"), card("m", "a5"), card("d2", "a0"), card("d3", "a1")];
    const order = computeDropOrder(visual, "m");
    expect(compareOrder("a0", order)).toBe(-1);
    expect(compareOrder(order, "a1")).toBe(-1);

    // 뒤에 더 큰 키가 없으면 끝으로
    const tail = computeDropOrder([card("d1", "a0"), card("m", "a5"), card("d2", "a0")], "m");
    expect(compareOrder("a0", tail)).toBe(-1);
  });

  it("isValidOrderKey 는 fractional index 키만 허용한다", () => {
    expect(isValidOrderKey("a0")).toBe(true);
    expect(isValidOrderKey("Zz")).toBe(true);
    expect(isValidOrderKey(orderBetween("a0", "a1"))).toBe(true);
    expect(isValidOrderKey("")).toBe(false);
    expect(isValidOrderKey("hello")).toBe(false);
    expect(isValidOrderKey("a0".padEnd(300, "V"))).toBe(false);
  });

  it("computeDropOrder: High 카드는 High 그룹 안에서만 위치를 계산한다", () => {
    const visual = [card("h1", "a1", "high"), card("m1", "a0"), card("h", "a9", "high")];
    const order = computeDropOrder(visual, "h");
    expect(compareOrder("a1", order)).toBe(-1);
  });

  it("groupByStatus / isOverdue", () => {
    const groups = groupByStatus([{ status: "todo" as const }, { status: "done" as const }]);
    expect(groups.todo).toHaveLength(1);
    expect(groups.doing).toHaveLength(0);

    const today = new Date(2026, 9, 4);
    expect(isOverdue({ dueDate: "2026-10-03", status: "todo" }, today)).toBe(true);
    expect(isOverdue({ dueDate: "2026-10-04", status: "todo" }, today)).toBe(false);
    expect(isOverdue({ dueDate: "2026-10-03", status: "done" }, today)).toBe(false);
    expect(isOverdue({ dueDate: null, status: "todo" }, today)).toBe(false);
  });
});
