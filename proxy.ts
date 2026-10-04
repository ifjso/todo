import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/cookies";

/**
 * 페이지 접근 전 낙관적 검사: 세션 쿠키가 없으면 /login 으로 보낸다.
 * 세션의 실제 유효성은 API(requireUserId)가 DB 로 확인하고, 무효하면 401 과 함께 쿠키를 지운다.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!hasSession && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // API(자체적으로 401), OAuth 라우트, 정적 파일은 제외한다.
  matcher: ["/((?!api/|auth/|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
