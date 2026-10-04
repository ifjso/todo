import { createHash, randomBytes } from "node:crypto";
import { clearCookie, isSecureRequest, readCookie, serializeCookie, SESSION_COOKIE } from "@/lib/cookies";
import { HttpError, withDB } from "@/lib/http";
import { SessionModel } from "@/models/Session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30일

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 세션을 만들고, 브라우저에 줄 Set-Cookie 값을 반환한다. DB 에는 토큰 해시만 저장한다. */
export async function createSession(userId: string, request: Request): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await SessionModel.create({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
  });
  return serializeCookie(SESSION_COOKIE, token, {
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: isSecureRequest(request),
  });
}

/** 현재 요청의 세션을 DB 에서 삭제한다. 삭제한 세션이 있으면 true. */
export async function deleteSession(request: Request): Promise<boolean> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return false;
  const result = await SessionModel.deleteOne({ tokenHash: hashToken(token) });
  return result.deletedCount > 0;
}

/** 로그인 사용자 id. 세션이 없거나 만료/삭제되었으면 401 (잘못된 쿠키는 함께 지운다). */
export async function requireUserId(request: Request): Promise<string> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) throw new HttpError(401, "로그인이 필요합니다.");
  const session = await SessionModel.findOne(
    { tokenHash: hashToken(token), expiresAt: { $gt: new Date() } },
    { userId: 1 },
  ).lean();
  if (!session) {
    throw new HttpError(401, "로그인이 만료되었습니다. 다시 로그인하세요.", {
      "Set-Cookie": clearCookie(SESSION_COOKIE, request),
    });
  }
  return String(session.userId);
}

/** withDB + 로그인 확인. 핸들러는 세 번째 인자로 로그인 사용자 id 를 받는다. */
export function withAuth<Ctx = unknown>(
  handler: (request: Request, ctx: Ctx, userId: string) => Promise<Response>,
): (request: Request, ctx: Ctx) => Promise<Response> {
  return withDB(async (request: Request, ctx: Ctx) => handler(request, ctx, await requireUserId(request)));
}
