import { withAuth } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { serializeGoal, serializeGoals } from "@/lib/serialize";
import { parseGoalInput } from "@/lib/validation";
import { GoalModel } from "@/models/Goal";

// 1년 목표는 모든 사용자가 함께 쓰는 공용 데이터다 (로그인만 확인).
export const GET = withAuth(async () => {
  const docs = await GoalModel.find().sort({ createdAt: -1 }).lean();
  return Response.json(await serializeGoals(docs));
});

export const POST = withAuth(async (request) => {
  const input = parseGoalInput(await readJson(request), false);
  const doc = await GoalModel.create(input);
  return Response.json(await serializeGoal(doc.toObject()), { status: 201 });
});
