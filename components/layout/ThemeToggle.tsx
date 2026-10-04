"use client";

import { useSyncExternalStore } from "react";
import {
  readThemePreference,
  setThemePreference,
  subscribeTheme,
  THEME_PREFERENCES,
  type ThemePreference,
} from "@/lib/theme";

const LABEL: Record<ThemePreference, string> = { system: "시스템", light: "라이트", dark: "다크" };
const ICON: Record<ThemePreference, string> = { system: "◐", light: "☀", dark: "☾" };

export default function ThemeToggle({ className = "" }: { className?: string }) {
  // 서버 렌더에서는 저장값을 알 수 없으므로 system 으로 그린 뒤 클라이언트에서 맞춘다.
  const preference = useSyncExternalStore(subscribeTheme, readThemePreference, () => "system" as const);
  const next = THEME_PREFERENCES[(THEME_PREFERENCES.indexOf(preference) + 1) % THEME_PREFERENCES.length];

  return (
    <button
      type="button"
      onClick={() => setThemePreference(next)}
      aria-label={`테마: ${LABEL[preference]} (눌러서 ${LABEL[next]}로 변경)`}
      data-theme-preference={preference}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 ${className}`}
    >
      <span aria-hidden>{ICON[preference]}</span>
      <span>{LABEL[preference]}</span>
    </button>
  );
}
