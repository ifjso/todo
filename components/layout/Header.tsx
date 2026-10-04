"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV_ITEMS } from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

export default function Header() {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) => isActive(pathname, item.href));
  return (
    <header className="border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-black">
      <div className="flex h-14 items-center justify-between px-4 md:px-8">
        <span className="font-bold text-slate-900 dark:text-neutral-100 md:hidden">Todo Planner</span>
        <span className="hidden text-sm font-medium text-slate-500 dark:text-neutral-400 md:block">{current?.label}</span>
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <UserMenu compact />
        </div>
      </div>
      {/* 모바일: 사이드바 대신 상단 탭 */}
      <nav aria-label="모바일 메뉴" className="flex border-t border-slate-100 dark:border-neutral-800 md:hidden">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={`flex-1 py-2 text-center text-xs font-medium ${
              isActive(pathname, item.href) ? "border-b-2 border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300" : "text-slate-500 dark:text-neutral-400"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
