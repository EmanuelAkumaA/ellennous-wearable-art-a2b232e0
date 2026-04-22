import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ImageIcon,
  Play,
  RefreshCw,
  ExternalLink,
  X,
  Timer,
  Gauge,
  TrendingDown,
  Activity,
  Hourglass,
  Eraser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes, type OptimizedVariant } from "@/lib/imageSnippet";
import {
  detectLegacyImages,
  runBackfill,
  type BackfillProgressItem,
  type LegacyImageItem,
} from "@/lib/optimizerBackfill";

const STATUS_LABEL: Record<BackfillProgressItem["status"], string> = {
  pending: "Pendente",
  downloading: "Baixando",
  uploading: "Enviando",
  optimizing: "Otimizando",
  done: "Pronta",
  skipped: "Já otimizada",
  error: "Erro",
};

const STATUS_TONE: Record<BackfillProgressItem["status"], string> = {
  pending: "text-muted-foreground",
  downloading: "text-primary-glow",
  uploading: "text-primary-glow",
  optimizing: "text-primary-glow",
  done: "text-emerald-400",
  skipped: "text-muted-foreground",
  error: "text-destructive",
};

const ACTIVE_STATUSES: BackfillProgressItem["status"][] = ["downloading", "uploading", "optimizing"];

export const BackfillRunner = () => {
  const [items, setItems] = useState<BackfillProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const detect = async () => {
    setLoading(true);
    try {
      const detected = await detectLegacyImages();
      setItems(detected.map((d) => ({ ...d, status: "pending" as const, progress: 0 })));
      setShowSuccess(false);
    } catch (e) {
      toast({
        title: "Erro ao detectar imagens",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    detect();
  }, []);

  const updateItem = (id: string, patch: Partial<BackfillProgressItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const start = async () => {
    if (running) return;
    const pending = items.filter((i) => i.status === "pending" || i.status === "error");
    if (pending.length === 0) {
      toast({ title: "Nada a fazer", description: "Todas as imagens já estão otimizadas." });
      return;
    }
    setRunning(true);
    setShowSuccess(false);
    pending.forEach((p) => updateItem(p.id, { status: "pending", error: undefined, progress: 0 }));

    const legacy: LegacyImageItem[] = pending.map(
      ({ id, kind, pieceId, pieceName, url, storagePath, filename }) => ({
        id,
        kind,
        pieceId,
        pieceName,
        url,
        storagePath,
        filename,
      }),
    );

    const { done, failed } = await runBackfill(legacy, updateItem, 2);
    setRunning(false);

    if (failed === 0 && done > 0) {
      setShowSuccess(true);
      sonnerToast.success("Tudo otimizado!", {
        description: `${done} imagem(ns) migrada(s) para o pipeline AVIF/WebP.`,
        duration: 6000,
      });
    } else {
      toast({
        title: `Backfill concluído`,
        description: `${done} otimizada(s)${failed ? `, ${failed} falha(s)` : ""}.`,
        variant: failed > 0 && done === 0 ? "destructive" : "default",
      });
    }
  };

  const stats = useMemo(() => {
    const total = items.length;
    const doneCount = items.filter((i) => i.status === "done").length;
    const errorCount = items.filter((i) => i.status === "error").length;
    const pendingCount = items.filter((i) => i.status === "pending").length;
    const avgProgress =
      total > 0
        ? Math.round(
            items.reduce((acc, it) => {
              if (it.status === "done") return acc + 100;
              if (it.status === "error") return acc + 100; // count as resolved
              return acc + (it.progress || 0);
            }, 0) / total,
          )
        : 0;
    return { total, done: doneCount, error: errorCount, pending: pendingCount, avgProgress };
  }, [items]);

  return (
    <div className="space-y-6">
      {showSuccess ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 mt-0.5 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-display text-base text-foreground">Tudo otimizado!</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
              As {stats.done} imagens da galeria foram migradas para o pipeline. Recarregue o site público
              para ver os novos formatos AVIF/WebP em ação.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => window.open("/", "_blank")}
                className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px] bg-emerald-500/90 hover:bg-emerald-500 text-emerald-950"
              >
                <ExternalLink className="h-3 w-3 mr-1.5" /> Abrir galeria
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSuccess(false)}
                className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px]"
              >
                <X className="h-3 w-3 mr-1.5" /> Dispensar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3">
          <Sparkles className="h-4 w-4 mt-0.5 text-primary-glow shrink-0" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            Esta tela detecta imagens já existentes no site que <strong className="text-foreground">não foram processadas pelo Otimizador</strong>.
            Ao rodar, cada imagem é baixada, reenviada pelo pipeline (AVIF / WebP / JPG em 4 larguras) e o link da galeria
            é atualizado para servir a versão otimizada. Os arquivos originais permanecem intocados como fallback.
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Detectadas" value={String(stats.total)} />
        <Stat label="Otimizadas" value={`${stats.done}/${stats.total}`} highlight={stats.done > 0} />
        <Stat label="Pendentes" value={String(stats.pending)} />
        <Stat label="Erros" value={String(stats.error)} tone={stats.error > 0 ? "destructive" : "muted"} />
      </div>

      {/* Progress bar (weighted) */}
      {stats.total > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-accent tracking-[0.3em] uppercase text-muted-foreground">
            <span>Progresso</span>
            <span>{stats.avgProgress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
            <div
              className="h-full bg-primary-glow transition-all duration-300"
              style={{ width: `${stats.avgProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={start}
          disabled={running || loading || items.length === 0}
          className="rounded-none font-accent tracking-[0.2em] uppercase text-xs bg-gradient-purple-wine hover:opacity-90 shadow-glow"
        >
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Otimizar todas ({stats.pending + stats.error})
        </Button>
        <Button
          variant="outline"
          onClick={detect}
          disabled={running || loading}
          className="rounded-none font-accent tracking-[0.2em] uppercase text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Re-detectar
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-12 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
          <p className="text-sm text-foreground">Tudo otimizado!</p>
          <p className="text-xs text-muted-foreground mt-1">
            Não há imagens antigas pendentes. Novos uploads já passam automaticamente pelo Otimizador.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <BackfillRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

const BackfillRow = ({ item }: { item: BackfillProgressItem }) => {
  const Icon =
    item.status === "done"
      ? CheckCircle2
      : item.status === "error"
        ? AlertCircle
        : item.status === "pending"
          ? ImageIcon
          : Loader2;
  const animate = ACTIVE_STATUSES.includes(item.status);
  const showBar = animate || item.status === "done";
  const barPct = item.status === "done" ? 100 : item.progress || 0;
  const barColor =
    item.status === "done"
      ? "bg-emerald-400"
      : item.status === "error"
        ? "bg-destructive"
        : "bg-primary-glow";

  return (
    <div className="rounded-lg border border-border/40 bg-card/40 backdrop-blur p-3 flex items-center gap-3">
      <div className="relative h-12 w-12 shrink-0 rounded-md overflow-hidden bg-secondary/30">
        <img
          src={item.url}
          alt={item.filename}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate font-medium" title={item.filename}>
          {item.filename}
        </p>
        <p className="text-[10px] text-muted-foreground/80 truncate">
          <span className="font-accent tracking-[0.2em] uppercase">
            {item.kind === "cover" ? "Capa" : "Galeria"}
          </span>
          {" · "}
          {item.pieceName}
        </p>

        {showBar && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-secondary/40 overflow-hidden">
              <div
                className={`h-full ${barColor} transition-all duration-300`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            <span
              className={`text-[9px] font-accent tracking-[0.2em] uppercase shrink-0 ${
                item.status === "done" ? "text-emerald-400" : "text-muted-foreground"
              }`}
            >
              {item.status === "done"
                ? "100% · concluída"
                : `${STATUS_LABEL[item.status]} ${barPct}%`}
            </span>
          </div>
        )}

        {item.error && (
          <p className="text-[10px] text-destructive truncate mt-0.5" title={item.error}>
            {item.error}
          </p>
        )}
      </div>
      <div
        className={`inline-flex items-center gap-1.5 text-[10px] font-accent tracking-[0.25em] uppercase shrink-0 ${STATUS_TONE[item.status]}`}
      >
        <Icon className={`h-3.5 w-3.5 ${animate ? "animate-spin" : ""}`} />
        {STATUS_LABEL[item.status]}
      </div>
    </div>
  );
};

const Stat = ({
  label,
  value,
  highlight,
  tone = "default",
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "default" | "muted" | "destructive";
}) => (
  <div
    className={`rounded-lg border px-4 py-3 ${
      tone === "destructive"
        ? "border-destructive/40 bg-destructive/10"
        : highlight
          ? "border-primary/40 bg-primary/10"
          : "border-border/40 bg-card/40"
    }`}
  >
    <p className="font-accent text-[9px] tracking-[0.3em] uppercase text-muted-foreground">{label}</p>
    <p
      className={`font-display text-xl mt-1 ${
        tone === "destructive" ? "text-destructive" : highlight ? "text-primary-glow" : ""
      }`}
    >
      {value}
    </p>
  </div>
);

export default BackfillRunner;
