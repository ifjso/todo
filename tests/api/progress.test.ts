import { describe, expect, it } from "vitest";
import * as goals from "@/app/api/goals/route";
import * as goal from "@/app/api/goals/[id]/route";
import * as weekly from "@/app/api/weekly/route";
import * as plan from "@/app/api/weekly/[id]/route";
import * as todos from "@/app/api/todos/route";
import * as todo from "@/app/api/todos/[id]/route";
import { call, setupTestDB } from "../helpers";

setupTestDB();

describe("진행률 자동 반영 (할 일 → 주간 → 1년 목표)", () => {
  it("할 일 상태 변경이 주간 진행률과 목표 달성률에 즉시 반영된다", async () => {
    const g = await call(goals.POST, "POST", "/api/goals", { body: { title: "1년 목표" } });
    const w1 = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-21", goalId: g.data._id } });
    const w2 = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28", goalId: g.data._id } });
    // 할 일이 없는 주간 계획은 목표 평균에서 제외된다.
    await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-10-05", goalId: g.data._id } });

    const mk = (title: string, weeklyPlanId: string) =>
      call(todos.POST, "POST", "/api/todos", { body: { title, weeklyPlanId } });
    const a = await mk("a", w1.data._id);
    await mk("b", w1.data._id);
    const c = await mk("c", w2.data._id);

    let g1 = await call(goal.GET, "GET", "/api/goals/x", { id: g.data._id });
    expect(g1.data.progress).toBe(0);
    expect(g1.data.weeklyPlanCount).toBe(3);

    // w1: 1/2 = 50%, w2: 0/1 = 0% → 목표 25%
    await call(todo.PATCH, "PATCH", "/api/todos/x", { id: a.data._id, body: { status: "done" } });
    const p1 = await call(plan.GET, "GET", "/api/weekly/x", { id: w1.data._id });
    expect(p1.data.progress).toBe(50);
    expect(p1.data.todoStats).toEqual({ total: 2, todo: 1, doing: 0, done: 1 });
    g1 = await call(goal.GET, "GET", "/api/goals/x", { id: g.data._id });
    expect(g1.data.progress).toBe(25);

    // w2: doing 은 완료가 아니다
    await call(todo.PATCH, "PATCH", "/api/todos/x", { id: c.data._id, body: { status: "doing" } });
    g1 = await call(goal.GET, "GET", "/api/goals/x", { id: g.data._id });
    expect(g1.data.progress).toBe(25);

    // w2: 1/1 = 100% → (50 + 100) / 2 = 75%
    await call(todo.PATCH, "PATCH", "/api/todos/x", { id: c.data._id, body: { status: "done" } });
    const list = await call(goals.GET, "GET", "/api/goals");
    expect(list.data[0].progress).toBe(75);

    const plans = await call(weekly.GET, "GET", "/api/weekly");
    expect(plans.data.map((p: { weekStart: string; progress: number }) => [p.weekStart, p.progress])).toEqual([
      ["2026-10-05", 0],
      ["2026-09-28", 100],
      ["2026-09-21", 50],
    ]);
  });

  it("할 일 삭제도 진행률에 반영된다", async () => {
    const w = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28" } });
    const a = await call(todos.POST, "POST", "/api/todos", { body: { title: "a", weeklyPlanId: w.data._id, status: "done" } });
    const b = await call(todos.POST, "POST", "/api/todos", { body: { title: "b", weeklyPlanId: w.data._id } });
    expect((await call(plan.GET, "GET", "/api/weekly/x", { id: w.data._id })).data.progress).toBe(50);
    await call(todo.DELETE, "DELETE", "/api/todos/x", { id: b.data._id });
    expect((await call(plan.GET, "GET", "/api/weekly/x", { id: w.data._id })).data.progress).toBe(100);
    expect(a.data.status).toBe("done");
  });
});
