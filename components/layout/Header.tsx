"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

export const NAV_ITEMS = [
  { href: "/", label: "대시보드", icon: "◎" },
  { href: "/todos", label: "할 일", icon: "☑" },
  { href: "/weekly", label: "주간 계획", icon: "▦" },
  { href: "/goals", label: "1년 목표", icon: "★" },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 text-primary">
      <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-base font-bold text-on-primary">
        ✓
      </span>
      <span className="text-xl font-bold tracking-[-0.4px]">Todo Planner</span>
    </Link>
  );
}

/** 상단 내비게이션: 로고는 왼쪽, 탭은 가운데, 계정 도구는 오른쪽. 활성 탭은 잉크 밑줄로 표시한다. */
export default function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas">
      <div className="mx-auto grid h-16 max-w-[1280px] grid-cols-[1fr_auto] items-center gap-4 px-4 md:h-20 md:grid-cols-[1fr_auto_1fr] md:px-10">
        <Logo />
        <nav aria-label="주요 메뉴" className="hidden h-full items-stretch gap-8 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 border-b-2 text-base font-semibold transition-colors ${
                  active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <span aria-hidden className="text-lg">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-end gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
      {/* 모바일: 탭을 로고 아래 한 줄로 */}
      <nav aria-label="모바일 메뉴" className="flex border-t border-hairline-soft md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-xs font-semibold ${
                active ? "border-ink text-ink" : "border-transparent text-muted"
              }`}
            >
              <span aria-hidden className="text-base">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
