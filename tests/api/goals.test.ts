import { describe, expect, it } from "vitest";
import * as goals from "@/app/api/goals/route";
import * as goal from "@/app/api/goals/[id]/route";
import * as weekly from "@/app/api/weekly/route";
import * as todos from "@/app/api/todos/route";
import * as todo from "@/app/api/todos/[id]/route";
import { call, setupTestDB } from "../helpers";

setupTestDB();

const MISSING_ID = "64b000000000000000000000";

describe("/api/goals", () => {
  it("목표를 생성하고 목록/단건 조회한다", async () => {
    const created = await call(goals.POST, "POST", "/api/goals", { body: { title: " 영어 공부 ", description: "토익 900" } });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ title: "영어 공부", description: "토익 900", progress: 0, weeklyPlanCount: 0 });

    const list = await call(goals.GET, "GET", "/api/goals");
    expect(list.status).toBe(200);
    expect(list.data).toHaveLength(1);

    const one = await call(goal.GET, "GET", `/api/goals/${created.data._id}`, { id: created.data._id });
    expect(one.status).toBe(200);
    expect(one.data.title).toBe("영어 공부");
  });

  it("제목이 없으면 400", async () => {
    const res = await call(goals.POST, "POST", "/api/goals", { body: { title: "  " } });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain("제목");
  });

  it("JSON 이 아닌 본문이면 400", async () => {
    const res = await call(goals.POST, "POST", "/api/goals", { rawBody: "not-json" });
    expect(res.status).toBe(400);
  });

  it("PUT 으로 수정한다", async () => {
    const created = await call(goals.POST, "POST", "/api/goals", { body: { title: "A" } });
    const res = await call(goal.PUT, "PUT", "/api/goals/x", { id: created.data._id, body: { title: "B", description: "설명" } });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ title: "B", description: "설명" });
  });

  it("잘못된 ObjectId 는 400, 없는 id 는 404", async () => {
    expect((await call(goal.GET, "GET", "/api/goals/bad", { id: "bad" })).status).toBe(400);
    expect((await call(goal.GET, "GET", "/api/goals/x", { id: MISSING_ID })).status).toBe(404);
    expect((await call(goal.PUT, "PUT", "/api/goals/x", { id: MISSING_ID, body: { title: "x" } })).status).toBe(404);
    expect((await call(goal.DELETE, "DELETE", "/api/goals/x", { id: MISSING_ID })).status).toBe(404);
  });

  it("삭제 시 주간 계획의 연결만 해제하고 할 일은 그대로 둔다", async () => {
    const g = await call(goals.POST, "POST", "/api/goals", { body: { title: "목표" } });
    const w = await call(weekly.POST, "POST", "/api/weekly", { body: { weekStart: "2026-09-28", goalId: g.data._id } });
    const t = await call(todos.POST, "POST", "/api/todos", { body: { title: "할 일", weeklyPlanId: w.data._id } });

    const del = await call(goal.DELETE, "DELETE", "/api/goals/x", { id: g.data._id });
    expect(del.status).toBe(204);

    const plans = await call(weekly.GET, "GET", "/api/weekly");
    expect(plans.data[0]._id).toBe(w.data._id);
    expect(plans.data[0].goalId).toBeNull();
    const t2 = await call(todo.GET, "GET", "/api/todos/x", { id: t.data._id });
    expect(t2.data.weeklyPlanId).toBe(w.data._id);
  });
});
