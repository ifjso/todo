import { expect, test, type Locator, type Page } from "@playwright/test";

/** dnd-kit PointerSensor(distance 5) 를 통과하도록 단계적으로 마우스를 움직여 드래그한다. */
async function drag(page: Page, source: Locator, target: Locator, position: "center" | "top" = "center") {
  const s = await source.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) throw new Error("드래그 대상의 위치를 알 수 없습니다.");
  const sx = s.x + 16;
  const sy = s.y + s.height / 2;
  const tx = t.x + t.width / 2;
  const ty = position === "top" ? t.y + 4 : t.y + t.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 8, sy + 8, { steps: 4 });
  await page.mouse.move(tx, ty, { steps: 20 });
  await page.mouse.move(tx, ty + 1, { steps: 2 });
  await page.mouse.up();
}

function countPatches(page: Page) {
  const patches: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "PATCH" && req.url().includes("/api/todos/")) patches.push(req.url());
  });
  return patches;
}

async function createTodoFromBoard(page: Page, title: string, extra?: (dialog: Locator) => Promise<void>) {
  await page.getByRole("button", { name: "새 할 일" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("제목").fill(title);
  if (extra) await extra(dialog);
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toBeHidden();
}

const column = (page: Page, status: string) => page.getByTestId(`column-${status}`);
const card = (page: Page, title: string) => page.getByTestId("todo-card").filter({ hasText: title });

test.describe.serial("할 일 → 주간 계획 → 1년 목표 핵심 흐름", () => {
  test("1년 목표를 만든다", async ({ page }) => {
    await page.goto("/goals");
    await page.getByRole("button", { name: "새 목표" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("제목").fill("E2E 목표");
    await dialog.getByLabel("설명").fill("올해 꼭 이루기");
    await dialog.getByRole("button", { name: "저장" }).click();

    const goalCard = page.getByTestId("goal-card").filter({ hasText: "E2E 목표" });
    await expect(goalCard).toBeVisible();
    await expect(goalCard.getByRole("progressbar", { name: "E2E 목표 진행률" })).toHaveAttribute("aria-valuenow", "0");
  });

  test("목표를 연결한 이번 주 계획을 만들고, 같은 주 중복 생성은 에러를 보여준다", async ({ page }) => {
    await page.goto("/weekly");
    await page.getByRole("button", { name: "새 주간 계획" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("주간 목표 1", { exact: true }).fill("운동 3회");
    await dialog.getByRole("button", { name: "목표 추가" }).click();
    await dialog.getByLabel("주간 목표 2", { exact: true }).fill("책 읽기");
    await dialog.getByLabel("메모").fill("이번 주는 집중!");
    await dialog.getByLabel("1년 목표").selectOption({ label: "E2E 목표" });
    await dialog.getByRole("button", { name: "저장" }).click();
    await expect(page).toHaveURL(/\/weekly\/[a-f\d]{24}$/);

    await page.goto("/weekly");
    await expect(page.getByTestId("weekly-card")).toHaveCount(1);
    await page.getByRole("button", { name: "새 주간 계획" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "저장" }).click();
    await expect(dialog.getByRole("alert")).toContainText("이미 존재");
  });

  test("주간 상세에서 요일별 할 일을 주간 목표에 연결해 만들고, 주간 목표는 수동으로 완료할 수 없다", async ({ page }) => {
    await page.goto("/weekly");
    await page.getByTestId("weekly-card").first().click();
    await expect(page.getByTestId("week-grid")).toBeVisible();

    for (const [day, label, title, weeklyGoal] of [
      [1, "월", "카드A", "운동 3회"],
      [2, "화", "카드B", "책 읽기"],
    ] as const) {
      await page.getByRole("button", { name: `${label}요일 할 일 추가` }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("제목").fill(title);
      await expect(dialog.getByLabel("1년 목표")).toHaveCount(0);
      await dialog.getByRole("combobox", { name: "주간 목표", exact: true }).selectOption({ label: weeklyGoal });
      await dialog.getByRole("button", { name: "저장" }).click();
      await expect(dialog).toBeHidden();
      const item = page.getByTestId(`day-${day}`).getByTestId("day-todo").filter({ hasText: title });
      await expect(item).toBeVisible();
      await expect(item.getByTestId("day-todo-goal")).toContainText(weeklyGoal);
    }

    // 수동 완료 UI 가 없고, 연결된 할 일 진행 상황만 표시된다.
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    const exercise = page.getByTestId("weekly-goal").filter({ hasText: "운동 3회" });
    await expect(exercise).toHaveAttribute("data-done", "false");
    await expect(exercise.getByTestId("weekly-goal-status")).toHaveText("0/1");

    await page.getByLabel("회고").fill("꾸준히 했다");
    await page.getByRole("button", { name: "회고 저장" }).click();

    await page.reload();
    await expect(page.getByLabel("회고")).toHaveValue("꾸준히 했다");
    await expect(page.getByRole("progressbar", { name: "주간 진행률" })).toHaveAttribute("aria-valuenow", "0");
  });

  test("칸반에서 드래그로 done 이동 시 PATCH 는 1회만 발생하고 새로고침 후에도 유지된다", async ({ page }) => {
    const patches = countPatches(page);
    await page.goto("/todos");
    await expect(card(page, "카드A")).toHaveAttribute("data-status", "todo");

    const response = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/api/todos/"));
    await drag(page, card(page, "카드A"), column(page, "done"));
    expect((await response).status()).toBe(200);

    await expect(column(page, "done").getByTestId("todo-card").filter({ hasText: "카드A" })).toBeVisible();
    await expect(card(page, "카드A")).toHaveAttribute("data-status", "done");
    await page.waitForTimeout(300);
    expect(patches).toHaveLength(1);

    await page.reload();
    await expect(column(page, "done").getByTestId("todo-card").filter({ hasText: "카드A" })).toBeVisible();
    await expect(column(page, "todo").getByTestId("todo-card").filter({ hasText: "카드B" })).toBeVisible();
  });

  test("대시보드와 목표에 진행률이 자동 반영된다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("count-done")).toHaveText("1");
    await expect(page.getByTestId("count-todo")).toHaveText("1");
    await expect(page.getByTestId("count-doing")).toHaveText("0");
    await expect(page.getByRole("progressbar", { name: "주간 진행률" })).toHaveAttribute("aria-valuenow", "50");
    // 카드A(운동 3회의 유일한 할 일)가 완료되어 주간 목표가 자동 완료된다.
    const weeklyGoal = (text: string) => page.getByTestId("weekly-goal").filter({ hasText: text });
    await expect(weeklyGoal("운동 3회")).toHaveAttribute("data-done", "true");
    await expect(weeklyGoal("책 읽기")).toHaveAttribute("data-done", "false");
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    const dashGoal = page.getByTestId("dashboard-goal").filter({ hasText: "E2E 목표" });
    await expect(dashGoal.getByRole("progressbar", { name: "E2E 목표 진행률" })).toHaveAttribute("aria-valuenow", "50");

    await page.goto("/goals");
    const goalCard = page.getByTestId("goal-card").filter({ hasText: "E2E 목표" });
    await expect(goalCard.getByRole("progressbar", { name: "E2E 목표 진행률" })).toHaveAttribute("aria-valuenow", "50");
  });

  test("칸반에서 상태 변경이 대시보드에 실시간 반영된다 (페이지 이동만, 새로고침 없음)", async ({ page }) => {
    await page.goto("/todos");
    const response = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/api/todos/"));
    await drag(page, card(page, "카드B"), column(page, "done"));
    await response;
    await page.getByRole("link", { name: "대시보드" }).first().click();
    await expect(page.getByTestId("count-done")).toHaveText("2");
    await expect(page.getByRole("progressbar", { name: "주간 진행률" })).toHaveAttribute("aria-valuenow", "100");
    await expect(page.getByTestId("weekly-goal").filter({ hasText: "책 읽기" })).toHaveAttribute("data-done", "true");
  });

  test("완료된 할 일을 다시 진행 중으로 옮기면 주간 목표도 자동으로 미완료가 된다", async ({ page }) => {
    await page.goto("/todos");
    const response = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/api/todos/"));
    await drag(page, card(page, "카드B"), column(page, "doing"));
    await response;
    await page.getByRole("link", { name: "대시보드" }).first().click();
    await expect(page.getByTestId("weekly-goal").filter({ hasText: "책 읽기" })).toHaveAttribute("data-done", "false");
    await expect(page.getByTestId("weekly-goal").filter({ hasText: "운동 3회" })).toHaveAttribute("data-done", "true");

    // 이후 테스트를 위해 원래대로 되돌린다.
    await page.getByRole("link", { name: "할 일" }).first().click();
    const back = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/api/todos/"));
    await drag(page, card(page, "카드B"), column(page, "done"));
    await back;
  });
});

test.describe.serial("칸반 정렬과 P1 표시", () => {
  test("같은 컬럼 안에서 순서를 바꾸면 새로고침 후에도 유지된다", async ({ page }) => {
    await page.goto("/todos");
    await createTodoFromBoard(page, "순서1");
    await createTodoFromBoard(page, "순서2");
    await createTodoFromBoard(page, "순서3");
    const titles = () => column(page, "todo").getByTestId("todo-card").allInnerTexts();
    const indexOf = async (title: string) => (await titles()).findIndex((t) => t.includes(title));
    expect(await indexOf("순서3")).toBeGreaterThan(await indexOf("순서1"));

    const patches = countPatches(page);
    const response = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/api/todos/"));
    await drag(page, card(page, "순서3"), card(page, "순서1"), "top");
    await response;
    await expect.poll(async () => (await indexOf("순서3")) < (await indexOf("순서1"))).toBe(true);
    expect(patches).toHaveLength(1);

    await page.reload();
    await expect(card(page, "순서1")).toBeVisible();
    expect(await indexOf("순서3")).toBeLessThan(await indexOf("순서1"));
  });

  test("High 우선순위는 상단에 고정되고, 지난 마감일은 빨간색으로 표시된다", async ({ page }) => {
    await page.goto("/todos");
    await createTodoFromBoard(page, "긴급 작업", async (dialog) => {
      await dialog.getByLabel("우선순위").selectOption("high");
      await dialog.getByLabel("마감일").fill("2020-01-01");
    });
    const first = column(page, "todo").getByTestId("todo-card").first();
    await expect(first).toContainText("긴급 작업");
    await expect(first).toContainText("High");
    await expect(first.locator('[data-overdue="true"]')).toHaveClass(/text-red/);

    await createTodoFromBoard(page, "여유 작업", async (dialog) => {
      await dialog.getByLabel("마감일").fill("2999-12-31");
    });
    await expect(card(page, "여유 작업").locator('[data-overdue="false"]')).toBeVisible();
  });

  test("수정 모달로 상태를 바꾼 카드는 새 컬럼 끝에 붙고, 그 사이로 드래그해도 정상 동작한다", async ({ page }) => {
    await page.goto("/todos");
    await createTodoFromBoard(page, "모달Q", async (dialog) => {
      await dialog.getByLabel("상태").selectOption("doing");
    });
    await createTodoFromBoard(page, "모달P");
    await card(page, "모달P").getByRole("button", { name: "모달P 수정" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("상태").selectOption("doing");
    await dialog.getByRole("button", { name: "저장" }).click();
    await expect(dialog).toBeHidden();

    const doingCards = column(page, "doing").getByTestId("todo-card");
    await expect(doingCards.last()).toContainText("모달P");

    const response = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("/api/todos/"));
    await drag(page, card(page, "순서2"), card(page, "모달P"), "top");
    expect((await response).status()).toBe(200);
    await expect(card(page, "순서2")).toHaveAttribute("data-status", "doing");
    await expect(page.getByTestId("board-error")).toHaveCount(0);

    await page.reload();
    await expect(column(page, "doing").getByTestId("todo-card")).toHaveCount(3);
    const titles = await column(page, "doing").getByTestId("todo-card").allInnerTexts();
    const idx = (t: string) => titles.findIndex((x) => x.includes(t));
    expect(idx("모달Q")).toBeLessThan(idx("순서2"));
    expect(idx("순서2")).toBeLessThan(idx("모달P"));
  });

  test("할 일을 수정하고 삭제한다", async ({ page }) => {
    await page.goto("/todos");
    await card(page, "여유 작업").getByRole("button", { name: "여유 작업 수정" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("제목")).toHaveValue("여유 작업");
    await dialog.getByLabel("제목").fill("수정된 작업");
    await dialog.getByRole("button", { name: "저장" }).click();
    await expect(card(page, "수정된 작업")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await card(page, "수정된 작업").getByRole("button", { name: "수정된 작업 삭제" }).click();
    await expect(card(page, "수정된 작업")).toHaveCount(0);
  });

  test("목표 수정(pre-fill)과 삭제", async ({ page }) => {
    await page.goto("/goals");
    await page.getByRole("button", { name: "새 목표" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("제목").fill("지울 목표");
    await dialog.getByRole("button", { name: "저장" }).click();
    const target = page.getByTestId("goal-card").filter({ hasText: "지울 목표" });
    await target.getByRole("button", { name: "수정" }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("제목")).toHaveValue("지울 목표");
    await dialog.getByRole("button", { name: "취소" }).or(dialog.getByRole("button", { name: "닫기" })).first().click();

    page.once("dialog", (d) => d.accept());
    await target.getByRole("button", { name: "삭제" }).click();
    await expect(page.getByTestId("goal-card").filter({ hasText: "지울 목표" })).toHaveCount(0);
  });
});

test.describe("모바일 레이아웃 (390px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of ["/", "/todos", "/weekly", "/goals"]) {
    test(`${path} 에 가로 스크롤이 없다`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.getByRole("navigation", { name: "모바일 메뉴" })).toBeVisible();
    });
  }

  test("주간 상세에 가로 스크롤이 없다", async ({ page }) => {
    await page.goto("/weekly");
    await page.getByTestId("weekly-card").first().click();
    await expect(page.getByTestId("week-grid")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("다크 모드", () => {
  const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("dark"));
  const toggle = (page: Page) => page.getByRole("button", { name: /^테마:/ });

  test.describe("OS 가 라이트일 때", () => {
    test.use({ colorScheme: "light" });

    test("토글은 시스템 → 라이트 → 다크 → 시스템 순으로 바뀌고, 선택은 새로고침 후에도 유지된다", async ({ page }) => {
      await page.goto("/");
      await expect(toggle(page)).toHaveAttribute("data-theme-preference", "system");
      expect(await isDark(page)).toBe(false);

      await toggle(page).click();
      await expect(toggle(page)).toHaveAttribute("data-theme-preference", "light");
      expect(await isDark(page)).toBe(false);

      await toggle(page).click();
      await expect(toggle(page)).toHaveAttribute("data-theme-preference", "dark");
      expect(await isDark(page)).toBe(true);
      const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bodyBg).not.toBe("rgb(248, 250, 252)"); // slate-50 이 아니어야 한다

      // 첫 페인트 전 인라인 스크립트가 적용하므로 DOMContentLoaded 시점에 이미 dark 여야 한다.
      await page.reload({ waitUntil: "domcontentloaded" });
      expect(await isDark(page)).toBe(true);
      await expect(toggle(page)).toHaveAttribute("data-theme-preference", "dark");

      await toggle(page).click();
      await expect(toggle(page)).toHaveAttribute("data-theme-preference", "system");
      expect(await isDark(page)).toBe(false);
    });
  });

  test.describe("OS 가 다크일 때", () => {
    test.use({ colorScheme: "dark" });

    test("시스템 설정이면 다크로 표시되고, 라이트를 고르면 OS 와 무관하게 라이트가 된다", async ({ page }) => {
      await page.goto("/todos");
      await expect(toggle(page)).toHaveAttribute("data-theme-preference", "system");
      expect(await isDark(page)).toBe(true);

      await toggle(page).click();
      expect(await isDark(page)).toBe(false);
      await page.reload({ waitUntil: "domcontentloaded" });
      expect(await isDark(page)).toBe(false);
    });
  });

  test("모바일 헤더에도 토글이 있고 가로 스크롤이 생기지 않는다", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(toggle(page)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
