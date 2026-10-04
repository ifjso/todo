import { PRIORITY_LABEL } from "@/lib/todoSort";
import type { Priority } from "@/types";

const STYLE: Record<Priority, string> = {
  high: "bg-primary-soft text-primary-active dark:text-primary",
  medium: "bg-surface-strong text-ink",
  low: "bg-surface-soft text-muted",
};

export default function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      data-priority={priority}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-[1.18] ${STYLE[priority]}`}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
