import { execFile } from "node:child_process";
import { promisify } from "node:util";
import mongoose, { type Connection } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const run = promisify(execFile);
const URI = (process.env.MONGODB_URI ?? "mongodb://localhost:27017/todo-planner-test").replace(
  /\/[^/?]+(\?|$)/,
  "/todo-planner-migration-test$1",
);

let conn: Connection;
const db = () => conn.db!;
const col = (name: string) => db().collection(name);

/** 실제 스크립트를 별도 프로세스로 실행한다. */
async function migrate(...args: string[]) {
  try {
    const { stdout } = await run("node", ["scripts/migrate-user-id.mjs", ...args], {
      env: { ...process.env, MONGODB_URI: URI },
    });
    return { code: 0, stdout };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout + e.stderr };
  }
}

const indexNames = async (name: string) => (await col(name).indexes()).map((i) => i.name);
const ownedTodos = () => col("todos").countDocuments({ userId: { $ne: null } });

/** 로그인 도입 이전 상태의 데이터: userId 없음 + 이전 할 일 인덱스 */
async function seedLegacy() {
  await col("weeklyplans").createIndex({ weekStart: 1 }, { unique: true, name: "weekStart_1" });
  await col("todos").createIndex({ status: 1, order: 1 }, { name: "status_1_order_1" });
  const plan = await col("weeklyplans").insertOne({ weekStart: "2026-09-28", goals: [], memo: "" });
  await col("todos").insertMany([
    { title: "a", status: "todo", order: "a0", weeklyPlanId: plan.insertedId },
    { title: "b", status: "done", order: "a0" },
  ]);
  await col("goals").insertOne({ title: "g" });
}

beforeAll(async () => {
  conn = await mongoose.createConnection(URI).asPromise();
});

beforeEach(async () => {
  await db().dropDatabase();
});

afterAll(async () => {
  await db().dropDatabase();
  await conn.close();
});

describe("scripts/migrate-user-id.mjs", () => {
  describe("로그인 도입 이전 데이터", () => {
    beforeEach(seedLegacy);

    it("--dry-run 은 아무것도 바꾸지 않는다", async () => {
      await col("users").insertOne({ githubId: 1, username: "octo" });
      const res = await migrate("--dry-run", "--owner", "octo");
      expect(res.code).toBe(0);
      expect(res.stdout).toContain("dry-run");
      expect(await indexNames("todos")).toContain("status_1_order_1");
      expect(await indexNames("todos")).not.toContain("userId_1");
      expect(await ownedTodos()).toBe(0);
    });

    it("--owner 없이 실행하면 인덱스만 정리하고 미할당 할 일 개수를 보고한다", async () => {
      const res = await migrate();
      expect(res.code).toBe(0);
      expect(res.stdout).toContain("소유자 없는 할 일: 2건");

      expect(await indexNames("todos")).toEqual(expect.arrayContaining(["userId_1", "userId_1_status_1_order_1"]));
      expect(await indexNames("todos")).not.toContain("status_1_order_1");
      // 공용 데이터: 같은 주 계획은 전체에서 하나 (전역 unique 유지), 소유자 인덱스 없음
      const planIndexes = await col("weeklyplans").indexes();
      expect(planIndexes.find((i) => i.name === "weekStart_1")?.unique).toBe(true);
      expect(planIndexes.map((i) => i.name)).not.toContain("userId_1_weekStart_1");
      expect(await ownedTodos()).toBe(0);
    });

    it("--owner 로 할 일만 할당하고, 주간 계획과 1년 목표에는 소유자를 붙이지 않는다. 다시 실행해도 안전하다", async () => {
      const { insertedId: ownerId } = await col("users").insertOne({ githubId: 1, username: "octo" });
      const first = await migrate("--owner", "octo");
      expect(first.code).toBe(0);
      expect(await col("todos").countDocuments({ userId: ownerId })).toBe(2);
      expect(await col("weeklyplans").countDocuments({ userId: { $exists: true } })).toBe(0);
      expect(await col("goals").countDocuments({ userId: { $exists: true } })).toBe(0);
      expect(first.stdout).toContain("소유자 없는 할 일: 0건");

      // 이후 다른 사용자가 만든 할 일은 건드리지 않는다.
      const { insertedId: otherId } = await col("users").insertOne({ githubId: 2, username: "bob" });
      await col("todos").insertOne({ title: "bob", status: "todo", order: "a0", userId: otherId });
      const second = await migrate("--owner", "octo");
      expect(second.code).toBe(0);
      expect(second.stdout).toContain("todos: 0건");
      expect(await col("todos").countDocuments({ userId: otherId })).toBe(1);
    });

    it("userId 가 null 인 할 일도 미할당으로 보고 할당한다", async () => {
      const { insertedId: ownerId } = await col("users").insertOne({ githubId: 1, username: "octo" });
      await col("todos").insertOne({ title: "null owner", status: "todo", order: "a1", userId: null });
      expect((await migrate("--owner", "octo")).code).toBe(0);
      expect(await col("todos").countDocuments({ userId: ownerId })).toBe(3);
    });

    it("같은 username 의 사용자가 여러 명이면 할당하지 않고 중단한다", async () => {
      await col("users").insertMany([
        { githubId: 1, username: "octo" },
        { githubId: 2, username: "octo" },
      ]);
      const res = await migrate("--owner", "octo");
      expect(res.code).not.toBe(0);
      expect(res.stdout).toContain("여러 명");
      expect(await ownedTodos()).toBe(0);
    });

    it("없는 사용자를 지정하면 실패하고 아무 할 일도 할당하지 않는다", async () => {
      const res = await migrate("--owner", "nobody");
      expect(res.code).not.toBe(0);
      expect(res.stdout).toContain("먼저 앱에서 GitHub 로 한 번 로그인하세요");
      expect(await ownedTodos()).toBe(0);
    });
  });

  describe("주간 계획/1년 목표를 사용자별로 나누던 시기의 데이터", () => {
    async function seedPerUserEra() {
      const { insertedId: userId } = await col("users").insertOne({ githubId: 1, username: "octo" });
      await col("weeklyplans").createIndex({ userId: 1, weekStart: 1 }, { unique: true, name: "userId_1_weekStart_1" });
      await col("weeklyplans").createIndex({ userId: 1 }, { name: "userId_1" });
      await col("goals").createIndex({ userId: 1 }, { name: "userId_1" });
      await col("weeklyplans").insertOne({ userId, weekStart: "2026-09-28", goals: [] });
      await col("goals").insertOne({ userId, title: "g" });
      return userId;
    }

    it("공용 데이터의 userId 와 소유자 인덱스를 지우고 전역 unique 인덱스를 만든다", async () => {
      await seedPerUserEra();
      const res = await migrate();
      expect(res.code).toBe(0);
      expect(await col("weeklyplans").countDocuments({ userId: { $exists: true } })).toBe(0);
      expect(await col("goals").countDocuments({ userId: { $exists: true } })).toBe(0);
      expect(await indexNames("weeklyplans")).toEqual(expect.arrayContaining(["weekStart_1"]));
      expect(await indexNames("weeklyplans")).not.toContain("userId_1_weekStart_1");
      expect(await indexNames("goals")).not.toContain("userId_1");
    });

    it("같은 주 계획이 여러 개면 전역 unique 인덱스를 만들지 않고 중단한다", async () => {
      await seedPerUserEra();
      const { insertedId: bob } = await col("users").insertOne({ githubId: 2, username: "bob" });
      await col("weeklyplans").insertOne({ userId: bob, weekStart: "2026-09-28", goals: [] });

      const res = await migrate();
      expect(res.code).not.toBe(0);
      expect(res.stdout).toContain("2026-09-28");
      // 중단 시 아무것도 바꾸지 않는다 (기존 인덱스·데이터 유지).
      expect(await indexNames("weeklyplans")).not.toContain("weekStart_1");
      expect(await indexNames("weeklyplans")).toContain("userId_1_weekStart_1");
      expect(await col("weeklyplans").countDocuments({ userId: { $exists: true } })).toBe(2);
    });
  });
});
