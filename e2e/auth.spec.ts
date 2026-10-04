import { expect, test } from "@playwright/test";
import { loginAs, MOCK_GITHUB_URL } from "./auth-helpers";

// 이 파일은 로그인하지 않은 브라우저에서 시작한다.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("GitHub 로그인", () => {
  test("미로그인 사용자는 모든 페이지에서 /login 으로 이동하고, API 는 401", async ({ page, request }) => {
    for (const path of ["/", "/todos", "/weekly", "/goals", "/weekly/64b000000000000000000000"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
    await expect(page.getByRole("link", { name: "GitHub로 로그인" })).toHaveAttribute("href", "/auth/github");
    // 로그인 페이지에는 내비게이션이 없다.
    await expect(page.getByRole("navigation")).toHaveCount(0);

    for (const path of ["/api/todos", "/api/weekly", "/api/goals", "/api/me"]) {
      expect((await request.get(path)).status(), path).toBe(401);
    }
  });

  test("GitHub 로그인 후 / 로 돌아오고 아바타와 username 이 보인다", async ({ page, request }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await loginAs(page, request, "frank");

    const menu = page.getByTestId("user-menu").first();
    await expect(menu.getByRole("img", { name: "frank 아바타" })).toHaveAttribute(
      "src",
      `${MOCK_GITHUB_URL}/avatars/frank.png`,
    );
    await expect(page.getByRole("heading", { name: "대시보드" })).toBeVisible();

    const me = await page.request.get("/api/me");
    expect(await me.json()).toEqual({ username: "frank", avatarUrl: `${MOCK_GITHUB_URL}/avatars/frank.png` });

    // 로그인한 상태에서 /login 에 가면 / 로 보낸다.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);
  });

  test("state 를 위조한 콜백은 거부되고 로그인되지 않는다", async ({ page }) => {
    await page.goto("/auth/github/callback?code=code-mallory&state=forged");
    await expect(page).toHaveURL(/\/login\?error=state$/);
    await expect(page.getByRole("alert").filter({ hasText: "다시 시도" })).toBeVisible();
    expect((await page.request.get("/api/me")).status()).toBe(401);
  });

  test("할 일은 사용자별로 분리되고, 주간 계획·1년 목표는 공용이다", async ({ browser, request }) => {
    const carolCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const carol = await carolCtx.newPage();
    await loginAs(carol, request, "carol");
    await carol.goto("/todos");
    await carol.getByRole("button", { name: "새 할 일" }).click();
    await carol.getByRole("dialog").getByLabel("제목").fill("carol 비밀 할 일");
    await carol.getByRole("dialog").getByRole("button", { name: "저장" }).click();
    await expect(carol.getByTestId("todo-card").filter({ hasText: "carol 비밀 할 일" })).toBeVisible();
    const carolTodo = (await (await carol.request.get("/api/todos")).json())[0];
    const sharedPlan = await (
      await carol.request.post("/api/weekly", { data: { weekStart: "2030-01-07", goals: ["공용 주간 목표"] } })
    ).json();
    const sharedGoal = await (await carol.request.post("/api/goals", { data: { title: "carol 이 만든 공용 목표" } })).json();

    const daveCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const dave = await daveCtx.newPage();
    await loginAs(dave, request, "dave");
    await dave.goto("/todos");
    await expect(dave.getByRole("button", { name: "새 할 일" })).toBeVisible();
    await expect(dave.getByTestId("todo-card").filter({ hasText: "carol 비밀 할 일" })).toHaveCount(0);
    expect(await (await dave.request.get("/api/todos")).json()).toEqual([]);
    // id 를 알아도 접근/수정/삭제할 수 없다.
    expect((await dave.request.get(`/api/todos/${carolTodo._id}`)).status()).toBe(404);
    expect((await dave.request.delete(`/api/todos/${carolTodo._id}`)).status()).toBe(404);
    expect((await carol.request.get(`/api/todos/${carolTodo._id}`)).status()).toBe(200);

    // 공용 데이터: dave 도 carol 이 만든 주간 계획·목표를 보고 수정하고, 자기 할 일을 연결할 수 있다.
    await dave.goto("/goals");
    await expect(dave.getByTestId("goal-card").filter({ hasText: "carol 이 만든 공용 목표" })).toBeVisible();
    expect((await dave.request.patch(`/api/weekly/${sharedPlan._id}`, { data: { memo: "dave 메모" } })).status()).toBe(200);
    expect((await (await carol.request.get(`/api/weekly/${sharedPlan._id}`)).json()).memo).toBe("dave 메모");
    const daveTodo = await dave.request.post("/api/todos", {
      data: { title: "dave 할 일", weeklyGoalId: sharedPlan.goals[0]._id },
    });
    expect(daveTodo.status()).toBe(201);
    expect(sharedGoal._id).toBeTruthy();

    await carolCtx.close();
    await daveCtx.close();
  });

  test("로그아웃하면 세션이 삭제되어 이전 쿠키로도 접근할 수 없다", async ({ page, request, browser }) => {
    await loginAs(page, request, "erin");
    const oldSession = (await page.context().cookies()).find((c) => c.name === "session");
    expect(oldSession).toBeDefined();

    await page.getByRole("button", { name: "로그아웃" }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.context().cookies()).find((c) => c.name === "session")).toBeUndefined();

    await page.goto("/todos");
    await expect(page).toHaveURL(/\/login$/);

    // 쿠키를 훔쳐 두었다가 다시 써도 서버에서 세션이 지워졌으므로 401
    const replay = await browser.newContext({ storageState: { cookies: [oldSession!], origins: [] } });
    const res = await replay.request.get("/api/todos");
    expect(res.status()).toBe(401);
    // 무효한 쿠키를 들고 페이지에 들어가면 API 401 → 쿠키 삭제 → /login 으로 정리된다.
    const replayPage = await replay.newPage();
    await replayPage.goto("/todos");
    await expect(replayPage).toHaveURL(/\/login$/);
    await replay.close();
  });
});
