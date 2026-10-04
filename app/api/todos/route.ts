import { withAuth } from "@/lib/auth";
import { assertObjectId, badRequest, readJson } from "@/lib/http";
import { serializeTodo } from "@/lib/serialize";
import { nextOrderInColumn } from "@/lib/todoOrder";
import { parseTodoInput, resolveWeeklyGoalLink } from "@/lib/validation";
import { TodoModel } from "@/models/Todo";
import { TODO_STATUSES, type TodoStatus } from "@/types";

/** GET /api/todos?status=&weeklyPlanId=&weeklyGoalId= — order 사전순 정렬 */
export const GET = withAuth(async (request, _ctx, userId) => {
  const params = new URL(request.url).searchParams;
  const filter: Record<string, unknown> = { userId };
  const status = params.get("status");
  if (status !== null) {
    if (!TODO_STATUSES.includes(status as TodoStatus)) throw badRequest("잘못된 상태 값입니다.");
    filter.status = status;
  }
  const weeklyPlanId = params.get("weeklyPlanId");
  if (weeklyPlanId !== null) filter.weeklyPlanId = assertObjectId(weeklyPlanId, "weeklyPlanId");
  const weeklyGoalId = params.get("weeklyGoalId");
  if (weeklyGoalId !== null) filter.weeklyGoalId = assertObjectId(weeklyGoalId, "weeklyGoalId");

  // order 는 문자열 바이트 순서로 비교해야 하므로 collation 없이 정렬한다.
  const docs = await TodoModel.find(filter).sort({ status: 1, order: 1 }).lean();
  return Response.json(docs.map(serializeTodo));
});

export const POST = withAuth(async (request, _ctx, userId) => {
  const input = await parseTodoInput(await readJson(request), false);
  await resolveWeeklyGoalLink(input, null);
  const status = input.status ?? "todo";
  // order 미지정 시 해당 상태 컬럼의 맨 끝에 추가한다.
  input.order ??= await nextOrderInColumn(status, userId);
  const doc = await TodoModel.create({ ...input, status, userId });
  return Response.json(serializeTodo(doc.toObject()), { status: 201 });
});
