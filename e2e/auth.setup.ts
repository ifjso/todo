import { test as setup } from "@playwright/test";
import { ALICE_STORAGE, loginAs } from "./auth-helpers";

// 기존 E2E 시나리오는 alice 로 로그인한 상태에서 실행한다.
setup("alice 로그인", async ({ page, request }) => {
  await loginAs(page, request, "alice");
  await page.context().storageState({ path: ALICE_STORAGE });
});
