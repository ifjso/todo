import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    /** 에러 응답에 함께 실을 헤더 (예: 만료된 세션 쿠키 삭제) */
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message);
}

export function notFound(message = "리소스를 찾을 수 없습니다."): HttpError {
  return new HttpError(404, message);
}

function errorResponse(status: number, message: string, headers?: Record<string, string>): Response {
  return Response.json({ error: message }, { status, headers });
}

function toErrorResponse(error: unknown): Response {
  if (error instanceof HttpError) return errorResponse(error.status, error.message, error.headers);
  if (error instanceof mongoose.Error.ValidationError) {
    const first = Object.values(error.errors)[0];
    return errorResponse(400, first?.message ?? "입력값이 올바르지 않습니다.");
  }
  if (error instanceof mongoose.Error.CastError) {
    return errorResponse(400, `잘못된 값입니다: ${error.path}`);
  }
  if (typeof error === "object" && error !== null && (error as { code?: number }).code === 11000) {
    return errorResponse(409, "이미 존재하는 데이터입니다.");
  }
  console.error(error);
  return errorResponse(500, "서버 오류가 발생했습니다.");
}

/** DB 연결 + 공통 에러 처리를 감싼다. DB 연결 실패도 500 으로 변환된다. */
export function withDB<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      await connectDB();
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID_RE.test(value);
}

/** 경로 파라미터 id 검증. 형식이 틀리면 400. */
export function assertObjectId(value: string, label = "id"): string {
  if (!isObjectId(value)) throw badRequest(`잘못된 ${label} 형식입니다.`);
  return value;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw badRequest("요청 본문은 JSON 객체여야 합니다.");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw badRequest("요청 본문이 올바른 JSON 이 아닙니다.");
  }
}
