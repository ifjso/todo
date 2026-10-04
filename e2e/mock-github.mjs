// E2E 전용 가짜 GitHub OAuth 서버. 앱은 GITHUB_OAUTH_URL / GITHUB_API_URL 로 이 서버를 바라본다.
//  GET  /login/oauth/authorize   → 현재 사용자로 즉시 승인하고 redirect_uri 로 code 를 돌려준다
//  POST /login/oauth/access_token → client_secret 과 code 를 확인하고 access_token 발급
//  GET  /user                    → Bearer 토큰의 사용자 정보
//  POST /__set-user {login}      → 다음 로그인에 쓸 사용자 지정 (테스트 제어용)
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_GITHUB_PORT ?? 3299);
const CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? "e2e-client-id";
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? "e2e-client-secret";
// 1x1 투명 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

let currentLogin = "alice";
const ids = new Map();
const idOf = (login) => {
  if (!ids.has(login)) ids.set(login, 1000 + ids.size);
  return ids.get(login);
};

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/login/oauth/authorize") {
    if (url.searchParams.get("client_id") !== CLIENT_ID) return json(res, 400, { error: "bad client_id" });
    const redirect = new URL(url.searchParams.get("redirect_uri"));
    redirect.searchParams.set("code", `code-${currentLogin}`);
    redirect.searchParams.set("state", url.searchParams.get("state") ?? "");
    res.writeHead(302, { Location: redirect.toString() });
    return res.end();
  }

  if (req.method === "POST" && url.pathname === "/login/oauth/access_token") {
    const body = JSON.parse((await readBody(req)) || "{}");
    if (body.client_id !== CLIENT_ID || body.client_secret !== CLIENT_SECRET) {
      return json(res, 200, { error: "incorrect_client_credentials" });
    }
    if (!String(body.code).startsWith("code-")) return json(res, 200, { error: "bad_verification_code" });
    return json(res, 200, { access_token: `token-${String(body.code).slice(5)}`, token_type: "bearer" });
  }

  if (req.method === "GET" && url.pathname === "/user") {
    const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!token.startsWith("token-")) return json(res, 401, { message: "Bad credentials" });
    const login = token.slice(6);
    return json(res, 200, { id: idOf(login), login, avatar_url: `http://localhost:${PORT}/avatars/${login}.png` });
  }

  if (req.method === "GET" && url.pathname.startsWith("/avatars/")) {
    res.writeHead(200, { "Content-Type": "image/png" });
    return res.end(PNG);
  }

  if (req.method === "POST" && url.pathname === "/__set-user") {
    currentLogin = JSON.parse((await readBody(req)) || "{}").login ?? "alice";
    return json(res, 200, { login: currentLogin });
  }

  if (url.pathname === "/__health") return json(res, 200, { ok: true });
  json(res, 404, { error: "not found" });
}).listen(PORT, () => console.log(`mock github listening on ${PORT}`));
