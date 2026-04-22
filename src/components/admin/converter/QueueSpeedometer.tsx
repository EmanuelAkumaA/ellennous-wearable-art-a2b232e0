import { useEffect, useState } from "react";
import { Zap, Timer } from "lucide-react";

interface QueueSpeedometerProps {
  /** Timestamps (ms since epoch) of items that have completed (done OR error). */
  completionTimes: number[];
  /** Number of items still to finish (queued + in progress). */
  remaining: number;
}

const formatEta = (sec: number): string => {
  if (!isFinite(sec) || sec <= 0) return "—";
  if (sec < 60) return `~ ${Math.round(sec)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (s === 0) return `~ ${m} min`;
  return `~ ${m} min ${s.toString().padStart(2, "0")} s`;
};

export const QueueSpeedometer = ({ completionTimes, remaining }: QueueSpeedometerProps) => {
  // Re-render every second so ETA decreases visibly while a long item is running.
  const [, force] = useState(0);
  useEffect(() => {
    if (remaining <= 0 || completionTimes.length === 0) return;
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [remaining, completionTimes.length]);

  if (completionTimes.length === 0) {
    return (
      <p className="text-[10px] font-accent tracking-[0.25em] uppercase text-muted-foreground/70">
        ⏱ aguardando primeira conclusão para estimar velocidade…
      </p>
    );
  }

  const first = completionTimes[0];
  const last = completionTimes[completionTimes.length - 1];
  const referenceNow = remaining > 0 ? Date.now() : last;
  const elapsedMs = Math.max(1, referenceNow - first);
  const itemsPerMin = (completionTimes.length / elapsedMs) * 60_000;
  const etaSec = remaining > 0 && itemsPerMin > 0 ? (remaining / itemsPerMin) * 60 : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-accent tracking-[0.25em] uppercase">
      <span className="flex items-center gap-1.5 text-primary-glow">
        <Zap className="h-3 w-3" />
        <span className="tabular-nums">{itemsPerMin.toFixed(1)}</span>
        <span className="text-muted-foreground">img/min</span>
      </span>
      {remaining > 0 && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Timer className="h-3 w-3" />
          <span className="tabular-nums">{formatEta(etaSec)}</span>
          <span className="opacity-70">restantes</span>
        </span>
      )}
      {remaining === 0 && (
        <span className="flex items-center gap-1.5 text-emerald-400/80">
          <Timer className="h-3 w-3" />
          <span>concluído</span>
        </span>
      )}
    </div>
  );
};
