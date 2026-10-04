import { deleteSession } from "@/lib/auth";
import { clearCookie, SESSION_COOKIE } from "@/lib/cookies";
import { appOrigin } from "@/lib/github";
import { connectDB } from "@/lib/mongodb";

/**
 * POST /auth/logout — DB 의 세션 문서를 삭제하고 세션 쿠키를 만료시킨다.
 * GET 이 아닌 POST 라서 다른 사이트의 링크/이미지로 로그아웃되지 않는다 (SameSite=Lax).
 */
export async function POST(request: Request) {
  try {
    await connectDB();
    await deleteSession(request);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "로그아웃 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${appOrigin(request)}/login`,
      "Set-Cookie": clearCookie(SESSION_COOKIE, request),
      "Cache-Control": "no-store",
    },
  });
}
