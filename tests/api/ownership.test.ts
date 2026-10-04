import { beforeEach, describe, expect, it } from "vitest";
import * as goals from "@/app/api/goals/route";
import * as goal from "@/app/api/goals/[id]/route";
import * as weekly from "@/app/api/weekly/route";
import * as plan from "@/app/api/weekly/[id]/route";
import * as todos from "@/app/api/todos/route";
import * as todo from "@/app/api/todos/[id]/route";
import { TodoModel } from "@/models/Todo";
import { call, createTestUser, setupTestDB, testUser } from "../helpers";

setupTestDB();

/** testUser(A) 가 데이터를 만들고, 다른 사용자 B 로 접근해 본다. */
describe("데이터 범위: 할 일은 사용자별, 주간 계획/1년 목표는 공용", () => {
  let bob: { userId: string; cookie: string };
  let a: { goalId: string; planId: string; weeklyGoalId: string; todoId: string };

  beforeEach(async () => {
    bob = await createTestUser("bob");
    const g = await call(goals.POST, "POST", "/api/goals", { body: { title: "공용 목표" } });
    const w = await call(weekly.POST, "POST", "/api/weekly", {
      body: { weekStart: "2026-09-28", goals: ["공용 주간 목표"], goalId: g.data._id },
    });
    const t = await call(todos.POST, "POST", "/api/todos", {
      body: { title: "A 할 일", weeklyGoalId: w.data.goals[0]._id },
    });
    a = { goalId: g.data._id, planId: w.data._id, weeklyGoalId: w.data.goals[0]._id, todoId: t.data._id };
  });

  describe("할 일 (사용자별)", () => {
    it("생성한 할 일에 로그인 사용자의 userId 가 저장된다", async () => {
      expect(String((await TodoModel.findById(a.todoId).lean())!.userId)).toBe(testUser.userId);
    });

    it("목록은 본인 할 일만 보인다", async () => {
      expect((await call(todos.GET, "GET", "/api/todos", { cookie: bob.cookie })).data).toEqual([]);
      expect((await call(todos.GET, "GET", "/api/todos")).data).toHaveLength(1);
    });

    it("다른 사용자의 할 일은 조회/수정/삭제할 수 없고(404) 데이터도 바뀌지 않는다", async () => {
      const opts = { id: a.todoId, cookie: bob.cookie };
      expect((await call(todo.GET, "GET", "/api/todos/x", opts)).status).toBe(404);
      expect((await call(todo.PUT, "PUT", "/api/todos/x", { ...opts, body: { title: "탈취" } })).status).toBe(404);
      expect((await call(todo.PATCH, "PATCH", "/api/todos/x", { ...opts, body: { status: "done" } })).status).toBe(404);
      expect((await call(todo.DELETE, "DELETE", "/api/todos/x", opts)).status).toBe(404);

      const mine = await call(todo.GET, "GET", "/api/todos/x", { id: a.todoId });
      expect(mine.data).toMatchObject({ title: "A 할 일", status: "todo", weeklyGoalId: a.weeklyGoalId });
    });

    it("할 일 order 는 사용자별 컬럼 기준으로 계산된다", async () => {
      const bobTodo = await call(todos.POST, "POST", "/api/todos", { cookie: bob.cookie, body: { title: "b" } });
      const aFirst = await TodoModel.findById(a.todoId).lean();
      expect(bobTodo.data.order).toBe(aFirst!.order);
    });
  });

  describe("주간 계획 / 1년 목표 (공용)", () => {
    it("다른 사용자도 목록과 단건을 볼 수 있다", async () => {
      const asBob = { cookie: bob.cookie };
      expect((await call(weekly.GET, "GET", "/api/weekly", asBob)).data.map((p: { _id: string }) => p._id)).toEqual([a.planId]);
      expect((await call(goals.GET, "GET", "/api/goals", asBob)).data.map((g: { _id: string }) => g._id)).toEqual([a.goalId]);
      expect((await call(plan.GET, "GET", "/api/weekly/x", { ...asBob, id: a.planId })).status).toBe(200);
      expect((await call(goal.GET, "GET", "/api/goals/x", { ...asBob, id: a.goalId })).status).toBe(200);
    });

    it("다른 사용자도 수정할 수 있고, 모두에게 반영된다", async () => {
      const asBob = { cookie: bob.cookie };
      expect((await call(plan.PATCH, "PATCH", "/api/weekly/x", { ...asBob, id: a.planId, body: { memo: "bob 메모" } })).status).toBe(200);
      expect((await call(goal.PUT, "PUT", "/api/goals/x", { ...asBob, id: a.goalId, body: { title: "수정된 공용 목표" } })).status).toBe(200);

      expect((await call(plan.GET, "GET", "/api/weekly/x", { id: a.planId })).data.memo).toBe("bob 메모");
      expect((await call(goal.GET, "GET", "/api/goals/x", { id: a.goalId })).data.title).toBe("수정된 공용 목표");
    });

    it("같은 주의 주간 계획은 사용자와 관계없이 하나만 있다 (409)", async () => {
      const dup = await call(weekly.POST, "POST", "/api/weekly", { cookie: bob.cookie, body: { weekStart: "2026-09-30" } });
      expect(dup.status).toBe(409);
    });

    it("다른 사용자가 만든 주간 계획/주간 목표에 내 할 일을 연결할 수 있다", async () => {
      const res = await call(todos.POST, "POST", "/api/todos", {
        cookie: bob.cookie,
        body: { title: "bob 할 일", weeklyGoalId: a.weeklyGoalId },
      });
      expect(res.status).toBe(201);
      expect(res.data).toMatchObject({ weeklyPlanId: a.planId, weeklyGoalId: a.weeklyGoalId });
    });

    it("주간 진행률과 주간 목표 자동 완료는 연결된 모든 사용자의 할 일로 계산된다", async () => {
      const bobTodo = await call(todos.POST, "POST", "/api/todos", {
        cookie: bob.cookie,
        body: { title: "bob 할 일", weeklyGoalId: a.weeklyGoalId },
      });
      await call(todo.PATCH, "PATCH", "/api/todos/x", { id: a.todoId, body: { status: "done" } });

      let shared = (await call(plan.GET, "GET", "/api/weekly/x", { id: a.planId })).data;
      expect(shared.progress).toBe(50);
      expect(shared.goals[0]).toMatchObject({ done: false, todoDone: 1, todoTotal: 2 });

      await call(todo.PATCH, "PATCH", "/api/todos/x", { cookie: bob.cookie, id: bobTodo.data._id, body: { status: "done" } });
      shared = (await call(plan.GET, "GET", "/api/weekly/x", { cookie: bob.cookie, id: a.planId })).data;
      expect(shared.progress).toBe(100);
      expect(shared.goals[0].done).toBe(true);
      expect((await call(goals.GET, "GET", "/api/goals", { cookie: bob.cookie })).data[0].progress).toBe(100);
    });

    it("공용 주간 계획을 지우면 모든 사용자의 할 일에서 연결이 해제된다", async () => {
      const bobTodo = await call(todos.POST, "POST", "/api/todos", {
        cookie: bob.cookie,
        body: { title: "bob 할 일", weeklyGoalId: a.weeklyGoalId, dayOfWeek: 1 },
      });
      expect((await call(plan.DELETE, "DELETE", "/api/weekly/x", { id: a.planId })).status).toBe(204);

      const bobAfter = await call(todo.GET, "GET", "/api/todos/x", { cookie: bob.cookie, id: bobTodo.data._id });
      expect(bobAfter.data).toMatchObject({ weeklyPlanId: null, weeklyGoalId: null, dayOfWeek: null });
      const mine = await call(todo.GET, "GET", "/api/todos/x", { id: a.todoId });
      expect(mine.data).toMatchObject({ weeklyPlanId: null, weeklyGoalId: null });
    });

    it("주간 목표를 삭제하면 모든 사용자의 할 일에서 그 목표 연결만 해제된다", async () => {
      const bobTodo = await call(todos.POST, "POST", "/api/todos", {
        cookie: bob.cookie,
        body: { title: "bob 할 일", weeklyGoalId: a.weeklyGoalId },
      });
      await call(plan.PATCH, "PATCH", "/api/weekly/x", { id: a.planId, body: { goals: [{ text: "새 목표" }] } });

      const bobAfter = await call(todo.GET, "GET", "/api/todos/x", { cookie: bob.cookie, id: bobTodo.data._id });
      expect(bobAfter.data).toMatchObject({ weeklyPlanId: a.planId, weeklyGoalId: null });
    });
  });
});
