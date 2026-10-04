import mongoose, { Schema } from "mongoose";
import { describe, expect, it, vi } from "vitest";

describe("모델 재등록 (개발 서버 HMR)", () => {
  it("이전 스키마로 등록된 모델이 남아 있어도, 모델 파일을 다시 평가하면 현재 스키마가 적용된다", async () => {
    // 개발 서버가 예전 코드로 Todo 모델을 등록해 둔 상황을 흉내 낸다.
    if (mongoose.models.Todo) mongoose.deleteModel("Todo");
    mongoose.model("Todo", new Schema({ title: String, goalId: Schema.Types.ObjectId }));

    // HMR 처럼 모듈을 다시 평가한다.
    vi.resetModules();
    const { TodoModel } = await import("@/models/Todo");

    expect(TodoModel.schema.path("weeklyGoalId")).toBeDefined();
    expect(TodoModel.schema.path("goalId")).toBeUndefined();
    expect(mongoose.models.Todo).toBe(TodoModel);
  });
});
