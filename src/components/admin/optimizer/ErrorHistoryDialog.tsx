import { useEffect, useState } from "react";
import { AlertCircle, Copy, RefreshCw, Loader2, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type ErrorLogEntry = {
  id: string;
  optimized_image_id: string;
  piece_id: string | null;
  stage: string;
  error_message: string;
  meta: Record<string, unknown>;
  created_at: string;
};

interface ErrorHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Filter by single image. Pass null when filtering by piece. */
  optimizedImageId?: string | null;
  /** Filter by piece (aggregated). */
  pieceId?: string | null;
  /** Display title (e.g. filename or piece name). */
  title: string;
  /** Latest in-session error not yet persisted (shown at top). */
  sessionError?: { stage: string; message: string } | null;
  /** Optional reprocess callback. */
  onReprocess?: () => Promise<void> | void;
}

const STAGE_LABEL: Record<string, string> = {
  download: "Download",
  upload: "Upload",
  optimize: "Otimização",
  optimizing: "Otimização",
  processing: "Processamento (servidor)",
  persist: "Persistência",
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
};

export const ErrorHistoryDialog = ({
  open,
  onOpenChange,
  optimizedImageId,
  pieceId,
  title,
  sessionError,
  onReprocess,
}: ErrorHistoryDialogProps) => {
  const [entries, setEntries] = useState<ErrorLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      let query = supabase
        .from("optimization_error_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (optimizedImageId) query = query.eq("optimized_image_id", optimizedImageId);
      else if (pieceId) query = query.eq("piece_id", pieceId);
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        toast({
          title: "Erro ao carregar histórico",
          description: error.message,
          variant: "destructive",
        });
        setEntries([]);
      } else {
        setEntries((data ?? []) as ErrorLogEntry[]);
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, optimizedImageId, pieceId]);

  const handleCopy = () => {
    const payload = {
      title,
      optimizedImageId,
      pieceId,
      sessionError,
      entries,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast({ title: "Log copiado para a área de transferência" });
  };

  const handleReprocess = async () => {
    if (!onReprocess) return;
    setReprocessing(true);
    try {
      await onReprocess();
      onOpenChange(false);
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <AlertCircle className="h-4 w-4 text-destructive" />
            Histórico de erros
          </DialogTitle>
          <DialogDescription className="text-xs">
            <span className="text-foreground font-medium">{title}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
          {sessionError && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-accent text-[9px] tracking-[0.25em] uppercase text-amber-300">
                  Sessão atual · {STAGE_LABEL[sessionError.stage] ?? sessionError.stage}
                </span>
                <span className="text-[10px] text-muted-foreground">agora</span>
              </div>
              <p className="text-xs text-foreground break-words">{sessionError.message}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-xs">Carregando histórico…</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/40 p-6 text-center">
              <p className="text-xs text-muted-foreground">
                {sessionError
                  ? "Nenhum erro anterior persistido para esta imagem."
                  : "Sem registros de erro para esta imagem."}
              </p>
            </div>
          ) : (
            entries.map((e) => (
              <div
                key={e.id}
                className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-accent text-[9px] tracking-[0.25em] uppercase text-destructive">
                    {STAGE_LABEL[e.stage] ?? e.stage}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" /> {formatDate(e.created_at)}
                  </span>
                </div>
                <p className="text-xs text-foreground break-words">{e.error_message}</p>
                {e.meta && Object.keys(e.meta).length > 0 && (
                  <details className="mt-1">
                    <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                      Metadados
                    </summary>
                    <pre className="mt-1 text-[10px] text-muted-foreground/80 bg-secondary/30 p-2 rounded overflow-x-auto">
                      {JSON.stringify(e.meta, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
          {onReprocess && (
            <Button
              size="sm"
              onClick={handleReprocess}
              disabled={reprocessing}
              className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px]"
            >
              {reprocessing ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1.5" />
              )}
              Reprocessar agora
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px]"
          >
            <Copy className="h-3 w-3 mr-1.5" /> Copiar log
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px] ml-auto"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
