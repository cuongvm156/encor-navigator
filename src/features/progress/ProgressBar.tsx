import { toPercent } from "./weights";

export function ProgressBar({ ratio, label }: { ratio: number; label?: string }) {
  const pct = toPercent(ratio);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label ?? "Progress"}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
