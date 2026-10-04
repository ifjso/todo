import { deleteModel, Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { MAX_WEEKLY_GOALS } from "@/types";

// 완료 여부는 저장하지 않고, 연결된 할 일(Todo.weeklyGoalId)의 상태로 조회 시 계산한다.
const weeklyGoalSchema = new Schema({
  text: { type: String, required: true, trim: true, maxlength: 200 },
});

const weeklyPlanSchema = new Schema(
  {
    // 해당 주의 월요일 (YYYY-MM-DD). 문자열이라 시간대와 무관하게 사전순 = 시간순.
    weekStart: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    goals: {
      type: [weeklyGoalSchema],
      default: [],
      validate: {
        validator: (v: unknown[]) => v.length <= MAX_WEEKLY_GOALS,
        message: `주간 목표는 최대 ${MAX_WEEKLY_GOALS}개까지 등록할 수 있습니다.`,
      },
    },
    memo: { type: String, default: "", maxlength: 5000 },
    retrospective: { type: String, default: "", maxlength: 5000 },
    goalId: { type: Schema.Types.ObjectId, ref: "Goal", default: null, index: true },
  },
  { timestamps: true },
);

export type WeeklyPlanDoc = InferSchemaType<typeof weeklyPlanSchema>;

// 개발 서버 HMR 로 이 파일이 다시 평가될 때 이전 스키마로 등록된 모델을 재사용하면
// 새로 추가한 필드가 저장 시 조용히 버려진다. 항상 현재 스키마로 다시 등록한다.
if (models.WeeklyPlan) deleteModel("WeeklyPlan");

export const WeeklyPlanModel: Model<WeeklyPlanDoc> = model<WeeklyPlanDoc>("WeeklyPlan", weeklyPlanSchema);
