import { orderAfter } from "@/lib/fractionalIndex";
import { TodoModel } from "@/models/Todo";
import type { TodoStatus } from "@/types";

/** 해당 사용자의 상태 컬럼 맨 끝에 붙일 order 키 (서버 전용) */
export async function nextOrderInColumn(status: TodoStatus, userId: string): Promise<string> {
  const last = await TodoModel.findOne({ userId, status }, { order: 1 }).sort({ order: -1 }).lean();
  return orderAfter(last?.order);
}
