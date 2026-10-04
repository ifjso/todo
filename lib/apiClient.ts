import type { Goal, GoalInput, Me, Todo, TodoInput, WeeklyPlan, WeeklyPlanInput } from "@/types";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    // 세션이 없거나 만료됨: 서버가 쿠키를 지웠으므로 로그인 페이지로 보낸다.
    // 이전 사용자의 데이터가 메모리 스토어에 남지 않도록 클라이언트 라우팅이 아닌 전체 페이지 이동을 한다.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(res.status, (data as { error?: string } | null)?.error ?? `요청 실패 (${res.status})`);
  }
  return data as T;
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  me: () => request<Me>("/api/me"),
  goals: {
    list: () => request<Goal[]>("/api/goals"),
    create: (input: GoalInput) => request<Goal>("/api/goals", { method: "POST", body: json(input) }),
    update: (id: string, input: Partial<GoalInput>) =>
      request<Goal>(`/api/goals/${id}`, { method: "PUT", body: json(input) }),
    remove: (id: string) => request<void>(`/api/goals/${id}`, { method: "DELETE" }),
  },
  weekly: {
    list: (params: { weekStart?: string; goalId?: string; limit?: number } = {}) =>
      request<WeeklyPlan[]>(`/api/weekly${query(params)}`),
    get: (id: string) => request<WeeklyPlan>(`/api/weekly/${id}`),
    create: (input: WeeklyPlanInput) => request<WeeklyPlan>("/api/weekly", { method: "POST", body: json(input) }),
    update: (id: string, input: Partial<WeeklyPlanInput>) =>
      request<WeeklyPlan>(`/api/weekly/${id}`, { method: "PUT", body: json(input) }),
    remove: (id: string) => request<void>(`/api/weekly/${id}`, { method: "DELETE" }),
  },
  todos: {
    list: (params: { status?: string; weeklyPlanId?: string; weeklyGoalId?: string } = {}) =>
      request<Todo[]>(`/api/todos${query(params)}`),
    create: (input: TodoInput) => request<Todo>("/api/todos", { method: "POST", body: json(input) }),
    update: (id: string, input: Partial<TodoInput>) =>
      request<Todo>(`/api/todos/${id}`, { method: "PUT", body: json(input) }),
    patch: (id: string, input: Partial<TodoInput>) =>
      request<Todo>(`/api/todos/${id}`, { method: "PATCH", body: json(input) }),
    remove: (id: string) => request<void>(`/api/todos/${id}`, { method: "DELETE" }),
  },
};
