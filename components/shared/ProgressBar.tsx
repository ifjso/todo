interface ProgressBarProps {
  value: number;
  label?: string;
  size?: "sm" | "md";
}

export default function ProgressBar({ value, label, size = "md" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label ?? "진행률"}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`flex-1 overflow-hidden rounded-full bg-surface-strong ${size === "sm" ? "h-1.5" : "h-2"}`}
      >
        <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-10 text-right text-sm font-semibold tabular-nums text-ink">{clamped}%</span>
    </div>
  );
}
