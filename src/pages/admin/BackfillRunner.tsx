import { type ComponentType, useEffect, useMemo, useRef, useState } from "react";
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

  // Live stats
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [runEndedAt, setRunEndedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [bytesOriginal, setBytesOriginal] = useState(0);
  const [bytesOptimized, setBytesOptimized] = useState(0);
  const timingsRef = useRef<Map<string, { start: number; end?: number }>>(new Map());
  const completedTimingsRef = useRef<number[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Tick every second while running so the elapsed timer stays live.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

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

  /** Wraps updateItem to capture per-image start/end timings + bytes saved. */
  const trackedUpdate = (id: string, patch: Partial<BackfillProgressItem>) => {
    const m = timingsRef.current;
    if (patch.status === "downloading" && !m.has(id)) {
      m.set(id, { start: Date.now() });
    }
    if (patch.status === "done" || patch.status === "error") {
      const t = m.get(id);
      if (t && t.end == null) {
        t.end = Date.now();
        completedTimingsRef.current.push(t.end - t.start);
      }
      if (patch.status === "done") {
        setCompletedCount((c) => c + 1);
        // Fire-and-forget: read original/optimized sizes for byte savings.
        const optId = patch.optimizedImageId;
        if (optId) {
          supabase
            .from("optimized_images")
            .select("original_size_bytes, variants")
            .eq("id", optId)
            .maybeSingle()
            .then(({ data }) => {
              if (!data) return;
              const variants = (data.variants as unknown as OptimizedVariant[]) ?? [];
              const tablet =
                variants.find((v) => v.format === "webp" && v.device_label === "tablet") ??
                variants.find((v) => v.format === "webp") ??
                variants[0];
              setBytesOriginal((b) => b + (data.original_size_bytes ?? 0));
              setBytesOptimized((b) => b + (tablet?.size_bytes ?? 0));
            });
        }
      } else {
        setFailedCount((c) => c + 1);
      }
    }
    updateItem(id, patch);
  };

  const start = async () => {
    if (running) return;
    const pending = items.filter((i) => i.status === "pending" || i.status === "error");
    if (pending.length === 0) {
      toast({ title: "Nada a fazer", description: "Todas as imagens já estão otimizadas." });
      return;
    }
    // Reset live stats for this run
    timingsRef.current = new Map();
    completedTimingsRef.current = [];
    setCompletedCount(0);
    setFailedCount(0);
    setBytesOriginal(0);
    setBytesOptimized(0);
    setRunStartedAt(Date.now());
    setRunEndedAt(null);
    setNow(Date.now());

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

    const { done, failed } = await runBackfill(legacy, trackedUpdate, 4);
    setRunning(false);
    setRunEndedAt(Date.now());

    if (failed === 0 && done > 0) {
      setShowSuccess(true);
      sonnerToast.success("Tudo otimizado!", {
        description: `${done} imagem(ns) migrada(s) para o pipeline WebP.`,
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

  const clearStats = () => {
    timingsRef.current = new Map();
    completedTimingsRef.current = [];
    setCompletedCount(0);
    setFailedCount(0);
    setBytesOriginal(0);
    setBytesOptimized(0);
    setRunStartedAt(null);
    setRunEndedAt(null);
  };

  const liveStats = useMemo(() => {
    const elapsedMs = runStartedAt ? (runEndedAt ?? now) - runStartedAt : 0;
    const timings = completedTimingsRef.current;
    const avgMs = timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length : 0;
    const totalResolved = completedCount + failedCount;
    const successRate = totalResolved > 0 ? Math.round((completedCount / totalResolved) * 100) : 100;
    const elapsedMin = elapsedMs / 60000;
    const imgsPerMin = elapsedMin > 0 ? completedCount / elapsedMin : 0;
    const pendingItems = items.filter((i) => i.status !== "done" && i.status !== "error" && i.status !== "skipped").length;
    const etaMs = avgMs > 0 ? Math.max(0, pendingItems * avgMs) : 0;
    const bytesSaved = Math.max(0, bytesOriginal - bytesOptimized);
    return {
      elapsedMs,
      avgMs,
      successRate,
      imgsPerMin,
      etaMs,
      bytesSaved,
      hasData: runStartedAt !== null,
    };
  }, [runStartedAt, runEndedAt, now, completedCount, failedCount, items, bytesOriginal, bytesOptimized]);

  const formatDuration = (ms: number): string => {
    if (!ms || ms < 0) return "00:00";
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
    const s = (totalSec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
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

      {/* Live stats panel — visible during and after a run */}
      {liveStats.hasData && (
        <div className="rounded-lg border border-border/40 bg-card/40 backdrop-blur p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-primary-glow" />
              <p className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                {running ? "Estatísticas em tempo real" : "Estatísticas do último run"}
              </p>
            </div>
            {!running && (
              <button
                type="button"
                onClick={clearStats}
                className="inline-flex items-center gap-1 text-[10px] font-accent tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                <Eraser className="h-3 w-3" /> Limpar
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <LiveStat
              icon={Timer}
              label="Decorrido"
              value={formatDuration(liveStats.elapsedMs)}
              tone="primary"
            />
            <LiveStat
              icon={Gauge}
              label="Tempo médio"
              value={liveStats.avgMs > 0 ? `${(liveStats.avgMs / 1000).toFixed(1)}s` : "—"}
              tone="primary"
            />
            <LiveStat
              icon={CheckCircle2}
              label="Sucesso"
              value={`${liveStats.successRate}%`}
              tone={
                liveStats.successRate >= 95
                  ? "success"
                  : liveStats.successRate >= 80
                    ? "warning"
                    : "destructive"
              }
            />
            <LiveStat
              icon={Activity}
              label="Img/min"
              value={liveStats.imgsPerMin > 0 ? liveStats.imgsPerMin.toFixed(1) : "—"}
              tone="primary"
            />
            <LiveStat
              icon={Hourglass}
              label="ETA"
              value={running && liveStats.etaMs > 0 ? formatDuration(liveStats.etaMs) : "—"}
              tone="default"
            />
            <LiveStat
              icon={TrendingDown}
              label="Economizado"
              value={liveStats.bytesSaved > 0 ? formatBytes(liveStats.bytesSaved) : "—"}
              tone="success"
            />
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

type LiveStatTone = "default" | "primary" | "success" | "warning" | "destructive";

const TONE_CLASSES: Record<LiveStatTone, { border: string; bg: string; icon: string; value: string }> = {
  default: {
    border: "border-border/40",
    bg: "bg-card/30",
    icon: "text-muted-foreground",
    value: "text-foreground",
  },
  primary: {
    border: "border-primary/30",
    bg: "bg-primary/5",
    icon: "text-primary-glow",
    value: "text-primary-glow",
  },
  success: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    icon: "text-emerald-400",
    value: "text-emerald-400",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    icon: "text-amber-400",
    value: "text-amber-400",
  },
  destructive: {
    border: "border-destructive/40",
    bg: "bg-destructive/10",
    icon: "text-destructive",
    value: "text-destructive",
  },
};

const LiveStat = ({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: LiveStatTone;
}) => {
  const t = TONE_CLASSES[tone];
  return (
    <div className={`rounded-md border ${t.border} ${t.bg} px-3 py-2.5`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${t.icon}`} />
        <p className="font-accent text-[8px] tracking-[0.25em] uppercase text-muted-foreground truncate">
          {label}
        </p>
      </div>
      <p className={`font-display text-base mt-0.5 tabular-nums ${t.value}`}>{value}</p>
    </div>
  );
};

export default BackfillRunner;
