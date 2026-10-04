import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // 통합 테스트가 같은 테스트 DB 를 공유하므로 파일 단위 병렬 실행을 끈다.
    fileParallelism: false,
    env: {
      MONGODB_URI: process.env.MONGODB_TEST_URI ?? "mongodb://localhost:27017/todo-planner-test",
    },
  },
});
