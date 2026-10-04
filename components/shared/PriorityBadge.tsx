import { PRIORITY_LABEL } from "@/lib/todoSort";
import type { Priority } from "@/types";

const STYLE: Record<Priority, string> = {
  high: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300",
  medium: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300",
  low: "bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400",
};

export default function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      data-priority={priority}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${STYLE[priority]}`}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
