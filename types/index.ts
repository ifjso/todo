export type TodoStatus = "todo" | "doing" | "done";
export type Priority = "high" | "medium" | "low";

export const TODO_STATUSES: TodoStatus[] = ["todo", "doing", "done"];
export const PRIORITIES: Priority[] = ["high", "medium", "low"];
export const MAX_WEEKLY_GOALS = 5;

export interface Goal {
  _id: string;
  title: string;
  description: string;
  /** 연결된 주간 계획들의 진행률 평균 (0-100) */
  progress: number;
  weeklyPlanCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyGoalItem {
  _id: string;
  text: string;
  /** 연결된 할 일이 1개 이상이고 모두 완료이면 true (조회 시 계산, 수동 변경 불가) */
  done: boolean;
  todoTotal: number;
  todoDone: number;
}

export interface TodoStats {
  total: number;
  todo: number;
  doing: number;
  done: number;
}

export interface WeeklyPlan {
  _id: string;
  /** 해당 주의 월요일 (YYYY-MM-DD) */
  weekStart: string;
  goals: WeeklyGoalItem[];
  memo: string;
  retrospective: string;
  goalId: string | null;
  /** 연결된 할 일의 완료율 (0-100) */
  progress: number;
  todoStats: TodoStats;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  _id: string;
  title: string;
  description: string;
  status: TodoStatus;
  priority: Priority;
  /** YYYY-MM-DD */
  dueDate: string | null;
  /** 0(일) ~ 6(토) */
  dayOfWeek: number | null;
  /** fractional index 문자열, 사전순 정렬 */
  order: string;
  weeklyPlanId: string | null;
  /** 주간 계획(weeklyPlanId) 안의 주간 목표 _id */
  weeklyGoalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalInput {
  title: string;
  description?: string;
}

export interface WeeklyPlanInput {
  weekStart: string;
  /** 기존 목표는 _id 를 함께 보내야 연결된 할 일이 유지된다. */
  goals?: { _id?: string; text: string }[];
  memo?: string;
  retrospective?: string;
  goalId?: string | null;
}

export interface TodoInput {
  title: string;
  description?: string;
  status?: TodoStatus;
  priority?: Priority;
  dueDate?: string | null;
  dayOfWeek?: number | null;
  order?: string;
  weeklyPlanId?: string | null;
  weeklyGoalId?: string | null;
}

/** 로그인 사용자 (GET /api/me) */
export interface Me {
  username: string;
  avatarUrl: string;
}
