import { withAuth } from "@/lib/auth";
import { assertObjectId, badRequest, HttpError, notFound, readJson } from "@/lib/http";
import { serializeWeeklyPlan } from "@/lib/serialize";
import { parseWeeklyInput } from "@/lib/validation";
import { TodoModel } from "@/models/Todo";
import { WeeklyPlanModel } from "@/models/WeeklyPlan";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = "주간 계획을 찾을 수 없습니다.";

// 주간 계획은 모든 사용자가 함께 쓰는 공용 데이터다 (로그인만 확인).
export const GET = withAuth(async (_request: Request, ctx: Ctx) => {
  const id = assertObjectId((await ctx.params).id);
  const doc = await WeeklyPlanModel.findById(id).lean();
  if (!doc) throw notFound(NOT_FOUND);
  return Response.json(await serializeWeeklyPlan(doc));
});

/**
 * PUT/PATCH 모두 전달된 필드만 수정한다 (memo, retrospective, goals, goalId, weekStart).
 * 주간 목표의 완료 여부는 연결된 할 일로 계산되므로 수정할 수 없다.
 */
const update = withAuth(async (request: Request, ctx: Ctx) => {
  const id = assertObjectId((await ctx.params).id);
  const input = await parseWeeklyInput(await readJson(request), true);
  if (input.weekStart && (await WeeklyPlanModel.exists({ weekStart: input.weekStart, _id: { $ne: id } }))) {
    throw new HttpError(409, "해당 주의 주간 계획이 이미 존재합니다.");
  }

  let keptGoalIds: string[] | null = null;
  if (input.goals) {
    const current = await WeeklyPlanModel.findById(id, { goals: 1 }).lean();
    if (!current) throw notFound(NOT_FOUND);
    const existing = new Set(current.goals.map((g) => String(g._id)));
    for (const g of input.goals) {
      if (g._id && !existing.has(g._id)) throw badRequest("해당 주간 계획에 없는 주간 목표입니다.");
    }
    keptGoalIds = input.goals.flatMap((g) => (g._id ? [g._id] : []));
  }

  const doc = await WeeklyPlanModel.findByIdAndUpdate(id, input, { returnDocument: "after", runValidators: true }).lean();
  if (!doc) throw notFound(NOT_FOUND);
  if (keptGoalIds) {
    // 삭제된 주간 목표에 연결된 할 일은 (모든 사용자의 것) 연결만 해제한다.
    await TodoModel.updateMany(
      { weeklyPlanId: id, weeklyGoalId: { $ne: null, $nin: keptGoalIds } },
      { weeklyGoalId: null },
    );
  }
  return Response.json(await serializeWeeklyPlan(doc));
});

export const PUT = update;
export const PATCH = update;

export const DELETE = withAuth(async (_request: Request, ctx: Ctx) => {
  const id = assertObjectId((await ctx.params).id);
  const doc = await WeeklyPlanModel.findByIdAndDelete(id).lean();
  if (!doc) throw notFound(NOT_FOUND);
  // 할 일은 보존하고 (모든 사용자의) 주간 계획 연결만 해제한다.
  await TodoModel.updateMany({ weeklyPlanId: id }, { weeklyPlanId: null, weeklyGoalId: null, dayOfWeek: null });
  return new Response(null, { status: 204 });
});
