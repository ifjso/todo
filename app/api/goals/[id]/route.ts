import { withAuth } from "@/lib/auth";
import { assertObjectId, notFound, readJson } from "@/lib/http";
import { serializeGoal } from "@/lib/serialize";
import { parseGoalInput } from "@/lib/validation";
import { GoalModel } from "@/models/Goal";
import { WeeklyPlanModel } from "@/models/WeeklyPlan";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = "목표를 찾을 수 없습니다.";

// 1년 목표는 모든 사용자가 함께 쓰는 공용 데이터다 (로그인만 확인).
export const GET = withAuth(async (_request: Request, ctx: Ctx) => {
  const id = assertObjectId((await ctx.params).id);
  const doc = await GoalModel.findById(id).lean();
  if (!doc) throw notFound(NOT_FOUND);
  return Response.json(await serializeGoal(doc));
});

export const PUT = withAuth(async (request: Request, ctx: Ctx) => {
  const id = assertObjectId((await ctx.params).id);
  const input = parseGoalInput(await readJson(request), true);
  const doc = await GoalModel.findByIdAndUpdate(id, input, { returnDocument: "after", runValidators: true }).lean();
  if (!doc) throw notFound(NOT_FOUND);
  return Response.json(await serializeGoal(doc));
});

export const DELETE = withAuth(async (_request: Request, ctx: Ctx) => {
  const id = assertObjectId((await ctx.params).id);
  const doc = await GoalModel.findByIdAndDelete(id).lean();
  if (!doc) throw notFound(NOT_FOUND);
  // 연결은 끊되 주간 계획 자체는 보존한다.
  await WeeklyPlanModel.updateMany({ goalId: id }, { goalId: null });
  return new Response(null, { status: 204 });
});
