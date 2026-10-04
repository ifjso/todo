import { HttpError } from "@/lib/http";

export interface GitHubConfig {
  clientId: string;
  clientSecret: string;
  /** 기본 https://github.com — 테스트에서는 가짜 서버 주소로 바꾼다. */
  oauthUrl: string;
  /** 기본 https://api.github.com */
  apiUrl: string;
}

export interface GitHubProfile {
  id: number;
  login: string;
  avatar_url: string;
}

/** 클라이언트 비밀값은 환경 변수로만 읽는다 (하드코딩 금지). */
export function getGitHubConfig(): GitHubConfig {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new HttpError(500, "GitHub 로그인이 설정되지 않았습니다. 서버 환경 변수를 확인하세요.");
  }
  return {
    clientId,
    clientSecret,
    oauthUrl: (process.env.GITHUB_OAUTH_URL || "https://github.com").replace(/\/$/, ""),
    apiUrl: (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, ""),
  };
}

const GITHUB_TIMEOUT_MS = 10_000;

/** 앱의 외부 origin. 리버스 프록시 뒤에서는 APP_URL 로 지정한다. */
export function appOrigin(request: Request): string {
  return (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

/** GitHub 에 등록한 Authorization callback URL 과 같아야 한다. */
export function getRedirectUri(request: Request): string {
  return `${appOrigin(request)}/auth/github/callback`;
}

export function buildAuthorizeUrl(config: GitHubConfig, redirectUri: string, state: string): string {
  const url = new URL(`${config.oauthUrl}/login/oauth/authorize`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "true");
  return url.toString();
}

/** 인가 코드를 access token 으로 교환한 뒤 사용자 정보를 가져온다. 토큰은 저장하지 않는다. */
export async function fetchGitHubProfile(config: GitHubConfig, code: string, redirectUri: string): Promise<GitHubProfile> {
  const tokenRes = await fetch(`${config.oauthUrl}/login/oauth/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
  });
  const tokenData = (await tokenRes.json().catch(() => null)) as { access_token?: string; error?: string } | null;
  if (!tokenRes.ok || !tokenData?.access_token) {
    throw new Error(`GitHub 토큰 교환 실패: ${tokenData?.error ?? tokenRes.status}`);
  }

  const userRes = await fetch(`${config.apiUrl}/user`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "todo-planner",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
  });
  const profile = (await userRes.json().catch(() => null)) as Partial<GitHubProfile> | null;
  if (!userRes.ok || typeof profile?.id !== "number" || typeof profile.login !== "string") {
    throw new Error(`GitHub 사용자 조회 실패: ${userRes.status}`);
  }
  return { id: profile.id, login: profile.login, avatar_url: profile.avatar_url ?? "" };
}
