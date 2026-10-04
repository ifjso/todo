import { deleteSession, withAuth } from "@/lib/auth";
import { clearCookie, SESSION_COOKIE } from "@/lib/cookies";
import { HttpError } from "@/lib/http";
import { UserModel } from "@/models/User";

/** GET /api/me — 로그인 사용자 정보 */
export const GET = withAuth(async (request, _ctx, userId) => {
  const user = await UserModel.findById(userId, { username: 1, avatarUrl: 1 }).lean();
  if (!user) {
    // 사용자 문서 없이 세션만 남은 경우: 세션과 쿠키를 지워 /login ↔ / 리다이렉트 루프를 막는다.
    await deleteSession(request);
    throw new HttpError(401, "로그인이 필요합니다.", { "Set-Cookie": clearCookie(SESSION_COOKIE, request) });
  }
  return Response.json({ username: user.username, avatarUrl: user.avatarUrl ?? "" });
});
