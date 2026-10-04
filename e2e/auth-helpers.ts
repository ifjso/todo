import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const MOCK_GITHUB_URL = "http://localhost:3299";
export const ALICE_STORAGE = "e2e/.auth/alice.json";

/** 가짜 GitHub 의 다음 로그인 사용자를 정하고 /login 에서 GitHub 로그인 버튼을 누른다. */
export async function loginAs(page: Page, request: APIRequestContext, login: string) {
  await request.post(`${MOCK_GITHUB_URL}/__set-user`, { data: { login } });
  await page.goto("/login");
  await page.getByRole("link", { name: "GitHub로 로그인" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("user-name").first()).toHaveText(login);
}
