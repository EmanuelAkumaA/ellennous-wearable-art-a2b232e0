import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface QueueProgressBarProps {
  total: number;
  done: number;
  failed: number;
  inProgress: number;
  onClearDone?: () => void;
  hasDone: boolean;
}

export const QueueProgressBar = ({
  total,
  done,
  failed,
  inProgress,
  onClearDone,
  hasDone,
}: QueueProgressBarProps) => {
  if (total === 0) return null;
  const pct = Math.round(((done + failed) / total) * 100);
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
      <Progress value={pct} className="h-1.5" />
    </div>
  );
};
