import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppShell from "@/components/layout/AppShell";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

// Airbnb Cereal 의 가장 가까운 오픈 대체 서체. globals.css 의 --font-sans 가 이 변수를 쓴다.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Todo Planner",
  description: "할 일, 주간 계획, 1년 목표를 연결해 관리하는 앱",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 인라인 스크립트가 hydration 전에 dark 클래스를 바꾸므로 html 속성 불일치 경고를 끈다.
    <html lang="ko" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full bg-canvas text-ink">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
