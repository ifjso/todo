"use client";

import { useEffect } from "react";
import { useStore } from "@/store";

/** 로그인 사용자 아바타·이름과 로그아웃 버튼을 담은 알약 모양 계정 메뉴. 좁은 화면에서는 이름을 숨긴다. */
export default function UserMenu() {
  const me = useStore((s) => s.me);
  const fetchMe = useStore((s) => s.fetchMe);

  useEffect(() => {
    if (!me) void fetchMe().catch(() => {});
  }, [me, fetchMe]);

  return (
    <div
      data-testid="user-menu"
      className="flex min-w-0 items-center gap-2 rounded-full border border-hairline bg-canvas py-1 pl-1 pr-1 transition-shadow hover:shadow-float"
    >
      {me && (
        <>
          {/* GitHub 아바타는 외부 URL 이고 크기가 작아 이미지 최적화가 필요 없다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={me.avatarUrl}
            alt={`${me.username} 아바타`}
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-full bg-surface-strong"
          />
          <span data-testid="user-name" className="max-w-32 truncate text-sm font-medium text-ink max-sm:sr-only">
            {me.username}
          </span>
        </>
      )}
      {/* 세션 삭제는 서버에서 처리하고 /login 으로 303 리다이렉트된다. */}
      <form action="/auth/logout" method="post">
        <button
          type="submit"
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-soft hover:text-ink"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
