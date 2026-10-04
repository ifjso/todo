import { getWeekStart, isDateString, parseDate } from "@/lib/date";
import { withAuth } from "@/lib/auth";
import { badRequest, assertObjectId, readJson } from "@/lib/http";
import { serializeWeeklyPlan, serializeWeeklyPlans } from "@/lib/serialize";
import { parseWeeklyInput } from "@/lib/validation";
import { WeeklyPlanModel } from "@/models/WeeklyPlan";

/** GET /api/weekly?weekStart=YYYY-MM-DD&goalId=...&limit=N */
// 주간 계획은 모든 사용자가 함께 쓰는 공용 데이터다 (로그인만 확인).
export const GET = withAuth(async (request) => {
  const params = new URL(request.url).searchParams;
  const filter: Record<string, unknown> = {};
  const weekStart = params.get("weekStart");
  if (weekStart !== null) {
    if (!isDateString(weekStart)) throw badRequest("weekStart 는 YYYY-MM-DD 형식이어야 합니다.");
    filter.weekStart = getWeekStart(parseDate(weekStart)!);
  }
  const goalId = params.get("goalId");
  if (goalId !== null) filter.goalId = assertObjectId(goalId, "goalId");

  let query = WeeklyPlanModel.find(filter).sort({ weekStart: -1 });
  const limit = Number(params.get("limit"));
  if (Number.isInteger(limit) && limit > 0) query = query.limit(limit);

  return Response.json(await serializeWeeklyPlans(await query.lean()));
});

export const POST = withAuth(async (request) => {
  const input = await parseWeeklyInput(await readJson(request), false);
  if (await WeeklyPlanModel.exists({ weekStart: input.weekStart })) {
    return Response.json({ error: "해당 주의 주간 계획이 이미 존재합니다." }, { status: 409 });
  }
  // 새 계획이므로 클라이언트가 보낸 주간 목표 _id 는 무시한다.
  const doc = await WeeklyPlanModel.create({ ...input, goals: input.goals?.map(({ text }) => ({ text })) });
  return Response.json(await serializeWeeklyPlan(doc.toObject()), { status: 201 });
});
