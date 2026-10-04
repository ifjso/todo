import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as githubLogin from "@/app/auth/github/route";
import * as githubCallback from "@/app/auth/github/callback/route";
import * as logout from "@/app/auth/logout/route";
import * as me from "@/app/api/me/route";
import * as goals from "@/app/api/goals/route";
import * as goal from "@/app/api/goals/[id]/route";
import * as weekly from "@/app/api/weekly/route";
import * as plan from "@/app/api/weekly/[id]/route";
import * as todos from "@/app/api/todos/route";
import * as todo from "@/app/api/todos/[id]/route";
import { hashToken } from "@/lib/auth";
import { SessionModel } from "@/models/Session";
import { UserModel } from "@/models/User";
import { call, setupTestDB, testUser } from "../helpers";

setupTestDB();

const SECRET = "test-client-secret-value";

function setCookies(res: Response): string[] {
  return res.headers.getSetCookie();
}

function cookieValue(res: Response, name: string): string | undefined {
  const raw = setCookies(res).find((c) => c.startsWith(`${name}=`));
  return raw ? decodeURIComponent(raw.split(";")[0].slice(name.length + 1)) : undefined;
}

/** /auth/github 를 호출해 state 를 받아 둔다 (콜백에 쿠키로 되돌려 보내기 위해). */
async function startLogin(): Promise<string> {
  const res = await githubLogin.GET(new Request("http://localhost/auth/github"));
  return cookieValue(res, "oauth_state")!;
}

function callback(query: string, stateCookie?: string) {
  const headers: Record<string, string> = {};
  if (stateCookie) headers.cookie = `oauth_state=${stateCookie}`;
  return githubCallback.GET(new Request(`http://localhost/auth/github/callback?${query}`, { headers }));
}

function mockGitHub(profile: { id: number; login: string; avatar_url: string }, { tokenOk = true, userOk = true } = {}) {
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const href = String(url);
    if (href.endsWith("/login/oauth/access_token")) {
      return tokenOk
        ? Response.json({ access_token: "gho_test", token_type: "bearer" })
        : Response.json({ error: "bad_verification_code" });
    }
    if (href.endsWith("/user")) {
      return userOk ? Response.json(profile) : Response.json({ message: "Bad credentials" }, { status: 401 });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("GITHUB_CLIENT_ID", "test-client-id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", SECRET);
  vi.stubEnv("GITHUB_OAUTH_URL", "");
  vi.stubEnv("GITHUB_API_URL", "");
  vi.stubEnv("APP_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /auth/github", () => {
  it("state 쿠키를 저장하고 GitHub 인가 페이지로 리다이렉트한다", async () => {
    const res = await githubLogin.GET(new Request("http://localhost/auth/github"));
    expect(res.status).toBe(302);

    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(location.searchParams.get("client_id")).toBe("test-client-id");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost/auth/github/callback");
    expect(location.searchParams.get("scope")).toBe("read:user");

    const state = cookieValue(res, "oauth_state");
    expect(state).toMatch(/^[\w-]{40,}$/);
    expect(location.searchParams.get("state")).toBe(state);
    const raw = setCookies(res)[0];
    expect(raw).toContain("HttpOnly");
    expect(raw).toContain("SameSite=Lax");
    expect(raw).toContain("Path=/auth/github");
    // 비밀값은 브라우저로 나가지 않는다.
    expect(res.headers.get("location")).not.toContain(SECRET);
  });

  it("요청할 때마다 다른 state 를 만들고, GITHUB_OAUTH_URL 로 주소를 바꿀 수 있다", async () => {
    vi.stubEnv("GITHUB_OAUTH_URL", "http://localhost:3299/");
    const a = await githubLogin.GET(new Request("http://localhost/auth/github"));
    const b = await githubLogin.GET(new Request("http://localhost/auth/github"));
    expect(cookieValue(a, "oauth_state")).not.toBe(cookieValue(b, "oauth_state"));
    expect(a.headers.get("location")).toMatch(/^http:\/\/localhost:3299\/login\/oauth\/authorize\?/);
  });

  it("클라이언트 설정이 없으면 비밀값 노출 없이 500", async () => {
    vi.stubEnv("GITHUB_CLIENT_SECRET", "");
    const res = await githubLogin.GET(new Request("http://localhost/auth/github"));
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toContain("설정되지 않았습니다");
    expect(body).not.toContain("test-client-id");
  });
});

describe("GET /auth/github/callback", () => {
  const profile = { id: 4242, login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/4242" };

  it("성공하면 사용자(username, avatarUrl)를 저장하고 세션을 발급한 뒤 / 로 보낸다", async () => {
    const fetchMock = mockGitHub(profile);
    const state = await startLogin();
    const res = await callback(`code=abc&state=${state}`, state);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/");

    const user = await UserModel.findOne({ githubId: 4242 }).lean();
    expect(user).toMatchObject({ username: "octocat", avatarUrl: profile.avatar_url });

    const token = cookieValue(res, "session")!;
    const sessionCookie = setCookies(res).find((c) => c.startsWith("session="))!;
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(sessionCookie).toMatch(/Max-Age=\d+/);
    // state 쿠키는 지운다.
    expect(setCookies(res).find((c) => c.startsWith("oauth_state="))).toContain("Max-Age=0");

    // DB 에는 원본 토큰이 아니라 해시만 저장된다.
    const session = await SessionModel.findOne({ userId: user!._id }).lean();
    expect(session!.tokenHash).toBe(hashToken(token));
    expect(session!.tokenHash).not.toBe(token);
    expect(await SessionModel.countDocuments({ tokenHash: token })).toBe(0);
    expect(session!.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // 토큰 교환은 환경 변수의 비밀값과 인가 코드로 한다.
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(tokenUrl).toBe("https://github.com/login/oauth/access_token");
    expect(JSON.parse(String(tokenInit.body))).toMatchObject({
      client_id: "test-client-id",
      client_secret: SECRET,
      code: "abc",
      redirect_uri: "http://localhost/auth/github/callback",
    });

    // 발급된 세션으로 API 를 쓸 수 있다.
    const meRes = await call(me.GET, "GET", "/api/me", { cookie: `session=${token}` });
    expect(meRes.data).toEqual({ username: "octocat", avatarUrl: profile.avatar_url });
  });

  it("다시 로그인하면 같은 사용자의 username/avatarUrl 을 갱신한다", async () => {
    mockGitHub(profile);
    let state = await startLogin();
    await callback(`code=a&state=${state}`, state);

    mockGitHub({ ...profile, login: "octocat-renamed", avatar_url: "https://avatars.test/new" });
    state = await startLogin();
    await callback(`code=b&state=${state}`, state);

    const users = await UserModel.find({ githubId: 4242 }).lean();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ username: "octocat-renamed", avatarUrl: "https://avatars.test/new" });
  });

  it("이미 로그인된 브라우저로 다시 로그인하면 이전 세션은 삭제된다", async () => {
    mockGitHub(profile);
    let state = await startLogin();
    const first = await callback(`code=a&state=${state}`, state);
    const oldToken = cookieValue(first, "session")!;

    state = await startLogin();
    const second = await githubCallback.GET(
      new Request(`http://localhost/auth/github/callback?code=b&state=${state}`, {
        headers: { cookie: `oauth_state=${state}; session=${oldToken}` },
      }),
    );
    expect(second.status).toBe(302);
    expect(await SessionModel.countDocuments({ tokenHash: hashToken(oldToken) })).toBe(0);
    expect(await SessionModel.countDocuments({ tokenHash: hashToken(cookieValue(second, "session")!) })).toBe(1);
  });

  it("APP_URL 이 있으면 redirect_uri 와 로그인 후 이동 주소 모두 APP_URL 기준이다", async () => {
    vi.stubEnv("APP_URL", "https://todo.example.com/");
    mockGitHub(profile);
    const login = await githubLogin.GET(new Request("http://internal:3000/auth/github"));
    expect(new URL(login.headers.get("location")!).searchParams.get("redirect_uri")).toBe(
      "https://todo.example.com/auth/github/callback",
    );
    const state = cookieValue(login, "oauth_state")!;
    const res = await githubCallback.GET(
      new Request(`http://internal:3000/auth/github/callback?code=a&state=${state}`, {
        headers: { cookie: `oauth_state=${state}` },
      }),
    );
    expect(res.headers.get("location")).toBe("https://todo.example.com/");
  });

  it("state 가 없거나 다르면 세션을 만들지 않고 /login?error=state 로 보낸다", async () => {
    const fetchMock = mockGitHub(profile);
    const state = await startLogin();
    const sessionsBefore = await SessionModel.countDocuments();

    for (const res of [
      await callback(`code=abc&state=${state}`), // 쿠키 없음
      await callback(`code=abc&state=forged`, state), // 불일치
      await callback(`state=${state}`, state), // code 없음
    ]) {
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("http://localhost/login?error=state");
      expect(setCookies(res).some((c) => c.startsWith("session="))).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await SessionModel.countDocuments()).toBe(sessionsBefore);
    expect(await UserModel.countDocuments({ githubId: 4242 })).toBe(0);
  });

  it("사용자가 GitHub 에서 거부하면 /login?error=denied", async () => {
    const state = await startLogin();
    const res = await callback(`error=access_denied&state=${state}`, state);
    expect(res.headers.get("location")).toBe("http://localhost/login?error=denied");
  });

  it("토큰 교환이나 사용자 조회에 실패하면 세션 없이 /login?error=github", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const opts of [{ tokenOk: false }, { userOk: false }]) {
      mockGitHub(profile, opts);
      const state = await startLogin();
      const res = await callback(`code=abc&state=${state}`, state);
      expect(res.headers.get("location")).toBe("http://localhost/login?error=github");
      expect(setCookies(res).some((c) => c.startsWith("session="))).toBe(false);
    }
    expect(await UserModel.countDocuments({ githubId: 4242 })).toBe(0);
  });
});

describe("미로그인 / 잘못된 세션", () => {
  const routes = [
    ["GET /api/me", me.GET],
    ["GET /api/goals", goals.GET],
    ["POST /api/goals", goals.POST],
    ["GET /api/goals/:id", goal.GET],
    ["PUT /api/goals/:id", goal.PUT],
    ["DELETE /api/goals/:id", goal.DELETE],
    ["GET /api/weekly", weekly.GET],
    ["POST /api/weekly", weekly.POST],
    ["GET /api/weekly/:id", plan.GET],
    ["PUT /api/weekly/:id", plan.PUT],
    ["PATCH /api/weekly/:id", plan.PATCH],
    ["DELETE /api/weekly/:id", plan.DELETE],
    ["GET /api/todos", todos.GET],
    ["POST /api/todos", todos.POST],
    ["GET /api/todos/:id", todo.GET],
    ["PUT /api/todos/:id", todo.PUT],
    ["PATCH /api/todos/:id", todo.PATCH],
    ["DELETE /api/todos/:id", todo.DELETE],
  ] as const;

  it.each(routes)("%s 는 세션 쿠키가 없으면 401", async (name, handler) => {
    const [method] = name.split(" ");
    const body = method === "GET" || method === "DELETE" ? undefined : { title: "x" };
    const res = await call(handler, method, "/api/x", { id: "64b000000000000000000000", body, cookie: null });
    expect(res.status).toBe(401);
  });

  it("알 수 없는 세션 토큰이면 401 과 함께 세션 쿠키를 지운다", async () => {
    const res = await call(todos.GET, "GET", "/api/todos", { cookie: "session=not-a-real-token" });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toMatch(/^session=; .*Max-Age=0/);
  });

  it("사용자 문서 없이 세션만 남았으면 /api/me 가 세션과 쿠키를 지운다 (리다이렉트 루프 방지)", async () => {
    await UserModel.deleteOne({ _id: testUser.userId });
    const res = await call(me.GET, "GET", "/api/me");
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toMatch(/^session=; .*Max-Age=0/);
    expect(await SessionModel.countDocuments({ userId: testUser.userId })).toBe(0);
  });

  it("만료된 세션은 거부되고, 세션에는 TTL 인덱스가 있다", async () => {
    await SessionModel.updateMany({ userId: testUser.userId }, { expiresAt: new Date(Date.now() - 1000) });
    const res = await call(todos.GET, "GET", "/api/todos");
    expect(res.status).toBe(401);

    const indexes = await SessionModel.collection.indexes();
    expect(indexes.find((i) => i.key.expiresAt === 1)?.expireAfterSeconds).toBe(0);
  });
});

describe("POST /auth/logout", () => {
  it("세션 문서를 삭제하고 쿠키를 만료시킨 뒤 /login 으로 303 리다이렉트한다", async () => {
    expect(await SessionModel.countDocuments({ userId: testUser.userId })).toBe(1);
    const res = await logout.POST(new Request("http://localhost/auth/logout", { method: "POST", headers: { cookie: testUser.cookie } }));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/login");
    expect(res.headers.get("set-cookie")).toMatch(/^session=; .*Max-Age=0/);
    expect(await SessionModel.countDocuments({ userId: testUser.userId })).toBe(0);

    // 같은 토큰을 다시 써도 거부된다.
    expect((await call(todos.GET, "GET", "/api/todos")).status).toBe(401);
    expect((await call(me.GET, "GET", "/api/me")).status).toBe(401);
  });

  it("세션이 없어도 쿠키를 지우고 /login 으로 보낸다", async () => {
    const res = await logout.POST(new Request("http://localhost/auth/logout", { method: "POST" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/login");
  });
});
