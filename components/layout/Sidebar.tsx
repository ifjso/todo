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

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 dark:border-neutral-800 bg-white dark:bg-black md:flex">
      <div className="px-5 py-5 text-lg font-bold text-slate-900 dark:text-neutral-100">Todo Planner</div>
      <nav aria-label="주요 메뉴" className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive(pathname, item.href)
                ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                : "text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-neutral-100"
            }`}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2 border-t border-slate-200 px-3 py-4 dark:border-neutral-800">
        <div className="px-3">
          <UserMenu />
        </div>
        <ThemeToggle className="w-full" />
      </div>
    </aside>
  );
}
