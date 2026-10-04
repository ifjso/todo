import { randomBytes } from "node:crypto";
import { isSecureRequest, OAUTH_STATE_COOKIE, serializeCookie } from "@/lib/cookies";
import { buildAuthorizeUrl, getGitHubConfig, getRedirectUri } from "@/lib/github";

const STATE_MAX_AGE_SECONDS = 10 * 60;

/** GET /auth/github — CSRF 방지용 state 를 쿠키에 담고 GitHub 인가 페이지로 보낸다. */
export async function GET(request: Request) {
  let config;
  try {
    config = getGitHubConfig();
  } catch (error) {
    // 설정 누락 안내만 내보내고 환경 변수 값은 노출하지 않는다.
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
  const state = randomBytes(32).toString("base64url");
  return new Response(null, {
    status: 302,
    headers: {
      Location: buildAuthorizeUrl(config, getRedirectUri(request), state),
      "Set-Cookie": serializeCookie(OAUTH_STATE_COOKIE, state, {
        maxAge: STATE_MAX_AGE_SECONDS,
        path: "/auth/github",
        secure: isSecureRequest(request),
      }),
      "Cache-Control": "no-store",
    },
  });
}
