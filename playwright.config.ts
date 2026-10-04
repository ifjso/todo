import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const MOCK_GITHUB_PORT = 3299;
export const E2E_MONGODB_URI = process.env.MONGODB_E2E_URI ?? "mongodb://localhost:27017/todo-planner-e2e";

// 가짜 GitHub 서버와 앱이 같은 테스트용 OAuth 클라이언트 값을 쓴다 (실제 비밀값 아님).
const OAUTH_ENV = {
  GITHUB_CLIENT_ID: "e2e-client-id",
  GITHUB_CLIENT_SECRET: "e2e-client-secret",
};

export default defineConfig({
  testDir: "./e2e",
  // 하나의 DB 를 공유하므로 순차 실행한다.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    // 기존 시나리오용 로그인 상태(alice)를 만든다.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/alice.json" },
    },
  ],
  webServer: [
    {
      command: "node e2e/mock-github.mjs",
      url: `http://localhost:${MOCK_GITHUB_PORT}/__health`,
      reuseExistingServer: false,
      env: { ...OAUTH_ENV, MOCK_GITHUB_PORT: String(MOCK_GITHUB_PORT) },
    },
    {
      command: `npx next build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      timeout: 180_000,
      reuseExistingServer: false,
      // .env 의 실제 값보다 프로세스 환경 변수가 우선한다.
      env: {
        MONGODB_URI: E2E_MONGODB_URI,
        ...OAUTH_ENV,
        GITHUB_OAUTH_URL: `http://localhost:${MOCK_GITHUB_PORT}`,
        GITHUB_API_URL: `http://localhost:${MOCK_GITHUB_PORT}`,
        APP_URL: `http://localhost:${PORT}`,
      },
    },
  ],
});
