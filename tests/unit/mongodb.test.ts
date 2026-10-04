import { afterEach, describe, expect, it, vi } from "vitest";
import { connectDB } from "@/lib/mongodb";
import { withDB } from "@/lib/http";

describe("connectDB", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("MONGODB_URI 가 없으면 에러를 던지고, API 는 500 을 반환한다", async () => {
    vi.stubEnv("MONGODB_URI", "");
    await expect(connectDB()).rejects.toThrow("MONGODB_URI");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withDB(async () => Response.json({ ok: true }));
    const res = await handler();
    expect(res.status).toBe(500);
    errorSpy.mockRestore();
  });
});
