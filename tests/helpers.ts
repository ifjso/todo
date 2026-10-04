import mongoose, { type Model } from "mongoose";
import { afterAll, beforeEach } from "vitest";
import { createSession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { GoalModel } from "@/models/Goal";
import { SessionModel } from "@/models/Session";
import { TodoModel } from "@/models/Todo";
import { UserModel } from "@/models/User";
import { WeeklyPlanModel } from "@/models/WeeklyPlan";

type Handler = (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

// 모델마다 문서 타입이 달라 공통 메서드만 쓰도록 좁힌다.
const MODELS: Pick<Model<unknown>, "deleteMany" | "syncIndexes">[] = [GoalModel, WeeklyPlanModel, TodoModel, UserModel, SessionModel];
const BASE = "http://localhost";

let githubIdSeq = 1;
/** setupTestDB 가 매 테스트마다 만드는 기본 로그인 사용자 */
export let testUser: { userId: string; cookie: string };

/** 사용자와 세션을 만들고, 요청에 실을 Cookie 헤더 값을 돌려준다. */
export async function createTestUser(username: string): Promise<{ userId: string; cookie: string }> {
  const user = await UserModel.create({ githubId: githubIdSeq++, username, avatarUrl: `https://avatars.test/${username}` });
  const setCookie = await createSession(String(user._id), new Request(BASE));
  return { userId: String(user._id), cookie: setCookie.split(";")[0] };
}

/** 통합 테스트 공통: 매 테스트 전 컬렉션을 비우고 인덱스를 보장한 뒤 기본 사용자로 로그인한다. */
export function setupTestDB() {
  beforeEach(async () => {
    await connectDB();
    await Promise.all(MODELS.map((m) => m.deleteMany({})));
    await Promise.all(MODELS.map((m) => m.syncIndexes()));
    testUser = await createTestUser("tester");
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
}

export async function call(
  handler: Handler | ((request: Request) => Promise<Response>),
  method: string,
  path: string,
  /** cookie: 생략하면 기본 사용자, null 이면 쿠키 없이(미로그인) 요청한다. */
  options: { body?: unknown; rawBody?: string; id?: string; cookie?: string | null } = {},
) {
  const init: RequestInit = { method, headers: {} };
  const cookie = options.cookie === undefined ? testUser?.cookie : options.cookie;
  if (cookie) (init.headers as Record<string, string>).cookie = cookie;
  if (options.rawBody !== undefined) init.body = options.rawBody;
  else if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const request = new Request(`${BASE}${path}`, init);
  const res = await (handler as Handler)(request, { params: Promise.resolve({ id: options.id ?? "" }) });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = text ? JSON.parse(text) : null;
  return { status: res.status, data, headers: res.headers };
}
