import { deleteModel, Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { MAX_ORDER_LENGTH } from "@/lib/fractionalIndex";
import { PRIORITIES, TODO_STATUSES } from "@/types";

const todoSchema = new Schema(
  {
    // 소유자. 모든 조회/수정은 로그인 사용자의 userId 로 범위를 제한한다.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 5000 },
    status: { type: String, enum: TODO_STATUSES, default: "todo" },
    priority: { type: String, enum: PRIORITIES, default: "medium" },
    dueDate: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
    dayOfWeek: { type: Number, default: null, min: 0, max: 6 },
    // fractional index 문자열. 사전순 정렬하며 카드 이동 시 1건만 갱신한다.
    order: { type: String, required: true, maxlength: MAX_ORDER_LENGTH },
    weeklyPlanId: { type: Schema.Types.ObjectId, ref: "WeeklyPlan", default: null, index: true },
    // weeklyPlanId 가 가리키는 주간 계획의 goals[]._id
    weeklyGoalId: { type: Schema.Types.ObjectId, default: null, index: true },
  },
  { timestamps: true },
);

todoSchema.index({ userId: 1, status: 1, order: 1 });

export type TodoDoc = InferSchemaType<typeof todoSchema>;

// 개발 서버 HMR 로 이 파일이 다시 평가될 때 이전 스키마로 등록된 모델을 재사용하면
// 새로 추가한 필드가 저장 시 조용히 버려진다. 항상 현재 스키마로 다시 등록한다.
if (models.Todo) deleteModel("Todo");

export const TodoModel: Model<TodoDoc> = model<TodoDoc>("Todo", todoSchema);
