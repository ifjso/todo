import { deleteModel, Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    // GitHub 사용자 고유 id. username(login) 은 바뀔 수 있으므로 식별에는 이 값을 쓴다.
    githubId: { type: Number, required: true, unique: true },
    username: { type: String, required: true },
    avatarUrl: { type: String, default: "" },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

// 개발 서버 HMR 로 이 파일이 다시 평가될 때 이전 스키마로 등록된 모델을 재사용하지 않도록 다시 등록한다.
if (models.User) deleteModel("User");

export const UserModel: Model<UserDoc> = model<UserDoc>("User", userSchema);
