import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Todo Planner",
  description: "할 일, 주간 계획, 1년 목표를 연결해 관리하는 앱",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 인라인 스크립트가 hydration 전에 dark 클래스를 바꾸므로 html 속성 불일치 경고를 끈다.
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full bg-slate-50 text-slate-900 dark:bg-black dark:text-neutral-100">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
