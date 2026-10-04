import { deleteModel, Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const goalSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 2000 },
  },
  { timestamps: true },
);

export type GoalDoc = InferSchemaType<typeof goalSchema>;

// 개발 서버 HMR 로 이 파일이 다시 평가될 때 이전 스키마로 등록된 모델을 재사용하면
// 새로 추가한 필드가 저장 시 조용히 버려진다. 항상 현재 스키마로 다시 등록한다.
if (models.Goal) deleteModel("Goal");

export const GoalModel: Model<GoalDoc> = model<GoalDoc>("Goal", goalSchema);
