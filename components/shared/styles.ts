// 디자인 토큰(app/globals.css)을 조합한 공용 클래스. 색은 모두 토큰 유틸리티로만 지정한다.

export const inputClass =
  "min-h-12 w-full rounded-sm border border-hairline bg-canvas px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-muted-soft";

export const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-ink";

/** Rausch 채움 · 흰 글자 · 8px 라운드 · 48px 높이 */
export const primaryButtonClass =
  "inline-flex h-12 shrink-0 items-center justify-center rounded-sm bg-primary px-6 text-base font-medium text-on-primary transition-colors hover:bg-primary-active active:bg-primary-active disabled:cursor-not-allowed disabled:bg-primary-disabled";

/** 흰 바탕 · 잉크 테두리 */
export const secondaryButtonClass =
  "inline-flex shrink-0 items-center justify-center rounded-sm border border-ink bg-canvas px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:border-border-strong disabled:text-muted-soft";

/** 배경·테두리 없는 텍스트 버튼, hover 시 밑줄 */
export const tertiaryButtonClass =
  "inline-flex shrink-0 items-center justify-center rounded-sm px-3 py-2 text-sm font-medium text-ink underline-offset-4 hover:underline";

export const dangerButtonClass =
  "inline-flex shrink-0 items-center justify-center rounded-sm px-3 py-2 text-sm font-medium text-error underline-offset-4 hover:text-error-hover hover:underline";

/** 원형 아이콘 버튼 (닫기, 삭제 등) */
export const iconButtonClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink";

export const linkClass = "font-medium text-ink underline underline-offset-4 hover:text-primary";

export const cardClass = "min-w-0 rounded-md border border-hairline bg-canvas p-6";

export const pageTitleClass = "text-[28px] font-bold leading-[1.43] text-ink";

export const sectionTitleClass = "text-xl font-semibold tracking-[-0.18px] text-ink";

export const errorTextClass = "text-sm text-error";

export const emptyStateClass = "rounded-md border border-dashed border-hairline p-10 text-center text-sm text-muted";
