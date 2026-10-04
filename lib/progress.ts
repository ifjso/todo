import type { TodoStats, TodoStatus } from "@/types";

export function emptyTodoStats(): TodoStats {
  return { total: 0, todo: 0, doing: 0, done: 0 };
}

export function computeTodoStats(statuses: TodoStatus[]): TodoStats {
  const stats = emptyTodoStats();
  for (const status of statuses) {
    stats[status] += 1;
    stats.total += 1;
  }
  return stats;
}

/** 주간 진행률: 연결된 할 일 중 done 비율. 할 일이 없으면 0. */
export function computeWeeklyProgress(stats: TodoStats): number {
  if (stats.total === 0) return 0;
  return Math.round((stats.done / stats.total) * 100);
}

/**
 * 1년 목표 달성률: 할 일이 1개 이상인 연결된 주간 계획들의 진행률 평균.
 * 할 일이 없는 주간 계획은 아직 시작 전이므로 평균에서 제외한다.
 */
export function computeGoalProgress(weeks: { progress: number; todoStats: TodoStats }[]): number {
  const active = weeks.filter((w) => w.todoStats.total > 0);
  if (active.length === 0) return 0;
  const sum = active.reduce((acc, w) => acc + w.progress, 0);
  return Math.round(sum / active.length);
}

/** 주간 목표 자동 완료: 연결된 할 일이 1개 이상이고 모두 done 이면 완료 */
export function isWeeklyGoalDone(todoTotal: number, todoDone: number): boolean {
  return todoTotal > 0 && todoDone === todoTotal;
}
