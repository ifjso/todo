import { badRequest, isObjectId } from "@/lib/http";
import { getWeekStart, isDateString, parseDate } from "@/lib/date";
import { isValidOrderKey } from "@/lib/fractionalIndex";
import { GoalModel } from "@/models/Goal";
import { WeeklyPlanModel } from "@/models/WeeklyPlan";
import { MAX_WEEKLY_GOALS, PRIORITIES, TODO_STATUSES, type Priority, type TodoStatus } from "@/types";

type Body = Record<string, unknown>;

function has(body: Body, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function requiredTitle(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") throw badRequest("제목은 필수입니다.");
  return value.trim();
}

function optionalString(value: unknown, label: string): string {
  if (typeof value !== "string") throw badRequest(`${label}은(는) 문자열이어야 합니다.`);
  return value;
}

async function optionalRef(
  value: unknown,
  label: string,
  exists: (id: string) => Promise<boolean>,
): Promise<string | null> {
  if (value === null || value === "") return null;
  if (!isObjectId(value)) throw badRequest(`잘못된 ${label} 형식입니다.`);
  if (!(await exists(value))) throw badRequest(`연결할 ${label}이(가) 존재하지 않습니다.`);
  return value;
}

// 주간 계획과 1년 목표는 공용이므로 전체에서 찾는다.
const goalExists = async (id: string) => (await GoalModel.exists({ _id: id })) !== null;
const weeklyPlanExists = async (id: string) => (await WeeklyPlanModel.exists({ _id: id })) !== null;

/** partial=true 이면 전달된 필드만 검증해 반환한다 (PUT/PATCH). */
export function parseGoalInput(body: Body, partial: boolean) {
  const out: { title?: string; description?: string } = {};
  if (!partial || has(body, "title")) out.title = requiredTitle(body.title);
  if (has(body, "description")) out.description = optionalString(body.description, "설명");
  return out;
}

export type WeeklyGoalInput = { _id?: string; text: string };

/** 완료 여부는 할 일로 계산하므로 입력에서 받지 않는다. 기존 목표는 _id 로 식별해 연결을 유지한다. */
function parseWeeklyGoals(value: unknown): WeeklyGoalInput[] {
  if (!Array.isArray(value)) throw badRequest("주간 목표는 배열이어야 합니다.");
  if (value.length > MAX_WEEKLY_GOALS) {
    throw badRequest(`주간 목표는 최대 ${MAX_WEEKLY_GOALS}개까지 등록할 수 있습니다.`);
  }
  return value.map((item) => {
    const raw = (typeof item === "string" ? { text: item } : item) as { _id?: unknown; text?: unknown };
    if (typeof raw?.text !== "string" || raw.text.trim() === "") {
      throw badRequest("주간 목표 내용은 비어 있을 수 없습니다.");
    }
    if (raw._id === undefined) return { text: raw.text.trim() };
    if (!isObjectId(raw._id)) throw badRequest("잘못된 주간 목표 id 형식입니다.");
    return { _id: raw._id, text: raw.text.trim() };
  });
}

export async function parseWeeklyInput(body: Body, partial: boolean) {
  const out: {
    weekStart?: string;
    goals?: WeeklyGoalInput[];
    memo?: string;
    retrospective?: string;
    goalId?: string | null;
  } = {};
  if (!partial || has(body, "weekStart")) {
    if (!isDateString(body.weekStart)) throw badRequest("weekStart 는 YYYY-MM-DD 형식이어야 합니다.");
    // 어떤 날짜가 와도 그 주의 월요일로 정규화한다.
    out.weekStart = getWeekStart(parseDate(body.weekStart)!);
  }
  if (has(body, "goals")) out.goals = parseWeeklyGoals(body.goals);
  if (has(body, "memo")) out.memo = optionalString(body.memo, "메모");
  if (has(body, "retrospective")) out.retrospective = optionalString(body.retrospective, "회고");
  if (has(body, "goalId")) out.goalId = await optionalRef(body.goalId, "목표", goalExists);
  return out;
}

type TodoLinks = { weeklyPlanId?: string | null; weeklyGoalId?: string | null };

/**
 * 할 일의 주간 목표 연결을 정리한다.
 * - 주간 목표만 지정하면 그 목표가 속한 주간 계획으로 weeklyPlanId 를 채운다.
 * - 주간 계획과 주간 목표가 맞지 않으면 400.
 * - 주간 계획만 바뀌면 이전 계획의 주간 목표 연결은 해제한다.
 */
export async function resolveWeeklyGoalLink(input: TodoLinks, current: TodoLinks | null): Promise<void> {
  const planId = input.weeklyPlanId !== undefined ? input.weeklyPlanId : (current?.weeklyPlanId ?? null);

  if (input.weeklyGoalId) {
    if (planId === null) {
      const owner = await WeeklyPlanModel.findOne({ "goals._id": input.weeklyGoalId }, { _id: 1 }).lean();
      if (!owner) throw badRequest("연결할 주간 목표가 존재하지 않습니다.");
      input.weeklyPlanId = String(owner._id);
    } else if (!(await WeeklyPlanModel.exists({ _id: planId, "goals._id": input.weeklyGoalId }))) {
      throw badRequest("선택한 주간 목표가 해당 주간 계획에 없습니다.");
    }
    return;
  }

  const planChanged = input.weeklyPlanId !== undefined && input.weeklyPlanId !== (current?.weeklyPlanId ?? null);
  if (input.weeklyGoalId === undefined && planChanged && current?.weeklyGoalId) input.weeklyGoalId = null;
}

export async function parseTodoInput(body: Body, partial: boolean) {
  const out: {
    title?: string;
    description?: string;
    status?: TodoStatus;
    priority?: Priority;
    dueDate?: string | null;
    dayOfWeek?: number | null;
    order?: string;
    weeklyPlanId?: string | null;
    weeklyGoalId?: string | null;
  } = {};
  if (!partial || has(body, "title")) out.title = requiredTitle(body.title);
  if (has(body, "description")) out.description = optionalString(body.description, "설명");
  if (has(body, "status")) {
    if (!TODO_STATUSES.includes(body.status as TodoStatus)) throw badRequest("잘못된 상태 값입니다.");
    out.status = body.status as TodoStatus;
  }
  if (has(body, "priority")) {
    if (!PRIORITIES.includes(body.priority as Priority)) throw badRequest("잘못된 우선순위 값입니다.");
    out.priority = body.priority as Priority;
  }
  if (has(body, "dueDate")) {
    if (body.dueDate === null || body.dueDate === "") out.dueDate = null;
    else if (isDateString(body.dueDate)) out.dueDate = body.dueDate;
    else throw badRequest("마감일은 YYYY-MM-DD 형식이어야 합니다.");
  }
  if (has(body, "dayOfWeek")) {
    const v = body.dayOfWeek;
    if (v === null) out.dayOfWeek = null;
    else if (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 6) out.dayOfWeek = v as number;
    else throw badRequest("요일은 0(일)~6(토) 사이 정수여야 합니다.");
  }
  if (has(body, "order")) {
    if (typeof body.order !== "string" || !isValidOrderKey(body.order)) throw badRequest("order 값이 올바르지 않습니다.");
    out.order = body.order;
  }
  if (has(body, "weeklyPlanId")) {
    out.weeklyPlanId = await optionalRef(body.weeklyPlanId, "주간 계획", weeklyPlanExists);
  }
  if (has(body, "weeklyGoalId")) {
    const v = body.weeklyGoalId;
    if (v === null || v === "") out.weeklyGoalId = null;
    else if (isObjectId(v)) out.weeklyGoalId = v;
    else throw badRequest("잘못된 주간 목표 형식입니다.");
  }
  return out;
}
