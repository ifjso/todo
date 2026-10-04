"use client";

import dynamic from "next/dynamic";

// dnd-kit 보드는 하이드레이션 불일치를 피하기 위해 클라이언트에서만 렌더한다.
const KanbanBoard = dynamic(() => import("@/components/todos/KanbanBoard"), {
  ssr: false,
  loading: () => <p className="text-sm text-slate-400 dark:text-neutral-500">보드를 불러오는 중…</p>,
});

export default function Page() {
  return <KanbanBoard />;
}
