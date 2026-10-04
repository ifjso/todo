interface ProgressBarProps {
  value: number;
  label?: string;
  size?: "sm" | "md";
}

export default function ProgressBar({ value, label, size = "md" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label={label ?? "진행률"}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-700 ${size === "sm" ? "h-1.5" : "h-2.5"}`}
      >
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-semibold tabular-nums text-slate-600 dark:text-neutral-400">{clamped}%</span>
    </div>
  );
}
