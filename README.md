# Todo Planner

할 일 → 주간 목표(주간 계획) → 1년 목표를 하나로 연결해 관리하는 앱입니다. 요구사항은 [docs/PRD.md](docs/PRD.md), 구현 계획은 [docs/PLAN.md](docs/PLAN.md)를 참고하세요.

## 주요 기능

- **대시보드 (`/`)**: 이번 주 계획, 주간 목표 완료 현황, 상태별 할 일 수, 주간 진행률, 1년 목표별 진행률
- **할 일 (`/todos`)**: todo / doing / done 칸반 보드, 드래그 앤 드롭으로 상태·순서 변경 (fractional index, 이동 1건당 PATCH 1회)
  - 우선순위 High 는 컬럼 상단 고정, 지난 마감일은 빨간색 표시
- **주간 계획 (`/weekly`)**: 주간 목표(최대 5개), 메모, 회고, 요일별(월~일) 할 일 배치, 1년 목표 연결
  - 할 일은 주간 목표에 연결하며, 연결된 할 일이 모두 완료되면 주간 목표가 자동으로 완료된다 (수동 완료 없음)
- **1년 목표 (`/goals`)**: 목표 CRUD 와 달성률
- **GitHub 로그인**: GitHub OAuth 로 로그인하며, 할 일은 사용자별(본인 것만), 주간 계획·1년 목표는 모든 사용자가 함께 쓰는 공용 데이터다. 설정 방법은 [docs/GITHUB_OAUTH.md](docs/GITHUB_OAUTH.md)
- **다크 모드**: 상단 내비게이션의 테마 버튼으로 시스템 → 라이트 → 다크 전환. 선택은 브라우저에 저장되고, 시스템 설정이면 OS 테마를 따른다.

### 진행률 계산

- 주간 목표 완료 = 연결된 할 일이 1개 이상이고 모두 `done` (하나라도 되돌리면 다시 미완료)
- 주간 진행률 = 주간 계획에 연결된 (모든 사용자의) 할 일 중 `done` 비율
- 1년 목표 달성률 = 목표에 연결된 주간 계획(할 일이 1개 이상인 주) 진행률의 평균
- 모두 조회 시 서버에서 계산하므로 할 일 상태를 바꾸면 바로 반영됩니다.

## 기술 스택

Next.js 16 (App Router) · React 19 · TypeScript · MongoDB + Mongoose · Tailwind CSS v4 · Zustand · dnd-kit · fractional-indexing · Vitest · Playwright

## 실행 방법

요구 사항: Node.js 20.9 이상, Docker

```bash
# 1. MongoDB 실행 (localhost:27017)
docker compose up -d        # 또는 npm run db:up

# 2. 환경 변수
cp .env.example .env.local  # MONGODB_URI, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
#    GitHub OAuth App 만들기: docs/GITHUB_OAUTH.md

# 3. 의존성 설치 및 개발 서버
npm install
npm run dev                 # http://localhost:3000
```

프로덕션 빌드: `npm run build && npm start`

## 테스트

MongoDB 가 실행 중이어야 합니다. E2E 는 가짜 GitHub 서버(`e2e/mock-github.mjs`)로 로그인하므로 GitHub 계정이 필요 없습니다. 각 테스트는 별도 DB(`todo-planner-test`, `todo-planner-e2e`)를 사용하므로 개발 데이터에 영향을 주지 않습니다.

```bash
npm test             # Vitest: 단위 + API 통합 테스트
npm run test:e2e     # Playwright: 빌드 후 3200 포트로 띄워 E2E 실행
npx playwright install chromium   # 최초 1회 브라우저 설치
npm run lint
npm run typecheck
```

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/auth/github` | GitHub 로그인 시작 (state 쿠키 + GitHub 인가 페이지로 리다이렉트) |
| GET | `/auth/github/callback` | GitHub 콜백: 사용자 저장 + 세션 발급 후 `/` 로 이동 |
| POST | `/auth/logout` | 세션 삭제 + 쿠키 만료 후 `/login` 으로 이동 |
| GET | `/api/me` | 로그인 사용자 `{ username, avatarUrl }` |
| GET / POST | `/api/goals` | 목표 목록(진행률 포함) / 생성 |
| GET / PUT / DELETE | `/api/goals/:id` | 단건 조회 / 수정 / 삭제(연결만 해제) |
| GET / POST | `/api/weekly?weekStart=&goalId=&limit=` | 주간 계획 목록 / 생성 (같은 주 중복 시 409) |
| GET / PUT / PATCH / DELETE | `/api/weekly/:id` | 부분 수정. 주간 목표 편집 시 기존 목표는 `_id` 를 함께 보내야 연결이 유지된다 |
| GET / POST | `/api/todos?status=&weeklyPlanId=&weeklyGoalId=` | 할 일 목록(order 순) / 생성. `weeklyGoalId` 만 보내면 주간 계획이 자동 지정 |
| GET / PUT / PATCH / DELETE | `/api/todos/:id` | PATCH 로 status/order 부분 수정 |

`/api/*` 는 모두 로그인이 필요합니다(없으면 401). `/api/todos` 는 로그인 사용자의 할 일만 다루며 다른 사용자의 할 일 id 로 요청하면 404 이고, `/api/weekly`·`/api/goals` 는 공용입니다.

에러 응답은 `{ "error": "메시지" }` 형식입니다. 잘못된 ObjectId 와 검증 실패는 400, 없는 리소스는 404, 중복은 409, DB 오류는 500 을 반환합니다.

## 디렉토리

```
app/            페이지와 API Route Handler
components/     layout / shared / todos / weekly / goals / dashboard
lib/            DB 연결, 검증, 직렬화, 진행률, 날짜, 정렬, API 클라이언트
models/         Mongoose 모델 (Goal, WeeklyPlan, Todo)
store/          Zustand 스토어 (todo / weekly / goal 슬라이스)
tests/          Vitest 단위·통합 테스트
e2e/            Playwright E2E
```
