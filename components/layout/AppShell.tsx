"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";

/** 로그인 페이지는 내비게이션 없이 가운데 정렬로, 나머지는 상단 내비게이션과 함께 그린다. */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <main className="flex min-h-full flex-1 items-center justify-center px-4 py-10">{children}</main>;
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 md:px-10 md:py-12">{children}</main>
    </div>
  );
}
