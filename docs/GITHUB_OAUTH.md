# GitHub OAuth 로그인 설정

할 일 앱은 GitHub 계정으로 로그인합니다. 로그인하지 않으면 어떤 페이지/API 도 쓸 수 없고, 데이터 범위는 다음과 같습니다.

- **할 일**: 사용자별. 본인의 할 일만 조회/수정/삭제할 수 있습니다.
- **주간 계획·1년 목표**: 공용. 로그인한 모든 사용자가 함께 보고 수정하며, 누구의 할 일이든 연결할 수 있습니다. 주간 진행률과 주간 목표 자동 완료는 연결된 모든 사용자의 할 일로 계산합니다.

## 1. GitHub OAuth App 만들기

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
   (바로가기: https://github.com/settings/applications/new)
2. 아래처럼 입력합니다.

   | 항목 | 로컬 개발 값 |
   |---|---|
   | Application name | `Todo Planner (local)` 등 자유 |
   | Homepage URL | `http://localhost:3000` |
   | Authorization callback URL | `http://localhost:3000/auth/github/callback` |

   운영 환경은 별도 OAuth App 을 만들고 도메인에 맞게 `https://<도메인>/auth/github/callback` 으로 등록합니다.
3. **Register application** 후 화면의 **Client ID** 를 복사합니다.
4. **Generate a new client secret** 으로 Client secret 을 만들고 복사합니다. (다시 볼 수 없으니 바로 저장)

## 2. 환경 변수 설정

`.env.example` 을 참고해 `.env.local`(또는 `.env`)에 값을 넣습니다. 이 파일들은 `.gitignore` 대상이라 커밋되지 않습니다.

```bash
GITHUB_CLIENT_ID=<Client ID>
GITHUB_CLIENT_SECRET=<Client secret>
# (선택) callback URL 의 origin 이 요청 주소와 다를 때만 (리버스 프록시 등)
# APP_URL=https://todo.example.com
```

- Client secret 은 **코드에 하드코딩하지 않고** 서버에서 `process.env.GITHUB_CLIENT_SECRET` 으로만 읽습니다. 브라우저로 전달되지 않습니다.
- 값이 없으면 `/auth/github` 가 500("GitHub 로그인이 설정되지 않았습니다")을 반환합니다.
- 환경 변수를 바꾼 뒤에는 `npm run dev` 를 다시 시작하세요.

## 3. 로그인 흐름

| 경로 | 설명 |
|---|---|
| `GET /auth/github` | CSRF 방지용 `state` 를 httpOnly 쿠키(10분)에 담고 GitHub 인가 페이지로 리다이렉트 (scope: `read:user`) |
| `GET /auth/github/callback` | `state` 검증 → 인가 코드를 access token 으로 교환 → GitHub `/user` 조회 → 사용자 저장 → 세션 발급 → `/` 로 이동. 실패 시 `/login?error=...` |
| `POST /auth/logout` | DB 의 세션 문서 삭제 + 세션 쿠키 만료 → `/login` |
| `GET /api/me` | 로그인 사용자 `{ username, avatarUrl }` |

- **사용자 저장**: `users` 컬렉션에 GitHub `id`(githubId, 고유), `login`(username), `avatar_url`(avatarUrl)을 저장하고 다시 로그인할 때마다 갱신합니다. GitHub access token 은 저장하지 않습니다.
- **세션**: 무작위 토큰을 httpOnly·SameSite=Lax 쿠키(`session`, 30일)로 주고, DB(`sessions`)에는 토큰의 SHA-256 해시만 저장합니다. 만료된 세션은 TTL 인덱스로 자동 삭제됩니다.
- **접근 제어**: 세션 쿠키가 없으면 페이지 요청은 `proxy.ts` 가 `/login` 으로 보내고, API 는 DB 로 세션을 확인해 무효하면 401 을 반환합니다.

## 4. 기존 데이터 마이그레이션

로그인 도입 전 할 일에는 소유자(`userId`)가 없어 로그인 후에도 보이지 않습니다. 아래 순서로 소유자를 지정하세요. (주간 계획·1년 목표는 공용이라 소유자가 필요 없습니다.)

```bash
# 1) 앱에서 데이터를 가져갈 GitHub 계정으로 한 번 로그인한다 (users 에 사용자가 생성됨)

# 2) 변경 내용 미리 보기 (아무것도 바꾸지 않음)
npm run db:migrate:user-id -- --dry-run --owner <GitHub 아이디>

# 3) 실행
npm run db:migrate:user-id -- --owner <GitHub 아이디>
```

- `todos` 중 `userId` 가 없는(또는 null 인) 할 일을 지정한 사용자에게 할당하고, 할 일에 `userId` 인덱스를 만듭니다. `--owner` 없이 실행하면 인덱스만 정리하고 미할당 개수를 보고합니다.
- `weeklyplans`/`goals` 는 공용이므로 소유자를 붙이지 않습니다. 혹시 붙어 있는 `userId` 필드·인덱스는 제거하고, 같은 주 계획이 하나만 있도록 전역 unique 인덱스(`weekStart_1`)를 보장합니다.
- 이미 소유자가 있는 문서는 건드리지 않으므로 여러 번 실행해도 안전합니다.
- 같은 주의 주간 계획이 여러 개 있거나 `--owner` 사용자가 없거나 여러 명이면, 아무것도 바꾸지 않고 중단합니다.
- 실행 전 DB 백업(예: `mongodump`)을 권장합니다.

## 5. 테스트

GitHub 주소는 `GITHUB_OAUTH_URL`(기본 `https://github.com`), `GITHUB_API_URL`(기본 `https://api.github.com`)로 바꿀 수 있습니다. E2E 테스트(`npm run test:e2e`)는 이를 이용해 가짜 GitHub 서버(`e2e/mock-github.mjs`)로 실제 브라우저 로그인 흐름을 검증하므로 GitHub 계정이 필요 없습니다.
