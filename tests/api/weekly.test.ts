import { describe, expect, it } from "vitest";
import * as goals from "@/app/api/goals/route";
import * as weekly from "@/app/api/weekly/route";
import * as plan from "@/app/api/weekly/[id]/route";
import * as todos from "@/app/api/todos/route";
import * as todo from "@/app/api/todos/[id]/route";
import { call, setupTestDB } from "../helpers";

setupTestDB();

const MISSING_ID = "64b000000000000000000000";

describe("/api/weekly", () => {
  it("주간 계획을 생성하면 weekStart 를 월요일로 정규화하고 진행률 필드를 포함한다", async () => {
    // 2026-10-01 은 목요일 → 2026-09-28(월)
    const res = await call(weekly.POST, "POST", "/api/weekly", {
      // done 은 입력으로 받지 않는다 (연결된 할 일로 계산)
      body: { weekStart: "2026-10-01", goals: ["운동 3회", { text: "책 1권", done: true }], memo: "메모" },
    });
    expect(res.status).toBe(201);
    expect(res.data).toMatchObject({
      weekStart: "2026-09-28",
      memo: "메모",
      retrospective: "",
      goalId: null,
      progress: 0,
      todoStats: { total: 0, todo: 0, doing: 0, done: 0 },
    });
    expect(res.data.goals.map((g: { text: string; done: boolean; todoTotal: number }) => [g.text, g.done, g.todoTotal])).toEqual([
      ["운동 3회", false, 0],
      ["책 1권", false, 0],
    ]);
  });

  it("같은 주 중복 생성은 409", async () => {
    await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28" } });
    const dup = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-10-04" } });
    expect(dup.status).toBe(409);
  });

  it("PUT 으로 다른 주와 겹치게 바꾸면 409", async () => {
    await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28" } });
    const b = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-10-05" } });
    const res = await call(plan.PUT, "PUT", "/api/weekly/x", { id: b.data._id, body: { weekStart: "2026-09-30" } });
    expect(res.status).toBe(409);
  });

  it("주간 목표가 5개를 넘으면 400", async () => {
    const res = await call(weekly.POST, "POST", "/api/weekly", {
      body: { weekStart: "2026-09-28", goals: ["1", "2", "3", "4", "5", "6"] },
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain("최대 5개");
  });

  it("weekStart 형식이 틀리거나 없으면 400, 존재하지 않는 목표 연결도 400", async () => {
    expect((await call(weekly.POST, "POST", "/api/weekly", { body: {} })).status).toBe(400);
    expect((await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-13-01" } })).status).toBe(400);
    const res = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28", goalId: MISSING_ID } });
    expect(res.status).toBe(400);
  });

  it("GET 은 weekStart 필터와 최신순 정렬을 지원한다", async () => {
    await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-21" } });
    await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28" } });
    const all = await call(weekly.GET, "GET", "/api/weekly");
    expect(all.data.map((p: { weekStart: string }) => p.weekStart)).toEqual(["2026-09-28", "2026-09-21"]);
    const filtered = await call(weekly.GET, "GET", "/api/weekly?weekStart=2026-09-23");
    expect(filtered.data).toHaveLength(1);
    expect(filtered.data[0].weekStart).toBe("2026-09-21");
  });

  it("주간 목표는 연결된 할 일이 모두 완료되면 자동 완료되고, 하나라도 미완료가 되면 다시 미완료가 된다", async () => {
    const created = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28", goals: ["a", "b"] } });
    const id = created.data._id;
    const [goalA, goalB] = created.data.goals;
    const mk = (title: string, weeklyGoalId: string) =>
      call(todos.POST, "POST", "/api/todos", { body: { title, weeklyPlanId: id, weeklyGoalId } });
    const t1 = await mk("a-1", goalA._id);
    const t2 = await mk("a-2", goalA._id);
    // 주간 목표에 연결되지 않은 할 일은 어떤 주간 목표 완료에도 영향이 없다.
    await call(todos.POST, "POST", "/api/todos", { body: { title: "free", weeklyPlanId: id } });

    const goalsOf = async () => (await call(plan.GET, "GET", "/api/weekly/x", { id })).data.goals;
    expect((await goalsOf()).map((g: { done: boolean; todoTotal: number; todoDone: number }) => [g.done, g.todoDone, g.todoTotal])).toEqual([
      [false, 0, 2],
      [false, 0, 0],
    ]);

    await call(todo.PATCH, "PATCH", "/api/todos/x", { id: t1.data._id, body: { status: "done" } });
    expect((await goalsOf())[0]).toMatchObject({ done: false, todoDone: 1, todoTotal: 2 });

    await call(todo.PATCH, "PATCH", "/api/todos/x", { id: t2.data._id, body: { status: "done" } });
    const done = await goalsOf();
    expect(done[0]).toMatchObject({ _id: goalA._id, done: true, todoDone: 2, todoTotal: 2 });
    // 할 일이 없는 주간 목표는 완료로 보지 않는다.
    expect(done[1]).toMatchObject({ _id: goalB._id, done: false, todoTotal: 0 });

    await call(todo.PATCH, "PATCH", "/api/todos/x", { id: t2.data._id, body: { status: "doing" } });
    expect((await goalsOf())[0].done).toBe(false);

    // 미완료 할 일을 삭제하면 남은 할 일이 모두 완료이므로 다시 완료
    await call(todo.DELETE, "DELETE", "/api/todos/x", { id: t2.data._id });
    expect((await goalsOf())[0]).toMatchObject({ done: true, todoDone: 1, todoTotal: 1 });
  });

  it("주간 목표 완료를 수동으로 바꿀 수 없다", async () => {
    const created = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28", goals: ["a"] } });
    const id = created.data._id;
    const goalA = created.data.goals[0];

    const legacy = await call(plan.PATCH, "PATCH", "/api/weekly/x", { id, body: { goalIndex: 0, done: true } });
    expect(legacy.data.goals[0].done).toBe(false);

    const put = await call(plan.PUT, "PUT", "/api/weekly/x", { id, body: { goals: [{ _id: goalA._id, text: "a", done: true }] } });
    expect(put.data.goals[0]).toMatchObject({ _id: goalA._id, done: false });
  });

  it("주간 목표를 편집해도 _id 가 유지되어 연결이 보존되고, 삭제된 목표의 할 일은 연결만 해제된다", async () => {
    const created = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28", goals: ["a", "b"] } });
    const id = created.data._id;
    const [goalA, goalB] = created.data.goals;
    const ta = await call(todos.POST, "POST", "/api/todos", { body: { title: "ta", weeklyGoalId: goalA._id, status: "done" } });
    const tb = await call(todos.POST, "POST", "/api/todos", { body: { title: "tb", weeklyGoalId: goalB._id } });

    // a 는 이름만 바꾸고, b 는 삭제, c 는 추가
    const res = await call(plan.PATCH, "PATCH", "/api/weekly/x", {
      id,
      body: { goals: [{ _id: goalA._id, text: "a2" }, { text: "c" }] },
    });
    expect(res.status).toBe(200);
    expect(res.data.goals.map((g: { _id: string; text: string }) => g.text)).toEqual(["a2", "c"]);
    expect(res.data.goals[0]).toMatchObject({ _id: goalA._id, done: true, todoTotal: 1 });

    expect((await call(todo.GET, "GET", "/api/todos/x", { id: ta.data._id })).data.weeklyGoalId).toBe(goalA._id);
    const orphan = (await call(todo.GET, "GET", "/api/todos/x", { id: tb.data._id })).data;
    expect(orphan).toMatchObject({ weeklyGoalId: null, weeklyPlanId: id });
  });

  it("다른 주간 계획의 주간 목표 _id 로 편집하면 400", async () => {
    const a = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-21", goals: ["a"] } });
    const b = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28", goals: ["b"] } });
    const res = await call(plan.PATCH, "PATCH", "/api/weekly/x", {
      id: b.data._id,
      body: { goals: [{ _id: a.data.goals[0]._id, text: "x" }] },
    });
    expect(res.status).toBe(400);
    const bad = await call(plan.PATCH, "PATCH", "/api/weekly/x", { id: b.data._id, body: { goals: [{ _id: "nope", text: "x" }] } });
    expect(bad.status).toBe(400);
  });

  it("PATCH 로 메모/회고를 부분 수정한다", async () => {
    const created = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28", memo: "m" } });
    const res = await call(plan.PATCH, "PATCH", "/api/weekly/x", { id: created.data._id, body: { retrospective: "잘했다" } });
    expect(res.data).toMatchObject({ memo: "m", retrospective: "잘했다" });
  });

  it("잘못된 id 는 400, 없는 id 는 404", async () => {
    expect((await call(plan.GET, "GET", "/api/weekly/bad", { id: "bad" })).status).toBe(400);
    expect((await call(plan.GET, "GET", "/api/weekly/x", { id: MISSING_ID })).status).toBe(404);
    expect((await call(plan.DELETE, "DELETE", "/api/weekly/x", { id: MISSING_ID })).status).toBe(404);
  });

  it("삭제 시 할 일은 남기고 연결만 해제한다", async () => {
    const w = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28", goals: ["g"] } });
    const t = await call(todos.POST, "POST", "/api/todos", {
      body: { title: "t", weeklyGoalId: w.data.goals[0]._id, dayOfWeek: 1 },
    });
    expect((await call(plan.DELETE, "DELETE", "/api/weekly/x", { id: w.data._id })).status).toBe(204);
    const after = await call(todo.GET, "GET", "/api/todos/x", { id: t.data._id });
    expect(after.data).toMatchObject({ weeklyPlanId: null, weeklyGoalId: null, dayOfWeek: null });
  });

  it("목표 연결 시 목표의 weeklyPlanCount 가 늘어난다", async () => {
    const g = await call(goals.POST, "POST", "/api/goals", { body: { title: "g" } });
    await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28", goalId: g.data._id } });
    const list = await call(goals.GET, "GET", "/api/goals");
    expect(list.data[0].weeklyPlanCount).toBe(1);
  });
});
