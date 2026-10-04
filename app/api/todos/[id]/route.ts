import { withAuth } from "@/lib/auth";
import { assertObjectId, notFound, readJson } from "@/lib/http";
import { serializeTodo } from "@/lib/serialize";
import { nextOrderInColumn } from "@/lib/todoOrder";
import { parseTodoInput, resolveWeeklyGoalLink } from "@/lib/validation";
import { TodoModel } from "@/models/Todo";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = "할 일을 찾을 수 없습니다.";

export const GET = withAuth(async (_request: Request, ctx: Ctx, userId) => {
  const id = assertObjectId((await ctx.params).id);
  const doc = await TodoModel.findOne({ _id: id, userId }).lean();
  if (!doc) throw notFound(NOT_FOUND);
  return Response.json(serializeTodo(doc));
});

/** PUT 은 제목을 포함한 전체 수정, PATCH 는 상태/순서 등 부분 수정 (드래그 앤 드롭 1회 호출용) */
function updater(partial: boolean) {
  return withAuth(async (request: Request, ctx: Ctx, userId) => {
    const id = assertObjectId((await ctx.params).id);
    const input = await parseTodoInput(await readJson(request), partial);
    const current = await TodoModel.findOne({ _id: id, userId }, { status: 1, weeklyPlanId: 1, weeklyGoalId: 1 }).lean();
    if (!current) throw notFound(NOT_FOUND);
    await resolveWeeklyGoalLink(input, {
      weeklyPlanId: current.weeklyPlanId ? String(current.weeklyPlanId) : null,
      weeklyGoalId: current.weeklyGoalId ? String(current.weeklyGoalId) : null,
    });
    if (input.status && !input.order && current.status !== input.status) {
      // 수정 폼에서 상태만 바꾸면 새 컬럼의 기존 order 와 겹칠 수 있으므로 새 컬럼 끝으로 보낸다.
      input.order = await nextOrderInColumn(input.status, userId);
    }
    const doc = await TodoModel.findOneAndUpdate({ _id: id, userId }, input, { returnDocument: "after", runValidators: true }).lean();
    if (!doc) throw notFound(NOT_FOUND);
    return Response.json(serializeTodo(doc));
  });
}

export const PUT = updater(false);
export const PATCH = updater(true);

export const DELETE = withAuth(async (_request: Request, ctx: Ctx, userId) => {
  const id = assertObjectId((await ctx.params).id);
  const doc = await TodoModel.findOneAndDelete({ _id: id, userId }).lean();
  if (!doc) throw notFound(NOT_FOUND);
  return new Response(null, { status: 204 });
});
