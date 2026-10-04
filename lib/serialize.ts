import { Types } from "mongoose";
import { computeGoalProgress, computeWeeklyProgress, emptyTodoStats, isWeeklyGoalDone } from "@/lib/progress";
import { TodoModel } from "@/models/Todo";
import { WeeklyPlanModel } from "@/models/WeeklyPlan";
import type { Goal, Priority, Todo, TodoStats, TodoStatus, WeeklyPlan } from "@/types";

type Id = Types.ObjectId | string;
type Timestamps = { createdAt?: Date; updatedAt?: Date };

function idOrNull(value: Id | null | undefined): string | null {
  return value ? String(value) : null;
}

function iso(date: Date | undefined): string {
  return date ? date.toISOString() : "";
}

type LeanTodo = Timestamps & {
  _id: Id;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  dayOfWeek?: number | null;
  order: string;
  weeklyPlanId?: Id | null;
  weeklyGoalId?: Id | null;
};

export function serializeTodo(doc: LeanTodo): Todo {
  return {
    _id: String(doc._id),
    title: doc.title,
    description: doc.description ?? "",
    status: (doc.status ?? "todo") as TodoStatus,
    priority: (doc.priority ?? "medium") as Priority,
    dueDate: doc.dueDate ?? null,
    dayOfWeek: doc.dayOfWeek ?? null,
    order: doc.order,
    weeklyPlanId: idOrNull(doc.weeklyPlanId),
    weeklyGoalId: idOrNull(doc.weeklyGoalId),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

/** 주간 계획 id 별, 주간 목표 id 별 할 일 상태 집계 */
async function todoStatsByWeeklyPlan(planIds: Id[]) {
  const byPlan = new Map<string, TodoStats>();
  const byWeeklyGoal = new Map<string, TodoStats>();
  if (planIds.length === 0) return { byPlan, byWeeklyGoal };
  const rows = await TodoModel.aggregate<{
    _id: { plan: Types.ObjectId; weeklyGoal: Types.ObjectId | null; status: TodoStatus };
    count: number;
  }>([
    { $match: { weeklyPlanId: { $in: planIds.map((id) => new Types.ObjectId(String(id))) } } },
    {
      $group: {
        _id: { plan: "$weeklyPlanId", weeklyGoal: "$weeklyGoalId", status: "$status" },
        count: { $sum: 1 },
      },
    },
  ]);
  const add = (map: Map<string, TodoStats>, key: string, status: TodoStatus, count: number) => {
    const stats = map.get(key) ?? emptyTodoStats();
    stats[status] += count;
    stats.total += count;
    map.set(key, stats);
  };
  for (const row of rows) {
    add(byPlan, String(row._id.plan), row._id.status, row.count);
    if (row._id.weeklyGoal) add(byWeeklyGoal, String(row._id.weeklyGoal), row._id.status, row.count);
  }
  return { byPlan, byWeeklyGoal };
}

type LeanWeeklyPlan = Timestamps & {
  _id: Id;
  weekStart: string;
  goals?: { _id?: Id; text: string }[];
  memo?: string | null;
  retrospective?: string | null;
  goalId?: Id | null;
};

export async function serializeWeeklyPlans(docs: LeanWeeklyPlan[]): Promise<WeeklyPlan[]> {
  const { byPlan, byWeeklyGoal } = await todoStatsByWeeklyPlan(docs.map((d) => d._id));
  return docs.map((doc) => {
    const todoStats = byPlan.get(String(doc._id)) ?? emptyTodoStats();
    return {
      _id: String(doc._id),
      weekStart: doc.weekStart,
      goals: (doc.goals ?? []).map((g) => {
        const stats = byWeeklyGoal.get(String(g._id)) ?? emptyTodoStats();
        return {
          _id: String(g._id),
          text: g.text,
          done: isWeeklyGoalDone(stats.total, stats.done),
          todoTotal: stats.total,
          todoDone: stats.done,
        };
      }),
      memo: doc.memo ?? "",
      retrospective: doc.retrospective ?? "",
      goalId: idOrNull(doc.goalId),
      progress: computeWeeklyProgress(todoStats),
      todoStats,
      createdAt: iso(doc.createdAt),
      updatedAt: iso(doc.updatedAt),
    };
  });
}

export async function serializeWeeklyPlan(doc: LeanWeeklyPlan): Promise<WeeklyPlan> {
  const [plan] = await serializeWeeklyPlans([doc]);
  return plan;
}

type LeanGoal = Timestamps & { _id: Id; title: string; description?: string | null };

export async function serializeGoals(docs: LeanGoal[]): Promise<Goal[]> {
  const plans = await WeeklyPlanModel.find({ goalId: { $in: docs.map((d) => d._id) } }, { _id: 1, goalId: 1 }).lean();
  const { byPlan: statsMap } = await todoStatsByWeeklyPlan(plans.map((p) => p._id));
  const weeksByGoal = new Map<string, { progress: number; todoStats: TodoStats }[]>();
  for (const plan of plans) {
    const key = String(plan.goalId);
    const todoStats = statsMap.get(String(plan._id)) ?? emptyTodoStats();
    const list = weeksByGoal.get(key) ?? [];
    list.push({ progress: computeWeeklyProgress(todoStats), todoStats });
    weeksByGoal.set(key, list);
  }
  return docs.map((doc) => {
    const weeks = weeksByGoal.get(String(doc._id)) ?? [];
    return {
      _id: String(doc._id),
      title: doc.title,
      description: doc.description ?? "",
      progress: computeGoalProgress(weeks),
      weeklyPlanCount: weeks.length,
      createdAt: iso(doc.createdAt),
      updatedAt: iso(doc.updatedAt),
    };
  });
}

export async function serializeGoal(doc: LeanGoal): Promise<Goal> {
  const [goal] = await serializeGoals([doc]);
  return goal;
}
