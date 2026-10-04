"use client";

import { useEffect } from "react";
import { useStore } from "@/store";

/** 로그인 사용자 아바타·이름과 로그아웃 버튼. compact 는 모바일 헤더용. */
export default function UserMenu({ compact = false }: { compact?: boolean }) {
  const me = useStore((s) => s.me);
  const fetchMe = useStore((s) => s.fetchMe);

  useEffect(() => {
    if (!me) void fetchMe().catch(() => {});
  }, [me, fetchMe]);

  return (
    <div data-testid="user-menu" className="flex min-w-0 items-center gap-2">
      {me && (
        <>
          {/* GitHub 아바타는 외부 URL 이고 크기가 작아 이미지 최적화가 필요 없다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={me.avatarUrl}
            alt={`${me.username} 아바타`}
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 rounded-full bg-slate-200 dark:bg-neutral-800"
          />
          <span
            data-testid="user-name"
            className={`min-w-0 truncate text-sm font-medium text-slate-700 dark:text-neutral-300 ${compact ? "sr-only" : ""}`}
          >
            {me.username}
          </span>
        </>
      )}
      {/* 세션 삭제는 서버에서 처리하고 /login 으로 303 리다이렉트된다. */}
      <form action="/auth/logout" method="post" className={compact ? "" : "ml-auto"}>
        <button
          type="submit"
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
