import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { QueueSpeedometer } from "./QueueSpeedometer";

interface QueueProgressBarProps {
  total: number;
  done: number;
  failed: number;
  inProgress: number;
  /** Per-item progress (0–100). Allows weighted % across the queue. */
  itemProgress?: Record<string, number>;
  /** Timestamps of completed items (done OR error), used for speed/ETA. */
  completionTimes?: number[];
  onClearDone?: () => void;
  hasDone: boolean;
}

export const QueueProgressBar = ({
  total,
  done,
  failed,
  inProgress,
  itemProgress,
  completionTimes = [],
  onClearDone,
  hasDone,
}: QueueProgressBarProps) => {
  if (total === 0) return null;

  // Weighted percent: every item is 1 unit. Done/failed = 100%, queued = 0%,
  // in-progress contributes its real progress. Falls back to coarse %.
  let weightedPct: number;
  if (itemProgress) {
    const sum = Object.values(itemProgress).reduce((acc, v) => acc + Math.max(0, Math.min(100, v)), 0);
    // Items that are not in itemProgress (likely queued) contribute 0; done/failed should be 100.
    const accountedIds = Object.keys(itemProgress).length;
    const finished = done + failed;
    const finishedNotTracked = Math.max(0, finished - 0); // finished items reach 100 via setProgress(100); they remain in itemProgress
    // Defensive: if a finished item somehow isn't tracked, count it as 100.
    const missingFinished = Math.max(0, finished - accountedIds);
    weightedPct = Math.round((sum + missingFinished * 100 + finishedNotTracked * 0) / total);
    weightedPct = Math.max(0, Math.min(100, weightedPct));
  } else {
    weightedPct = Math.round(((done + failed) / total) * 100);
  }

  const remaining = total - done - failed;

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Progresso da fila
          </span>
          <span className="font-display text-base text-gradient-light">
            {done + failed} <span className="text-muted-foreground">de {total}</span>
          </span>
          <span className="font-display text-sm text-primary-glow tabular-nums">{weightedPct}%</span>
          {inProgress > 0 && (
            <span className="text-[10px] font-accent tracking-[0.25em] uppercase text-primary-glow">
              · {inProgress} em andamento
            </span>
          )}
          {failed > 0 && (
            <span className="text-[10px] font-accent tracking-[0.25em] uppercase text-destructive">
              · {failed} {failed === 1 ? "falha" : "falhas"}
            </span>
          )}
        </div>
        {hasDone && onClearDone && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearDone}
            className="rounded-none font-accent tracking-[0.25em] uppercase text-[10px] hover:text-destructive"
          >
            <Trash2 className="h-3 w-3 mr-1" /> Limpar concluídos
          </Button>
        )}
      </div>
      <Progress value={weightedPct} className="h-1.5" />
      <QueueSpeedometer completionTimes={completionTimes} remaining={remaining} />
    </div>
  );
};
