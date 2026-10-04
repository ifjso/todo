// DB 에 의존하지 않는 쿠키 헬퍼. proxy.ts 에서도 사용한다.

export const SESSION_COOKIE = "session";
export const OAUTH_STATE_COOKIE = "oauth_state";

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

/** HTTPS 로 들어온 요청이면 Secure 쿠키를 쓴다 (리버스 프록시의 x-forwarded-proto 포함). */
export function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

interface CookieOptions {
  maxAge: number;
  path?: string;
  secure: boolean;
}

/** httpOnly + SameSite=Lax 쿠키. Lax 라서 다른 사이트에서 보낸 POST/fetch 에는 실리지 않는다. */
export function serializeCookie(name: string, value: string, { maxAge, path = "/", secure }: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie(name: string, request: Request, path = "/"): string {
  return serializeCookie(name, "", { maxAge: 0, path, secure: isSecureRequest(request) });
}
