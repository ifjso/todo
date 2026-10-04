import { timingSafeEqual } from "node:crypto";
import { createSession, deleteSession } from "@/lib/auth";
import { clearCookie, OAUTH_STATE_COOKIE, readCookie } from "@/lib/cookies";
import { appOrigin, fetchGitHubProfile, getGitHubConfig, getRedirectUri } from "@/lib/github";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/models/User";

type LoginError = "state" | "denied" | "github" | "config" | "server";

function redirect(request: Request, path: string, cookies: string[]): Response {
  const headers = new Headers({ Location: `${appOrigin(request)}${path}`, "Cache-Control": "no-store" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** GET /auth/github/callback — state 검증 → 토큰 교환 → 사용자 저장 → 세션 발급 */
export async function GET(request: Request) {
  // state 쿠키는 성공/실패와 관계없이 한 번 쓰고 지운다.
  const clearState = clearCookie(OAUTH_STATE_COOKIE, request, "/auth/github");
  const fail = (error: LoginError) => redirect(request, `/login?error=${error}`, [clearState]);

  const params = new URL(request.url).searchParams;
  if (params.get("error")) return fail("denied");

  const code = params.get("code");
  const state = params.get("state");
  const savedState = readCookie(request, OAUTH_STATE_COOKIE);
  if (!code || !state || !savedState || !sameState(state, savedState)) return fail("state");

  let config;
  try {
    config = getGitHubConfig();
  } catch {
    return fail("config");
  }

  let profile;
  try {
    profile = await fetchGitHubProfile(config, code, getRedirectUri(request));
  } catch (error) {
    console.error(error);
    return fail("github");
  }

  try {
    await connectDB();
    const user = await UserModel.findOneAndUpdate(
      { githubId: profile.id },
      { $set: { username: profile.login, avatarUrl: profile.avatar_url } },
      { upsert: true, returnDocument: "after" },
    ).lean();
    // 이 브라우저에 남아 있던 이전 세션은 지우고 새로 발급한다.
    await deleteSession(request);
    const sessionCookie = await createSession(String(user!._id), request);
    return redirect(request, "/", [clearState, sessionCookie]);
  } catch (error) {
    console.error(error);
    return fail("server");
  }
}
