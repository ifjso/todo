import { deleteModel, Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const sessionSchema = new Schema(
  {
    // 쿠키의 원본 토큰은 저장하지 않고 SHA-256 해시만 저장한다.
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // TTL 인덱스: 만료 시각이 지나면 MongoDB 가 문서를 삭제한다.
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true },
);

export type SessionDoc = InferSchemaType<typeof sessionSchema>;

// 개발 서버 HMR 로 이 파일이 다시 평가될 때 이전 스키마로 등록된 모델을 재사용하지 않도록 다시 등록한다.
if (models.Session) deleteModel("Session");

export const SessionModel: Model<SessionDoc> = model<SessionDoc>("Session", sessionSchema);
