import { describe, expect, it } from "vitest";
import * as weekly from "@/app/api/weekly/route";
import * as todos from "@/app/api/todos/route";
import * as todo from "@/app/api/todos/[id]/route";
import { compareOrder } from "@/lib/fractionalIndex";
import { call, setupTestDB } from "../helpers";

setupTestDB();

const MISSING_ID = "64b000000000000000000000";

describe("/api/todos", () => {
  it("기본값으로 할 일을 생성하고 상태 컬럼 끝에 order 를 부여한다", async () => {
    const a = await call(todos.POST, "POST", "/api/todos", { body: { title: "A" } });
    const b = await call(todos.POST, "POST", "/api/todos", { body: { title: "B" } });
    expect(a.status).toBe(201);
    expect(a.data).toMatchObject({
      title: "A",
      description: "",
      status: "todo",
      priority: "medium",
      dueDate: null,
      dayOfWeek: null,
      weeklyPlanId: null,
      weeklyGoalId: null,
    });
    expect(compareOrder(a.data.order, b.data.order)).toBe(-1);
  });

  it("검증 실패는 400", async () => {
    const cases = [
      {},
      { title: "" },
      { title: "x", status: "blocked" },
      { title: "x", priority: "urgent" },
      { title: "x", dueDate: "2026/10/01" },
      { title: "x", dayOfWeek: 7 },
      { title: "x", dayOfWeek: 1.5 },
      { title: "x", weeklyPlanId: "nope" },
      { title: "x", weeklyPlanId: MISSING_ID },
      { title: "x", weeklyGoalId: "nope" },
      { title: "x", weeklyGoalId: MISSING_ID },
    ];
    for (const body of cases) {
      const res = await call(todos.POST, "POST", "/api/todos", { body });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("주간 목표만 지정하면 주간 계획이 자동으로 채워지고, 계획과 목표가 맞지 않으면 400", async () => {
    const w1 = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-21", goals: ["g1"] } });
    const w2 = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28", goals: ["g2"] } });
    const g1 = w1.data.goals[0]._id;

    const created = await call(todos.POST, "POST", "/api/todos", { body: { title: "t", weeklyGoalId: g1 } });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ weeklyPlanId: w1.data._id, weeklyGoalId: g1 });

    const mismatch = await call(todos.POST, "POST", "/api/todos", {
      body: { title: "t", weeklyPlanId: w2.data._id, weeklyGoalId: g1 },
    });
    expect(mismatch.status).toBe(400);

    const filtered = await call(todos.GET, "GET", `/api/todos?weeklyGoalId=${g1}`);
    expect(filtered.data.map((t: { _id: string }) => t._id)).toEqual([created.data._id]);
  });

  it("주간 계획을 바꾸면 이전 계획의 주간 목표 연결이 해제되고, 다른 계획의 목표로 수정하면 400", async () => {
    const w1 = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-21", goals: ["g1"] } });
    const w2 = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28", goals: ["g2"] } });
    const t = await call(todos.POST, "POST", "/api/todos", { body: { title: "t", weeklyGoalId: w1.data.goals[0]._id } });

    const bad = await call(todo.PATCH, "PATCH", "/api/todos/x", { id: t.data._id, body: { weeklyGoalId: w2.data.goals[0]._id } });
    expect(bad.status).toBe(400);

    const moved = await call(todo.PATCH, "PATCH", "/api/todos/x", { id: t.data._id, body: { weeklyPlanId: w2.data._id } });
    expect(moved.data).toMatchObject({ weeklyPlanId: w2.data._id, weeklyGoalId: null });

    // 상태만 바꾸는 드래그 PATCH 는 연결을 건드리지 않는다.
    const linked = await call(todo.PATCH, "PATCH", "/api/todos/x", {
      id: t.data._id,
      body: { weeklyGoalId: w2.data.goals[0]._id },
    });
    const dragged = await call(todo.PATCH, "PATCH", "/api/todos/x", { id: t.data._id, body: { status: "done", order: "a5" } });
    expect(dragged.data.weeklyGoalId).toBe(linked.data.weeklyGoalId);
  });

  it("GET 필터(status, weeklyPlanId)와 order 정렬", async () => {
    const w = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28" } });
    await call(todos.POST, "POST", "/api/todos", { body: { title: "1", order: "a2" } });
    await call(todos.POST, "POST", "/api/todos", { body: { title: "2", order: "a1", weeklyPlanId: w.data._id } });
    await call(todos.POST, "POST", "/api/todos", { body: { title: "3", status: "done", weeklyPlanId: w.data._id } });

    const todoCol = await call(todos.GET, "GET", "/api/todos?status=todo");
    expect(todoCol.data.map((t: { title: string }) => t.title)).toEqual(["2", "1"]);

    const byPlan = await call(todos.GET, "GET", `/api/todos?weeklyPlanId=${w.data._id}`);
    expect(byPlan.data).toHaveLength(2);

    expect((await call(todos.GET, "GET", "/api/todos?status=nope")).status).toBe(400);
    expect((await call(todos.GET, "GET", "/api/todos?weeklyPlanId=bad")).status).toBe(400);
  });

  it("PATCH 로 status/order 만 바꾸면 나머지 필드는 유지된다 (드래그 1회 호출)", async () => {
    const created = await call(todos.POST, "POST", "/api/todos", {
      body: { title: "카드", priority: "high", dueDate: "2026-10-10" },
    });
    const res = await call(todo.PATCH, "PATCH", "/api/todos/x", {
      id: created.data._id,
      body: { status: "doing", order: "Zz" },
    });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ title: "카드", status: "doing", order: "Zz", priority: "high", dueDate: "2026-10-10" });

    const persisted = await call(todo.GET, "GET", "/api/todos/x", { id: created.data._id });
    expect(persisted.data).toMatchObject({ status: "doing", order: "Zz" });
  });

  it("PUT 은 제목이 필수이고 null 로 연결/마감일을 해제할 수 있다", async () => {
    const created = await call(todos.POST, "POST", "/api/todos", { body: { title: "t", dueDate: "2026-10-10" } });
    const id = created.data._id;
    expect((await call(todo.PUT, "PUT", "/api/todos/x", { id, body: { description: "d" } })).status).toBe(400);
    const res = await call(todo.PUT, "PUT", "/api/todos/x", { id, body: { title: "t2", dueDate: null } });
    expect(res.data).toMatchObject({ title: "t2", dueDate: null });
  });

  it("PUT/PATCH 로 상태만 바꾸면 새 컬럼 끝 order 가 부여되어 키가 겹치지 않는다", async () => {
    const a = await call(todos.POST, "POST", "/api/todos", { body: { title: "A" } });
    const d = await call(todos.POST, "POST", "/api/todos", { body: { title: "D", status: "doing" } });
    // 컬럼별로 키를 생성하므로 두 카드의 초기 order 는 같다.
    expect(a.data.order).toBe(d.data.order);

    // 수정 모달 경로: order 없이 status 만 변경
    const moved = await call(todo.PUT, "PUT", "/api/todos/x", { id: a.data._id, body: { title: "A", status: "doing" } });
    expect(moved.data.status).toBe("doing");
    expect(compareOrder(d.data.order, moved.data.order)).toBe(-1);

    const b = await call(todos.POST, "POST", "/api/todos", { body: { title: "B", status: "done" } });
    const patched = await call(todo.PATCH, "PATCH", "/api/todos/x", { id: b.data._id, body: { status: "doing" } });
    expect(compareOrder(moved.data.order, patched.data.order)).toBe(-1);

    const orders = (await call(todos.GET, "GET", "/api/todos?status=doing")).data.map((t: { order: string }) => t.order);
    expect(new Set(orders).size).toBe(orders.length);

    // 상태가 그대로면 order 도 그대로
    const same = await call(todo.PUT, "PUT", "/api/todos/x", { id: d.data._id, body: { title: "D2", status: "doing" } });
    expect(same.data.order).toBe(d.data.order);
  });

  it("fractional index 로 해석할 수 없는 order 는 400 이고, 이후 생성도 정상 동작한다", async () => {
    for (const order of ["hello", "a", "a0".padEnd(300, "V"), 1]) {
      const res = await call(todos.POST, "POST", "/api/todos", { body: { title: "X", status: "done", order } });
      expect(res.status, String(order)).toBe(400);
    }
    const created = await call(todos.POST, "POST", "/api/todos", { body: { title: "Y", status: "done" } });
    expect(created.status).toBe(201);
    const patched = await call(todo.PATCH, "PATCH", "/api/todos/x", { id: created.data._id, body: { order: "zz" } });
    expect(patched.status).toBe(400);
  });

  it("삭제와 404/400", async () => {
    const created = await call(todos.POST, "POST", "/api/todos", { body: { title: "t" } });
    expect((await call(todo.DELETE, "DELETE", "/api/todos/x", { id: created.data._id })).status).toBe(204);
    expect((await call(todo.GET, "GET", "/api/todos/x", { id: created.data._id })).status).toBe(404);
    expect((await call(todo.PATCH, "PATCH", "/api/todos/x", { id: MISSING_ID, body: { status: "done" } })).status).toBe(404);
    expect((await call(todo.GET, "GET", "/api/todos/bad", { id: "bad" })).status).toBe(400);
  });
});
