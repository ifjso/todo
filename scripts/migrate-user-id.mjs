#!/usr/bin/env node
/**
 * 로그인 도입에 따른 데이터 마이그레이션: 할 일(todos)에 userId(소유자) 추가.
 * 주간 계획(weeklyplans)과 1년 목표(goals)는 모든 사용자가 함께 쓰는 공용 데이터라 소유자를 두지 않는다.
 *
 *   npm run db:migrate:user-id -- --dry-run              # 변경 없이 계획만 출력
 *   npm run db:migrate:user-id                           # 인덱스만 정리하고 미할당 할 일 개수 보고
 *   npm run db:migrate:user-id -- --owner <GitHub 아이디>  # 소유자 없는 할 일을 해당 사용자에게 할당
 *
 * - todos: userId 인덱스를 만들고, 소유자 없는 할 일을 --owner 사용자에게 할당한다.
 * - weeklyplans / goals: 사용자별로 나누던 시기에 생긴 userId 필드·인덱스를 정리하고,
 *   같은 주 계획이 하나만 있도록 전역 unique 인덱스(weekStart_1)를 보장한다.
 * - --owner 사용자는 먼저 앱에서 GitHub 로 한 번 로그인해 users 컬렉션에 있어야 한다.
 * - 여러 번 실행해도 안전하다 (이미 소유자가 있는 할 일은 건드리지 않는다).
 */
import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";
import mongoose from "mongoose";

// userId 가 없거나 null 인 할 일
const UNOWNED = { userId: null };

function parseArgs(argv) {
  const args = { dryRun: false, owner: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--owner") args.owner = argv[++i] ?? null;
    else if (argv[i].startsWith("--owner=")) args.owner = argv[i].slice("--owner=".length);
    else throw new Error(`알 수 없는 인자: ${argv[i]}`);
  }
  if (args.owner === "") throw new Error("--owner 에 GitHub 아이디를 지정하세요.");
  return args;
}

async function indexExists(collection, name) {
  try {
    return (await collection.indexes()).some((index) => index.name === name);
  } catch (error) {
    if (error.codeName === "NamespaceNotFound") return false;
    throw error;
  }
}

async function migrateIndexes(db, { dryRun }, log) {
  const prefix = dryRun ? "[dry-run] " : "";
  const plans = db.collection("weeklyplans");
  const todos = db.collection("todos");
  const goals = db.collection("goals");

  // 같은 주 계획이 둘 이상이면 전역 unique 인덱스를 만들 수 없으므로, 아무것도 바꾸기 전에 중단한다.
  const needsWeekIndex = !(await indexExists(plans, "weekStart_1"));
  if (needsWeekIndex) {
    const duplicates = await plans
      .aggregate([{ $group: { _id: "$weekStart", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }])
      .toArray();
    if (duplicates.length > 0) {
      throw new Error(
        `같은 주의 주간 계획이 여러 개 있습니다: ${duplicates.map((d) => d._id).join(", ")}. 하나만 남기고 정리한 뒤 다시 실행하세요.`,
      );
    }
  }

  // 공용 데이터에는 소유자 인덱스가 필요 없다. 할 일은 사용자별 인덱스로 바꾼다.
  for (const [collection, name] of [
    [plans, "userId_1_weekStart_1"],
    [plans, "userId_1"],
    [goals, "userId_1"],
    [todos, "status_1_order_1"],
  ]) {
    if (await indexExists(collection, name)) {
      log(`${prefix}${collection.collectionName}: 이전 인덱스 ${name} 삭제`);
      if (!dryRun) await collection.dropIndex(name);
    }
  }

  if (needsWeekIndex) {
    log(`${prefix}weeklyplans: 인덱스 weekStart_1(unique) 생성`);
    if (!dryRun) await plans.createIndex({ weekStart: 1 }, { unique: true, name: "weekStart_1" });
  }

  for (const [keys, name] of [
    [{ userId: 1, status: 1, order: 1 }, "userId_1_status_1_order_1"],
    [{ userId: 1 }, "userId_1"],
  ]) {
    if (await indexExists(todos, name)) continue;
    log(`${prefix}todos: 인덱스 ${name} 생성`);
    if (!dryRun) await todos.createIndex(keys, { name });
  }
}

/** 사용자별로 나누던 시기에 공용 데이터에 붙은 userId 를 제거한다. */
async function removeSharedOwners(db, { dryRun }, log) {
  for (const name of ["weeklyplans", "goals"]) {
    const filter = { userId: { $exists: true } };
    const count = await db.collection(name).countDocuments(filter);
    if (count === 0) continue;
    log(`${dryRun ? "[dry-run] " : ""}${name}: 공용 데이터의 userId ${count}건 제거`);
    if (!dryRun) await db.collection(name).updateMany(filter, { $unset: { userId: "" } });
  }
}

async function assignOwner(db, username, { dryRun }, log) {
  const owners = await db.collection("users").find({ username }).limit(2).toArray();
  if (owners.length === 0) {
    throw new Error(`users 에 '${username}' 사용자가 없습니다. 먼저 앱에서 GitHub 로 한 번 로그인하세요.`);
  }
  // username 은 GitHub 에서 바뀌거나 재사용될 수 있어 고유하지 않다. 모호하면 할당하지 않는다.
  if (owners.length > 1) {
    throw new Error(`users 에 '${username}' 사용자가 여러 명입니다. 중복 사용자를 정리한 뒤 다시 실행하세요.`);
  }
  const [owner] = owners;
  const todos = db.collection("todos");
  if (dryRun) {
    log(`[dry-run] todos: ${await todos.countDocuments(UNOWNED)}건을 '${username}' 에게 할당 예정`);
    return;
  }
  const result = await todos.updateMany(UNOWNED, { $set: { userId: owner._id } });
  log(`todos: ${result.modifiedCount}건을 '${username}' 에게 할당`);
}

export async function migrate(argv, log = console.log) {
  const args = parseArgs(argv);
  nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error: console.error });
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI 환경 변수가 설정되지 않았습니다.");

  const conn = await mongoose.createConnection(uri).asPromise();
  try {
    const db = conn.db;
    log(`DB: ${db.databaseName}${args.dryRun ? " (dry-run: 변경하지 않음)" : ""}`);
    await migrateIndexes(db, args, log);
    await removeSharedOwners(db, args, log);
    if (args.owner) await assignOwner(db, args.owner, args, log);
    const remaining = await db.collection("todos").countDocuments(UNOWNED);
    log(`소유자 없는 할 일: ${remaining}건`);
    if (!args.owner && remaining > 0) {
      log("→ --owner <GitHub 아이디> 로 할당하기 전까지 이 할 일은 어떤 사용자에게도 보이지 않습니다.");
    }
    return remaining;
  } finally {
    await conn.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate(process.argv.slice(2)).catch((error) => {
    console.error(`마이그레이션 실패: ${error.message}`);
    process.exit(1);
  });
}
