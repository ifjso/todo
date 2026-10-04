import ThemeToggle from "@/components/layout/ThemeToggle";
import { primaryButtonClass } from "@/components/shared/styles";

const ERROR_MESSAGES: Record<string, string> = {
  state: "로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.",
  denied: "GitHub 로그인이 취소되었습니다.",
  github: "GitHub 인증에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  config: "서버에 GitHub 로그인이 설정되지 않았습니다. 관리자에게 문의하세요.",
  server: "로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.server : null;

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-md border border-hairline bg-canvas p-8 text-center shadow-float sm:p-12">
      <div className="flex flex-col items-center gap-4">
        <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-on-primary">
          ✓
        </span>
        <h1 className="text-[28px] font-bold leading-[1.43] text-ink">Todo Planner</h1>
        <p className="-mt-3 text-base text-muted">
          할 일, 주간 계획, 1년 목표를 한곳에서 관리하세요.
        </p>
      </div>
      {message && (
        <p role="alert" className="w-full rounded-sm bg-error-soft px-4 py-3 text-left text-sm text-error">
          {message}
        </p>
      )}
      {/* OAuth 라우트는 외부로 리다이렉트하므로 클라이언트 라우팅(Link)이 아닌 일반 링크를 쓴다. */}
      <a
        href="/auth/github"
        className={`${primaryButtonClass} w-full gap-2`}
      >
        <svg viewBox="0 0 16 16" aria-hidden className="h-5 w-5 fill-current">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        GitHub로 로그인
      </a>
      <ThemeToggle />
    </div>
  );
}
