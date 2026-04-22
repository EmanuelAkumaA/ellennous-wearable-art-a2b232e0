import { type ComponentType, memo, useEffect, useMemo, useRef, useState } from "react";
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
  ChevronDown,
  ChevronRight,
  Circle,
  Smartphone,
  Tablet,
  Monitor,
} from "lucide-react";
import { ErrorHistoryDialog } from "@/components/admin/optimizer/ErrorHistoryDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes, type OptimizedVariant } from "@/lib/imageSnippet";
import { runWithLock } from "@/lib/runtimeLock";
import {
  detectLegacyImages,
  runBackfill,
  type BackfillProgressItem,
  type LegacyImageItem,
} from "@/lib/optimizerBackfill";

const STATUS_LABEL: Record<BackfillProgressItem["status"], string> = {
  pending: "Pendente",
  downloading: "Baixando",
  converting: "Convertendo WebP",
  uploading: "Enviando",
  optimizing: "Otimizando",
  done: "Pronta",
  skipped: "Já otimizada",
  error: "Erro",
};

const STATUS_TONE: Record<BackfillProgressItem["status"], string> = {
  pending: "text-muted-foreground",
  downloading: "text-primary-glow",
  converting: "text-blue-400",
  uploading: "text-primary-glow",
  optimizing: "text-primary-glow",
  done: "text-emerald-400",
  skipped: "text-muted-foreground",
  error: "text-destructive",
};

const ACTIVE_STATUSES: BackfillProgressItem["status"][] = ["downloading", "converting", "uploading", "optimizing"];

export const BackfillRunner = () => {
  const [items, setItems] = useState<BackfillProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  // Synchronous double-click guard.
  const startingRef = useRef(false);

  // Tick every second while running, but only when the tab is visible — keeps
  // the elapsed timer live without burning CPU on a hidden tab.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      setNow((n) => (n === 0 ? Date.now() : n + 1000));
    }, 1000);
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
    if (startingRef.current) return;
    startingRef.current = true;

    // Eligible = pending OR error AND (selection is non-empty ? in selection : all)
    const eligible = items.filter((i) => i.status === "pending" || i.status === "error");
    const target = selected.size > 0
      ? eligible.filter((i) => selected.has(i.id))
      : eligible;
    if (target.length === 0) {
      startingRef.current = false;
      toast({
        title: "Nada a fazer",
        description: selected.size > 0
          ? "Nenhuma das imagens selecionadas está pendente."
          : "Todas as imagens já estão otimizadas.",
      });
      return;
    }

    const lockResult = await runWithLock("optimizer:backfill", async () => {
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
      target.forEach((p) => updateItem(p.id, { status: "pending", error: undefined, progress: 0 }));

      const legacy: LegacyImageItem[] = target.map(
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

      try {
        const { done, failed } = await runBackfill(legacy, trackedUpdate, 4);
        setRunEndedAt(Date.now());
        setSelected(new Set());

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
      } finally {
        setRunning(false);
      }
    });

    startingRef.current = false;

    if (!lockResult.acquired) {
      sonnerToast.warning("Outro backfill já está em andamento.", {
        description: lockResult.fallback
          ? "Aguarde o término da execução em andamento nesta aba."
          : "Aguarde o término — pode estar em outra aba.",
        duration: 4000,
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

  // Group items by piece (obra) for the new grouped UI.
  const groups = useMemo(() => {
    const map = new Map<string, { pieceId: string; pieceName: string; items: BackfillProgressItem[] }>();
    for (const it of items) {
      const g = map.get(it.pieceId);
      if (g) g.items.push(it);
      else map.set(it.pieceId, { pieceId: it.pieceId, pieceName: it.pieceName, items: [it] });
    }
    return Array.from(map.values()).sort((a, b) => a.pieceName.localeCompare(b.pieceName));
  }, [items]);

  // Auto-collapse groups whose items are all done (only on first load / fresh detect).
  useEffect(() => {
    if (loading) return;
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      for (const g of groups) {
        const allDone = g.items.length > 0 && g.items.every((i) => i.status === "done");
        if (allDone && !next.has(g.pieceId)) next.add(g.pieceId);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, items.length]);

  const toggleGroup = (pieceId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(pieceId)) next.delete(pieceId);
      else next.add(pieceId);
      return next;
    });
  };

  const isPickable = (it: BackfillProgressItem) =>
    it.status === "pending" || it.status === "error";

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePieceSelection = (pieceId: string) => {
    const group = groups.find((g) => g.pieceId === pieceId);
    if (!group) return;
    const eligibleIds = group.items.filter(isPickable).map((i) => i.id);
    if (eligibleIds.length === 0) return;
    const allSelected = eligibleIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) eligibleIds.forEach((id) => next.delete(id));
      else eligibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectAllPending = () => {
    const ids = items.filter(isPickable).map((i) => i.id);
    setSelected(new Set(ids));
  };
  const selectAtRisk = () => {
    // No backfill, "em risco" = pending + error (mesmo conceito que isPickable hoje).
    const ids = items.filter((i) => i.status === "pending" || i.status === "error").map((i) => i.id);
    setSelected(new Set(ids));
  };
  const clearSelection = () => setSelected(new Set());

  const totalPending = items.filter(isPickable).length;
  const atRiskCount = items.filter((i) => i.status === "pending" || i.status === "error").length;
  const selectionEligibleCount = items.filter((i) => selected.has(i.id) && isPickable(i)).length;

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
          disabled={running || loading || totalPending === 0}
          className="rounded-none font-accent tracking-[0.2em] uppercase text-xs bg-gradient-purple-wine hover:opacity-90 shadow-glow"
        >
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          {selected.size > 0
            ? `Otimizar selecionadas (${selectionEligibleCount})`
            : `Otimizar todas (${totalPending})`}
        </Button>
        <Button
          variant="outline"
          onClick={selectAllPending}
          disabled={running || loading || totalPending === 0}
          className="rounded-none font-accent tracking-[0.2em] uppercase text-xs"
        >
          Selecionar todas pendentes
        </Button>
        {atRiskCount > 0 && (
          <Button
            variant="outline"
            onClick={selectAtRisk}
            disabled={running || loading}
            className="rounded-none font-accent tracking-[0.2em] uppercase text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            title="Marca apenas imagens pendentes ou com erro (em risco de fallback)."
          >
            Selecionar em risco ({atRiskCount})
          </Button>
        )}
        {selected.size > 0 && (
          <Button
            variant="ghost"
            onClick={clearSelection}
            disabled={running}
            className="rounded-none font-accent tracking-[0.2em] uppercase text-xs"
          >
            <X className="h-3.5 w-3.5 mr-1.5" /> Limpar seleção ({selected.size})
          </Button>
        )}
        <Button
          variant="outline"
          onClick={detect}
          disabled={running || loading}
          className="rounded-none font-accent tracking-[0.2em] uppercase text-xs ml-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Re-detectar
        </Button>
      </div>

      {/* Grouped list by piece */}
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
        <div className="space-y-3">
          {groups.map((g) => {
            const total = g.items.length;
            const doneN = g.items.filter((i) => i.status === "done").length;
            const errN = g.items.filter((i) => i.status === "error").length;
            const pendingN = g.items.filter((i) => isPickable(i)).length;
            const groupPct = total > 0 ? Math.round((doneN / total) * 100) : 0;
            const open = !collapsedGroups.has(g.pieceId);
            const eligibleIds = g.items.filter(isPickable).map((i) => i.id);
            const allSelected =
              eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));
            const someSelected =
              !allSelected && eligibleIds.some((id) => selected.has(id));

            return (
              <Collapsible
                key={g.pieceId}
                open={open}
                onOpenChange={() => toggleGroup(g.pieceId)}
                className="rounded-lg border border-border/40 bg-card/30 overflow-hidden"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors text-left"
                  >
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm truncate">{g.pieceName}</p>
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                        {total} imagem(ns) ·{" "}
                        <span className="text-emerald-400">{doneN} otimizada(s)</span>
                        {pendingN > 0 && (
                          <>
                            {" · "}
                            <span className="text-foreground">{pendingN} pendente(s)</span>
                          </>
                        )}
                        {errN > 0 && (
                          <>
                            {" · "}
                            <span className="text-destructive">{errN} erro(s)</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <div className="h-1 w-24 rounded-full bg-secondary/40 overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-300"
                          style={{ width: `${groupPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground w-9 text-right">
                        {doneN}/{total}
                      </span>
                    </div>
                    {eligibleIds.length > 0 && (
                      <span
                        role="checkbox"
                        aria-checked={allSelected ? "true" : someSelected ? "mixed" : "false"}
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePieceSelection(g.pieceId);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            togglePieceSelection(g.pieceId);
                          }
                        }}
                        title="Selecionar todas pendentes desta obra"
                        className="ml-2 shrink-0"
                      >
                        <Checkbox
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          aria-label="Selecionar todas pendentes desta obra"
                          tabIndex={-1}
                          className="pointer-events-none"
                        />
                      </span>
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border/30 divide-y divide-border/30">
                    {g.items.map((it) => (
                      <BackfillRow
                        key={it.id}
                        item={it}
                        selected={selected.has(it.id)}
                        onToggle={() => toggleItem(it.id)}
                        selectable={isPickable(it)}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
};

type BackfillRowProps = {
  item: BackfillProgressItem;
  selected?: boolean;
  selectable?: boolean;
  onToggle?: () => void;
};

const DEVICE_ICONS = { mobile: Smartphone, tablet: Tablet, desktop: Monitor } as const;

const DeviceDots = ({ ready }: { ready: BackfillProgressItem["readyDevices"] }) => {
  const set = new Set(ready ?? []);
  return (
    <div className="flex items-center gap-1">
      {(["mobile", "tablet", "desktop"] as const).map((dev) => {
        const Icon = DEVICE_ICONS[dev];
        const on = set.has(dev);
        return (
          <span
            key={dev}
            title={`${dev}: ${on ? "pronto" : "aguardando"}`}
            className={`inline-flex items-center justify-center h-3.5 w-3.5 rounded-full transition-colors ${
              on ? "bg-emerald-500/30 text-emerald-300" : "bg-secondary/40 text-muted-foreground/50"
            }`}
          >
            <Icon className="h-2 w-2" />
          </span>
        );
      })}
    </div>
  );
};

const StatusBadge = ({
  item,
  onClickError,
}: {
  item: BackfillProgressItem;
  onClickError?: () => void;
}) => {
  if (item.status === "done" || item.status === "skipped") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-accent tracking-[0.25em] uppercase">
        <CheckCircle2 className="h-3 w-3" /> Otimizada
      </span>
    );
  }
  if (item.status === "error") {
    return (
      <button
        type="button"
        onClick={onClickError}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/15 text-destructive text-[10px] font-accent tracking-[0.25em] uppercase hover:bg-destructive/25 transition-colors cursor-pointer"
        title="Ver histórico de erros"
      >
        <AlertCircle className="h-3 w-3" /> Erro
      </button>
    );
  }
  if (ACTIVE_STATUSES.includes(item.status)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-accent tracking-[0.25em] uppercase animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" /> Otimizando
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/40 text-muted-foreground text-[10px] font-accent tracking-[0.25em] uppercase">
      <Circle className="h-3 w-3" /> Não otimizada
    </span>
  );
};

const BackfillRowImpl = ({ item, selected = false, selectable = false, onToggle }: BackfillRowProps) => {
  const [errorOpen, setErrorOpen] = useState(false);
  const animate = ACTIVE_STATUSES.includes(item.status);
  const showBar = animate || item.status === "done";
  const barPct = item.status === "done" ? 100 : item.progress || 0;
  const barColor =
    item.status === "done"
      ? "bg-emerald-400"
      : item.status === "error"
        ? "bg-destructive"
        : "bg-amber-400";
  const stageLabel = animate
    ? `${STATUS_LABEL[item.status]} ${barPct}%`
    : item.status === "done"
      ? "100% · concluída"
      : null;
  const showDots = animate || item.status === "done";

  const reprocess = async () => {
    if (!item.optimizedImageId) return;
    await supabase
      .from("optimized_images")
      .update({ status: "processing", error_message: null })
      .eq("id", item.optimizedImageId);
    await supabase.functions.invoke("optimize-image", {
      body: { imageId: item.optimizedImageId },
    });
    toast({ title: "Reprocessando…" });
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/10 transition-colors">
      <div className="shrink-0">
        {selectable ? (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            aria-label={`Selecionar ${item.filename}`}
          />
        ) : (
          <div className="h-4 w-4" aria-hidden />
        )}
      </div>
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
        </p>

        {showBar && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-secondary/40 overflow-hidden">
              <div
                className={`h-full ${barColor} transition-all duration-300`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            {showDots && <DeviceDots ready={item.readyDevices} />}
            {stageLabel && (
              <span
                className={`text-[9px] font-accent tracking-[0.2em] uppercase shrink-0 ${
                  item.status === "done" ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {stageLabel}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="shrink-0">
        <StatusBadge item={item} onClickError={() => setErrorOpen(true)} />
      </div>

      {item.status === "error" && errorOpen && (
        <ErrorHistoryDialog
          open={errorOpen}
          onOpenChange={setErrorOpen}
          optimizedImageId={item.optimizedImageId ?? null}
          title={item.filename}
          sessionError={
            item.error
              ? { stage: item.errorStage ?? "optimize", message: item.error }
              : null
          }
          onReprocess={item.optimizedImageId ? reprocess : undefined}
        />
      )}
    </div>
  );
};

/**
 * Memoized: only re-renders when status, progress, selection or selectability
 * changes. During a 50-image backfill this prevents 49 re-renders per tick.
 */
const BackfillRow = memo(
  BackfillRowImpl,
  (prev, next) =>
    prev.item.status === next.item.status &&
    prev.item.progress === next.item.progress &&
    prev.item.error === next.item.error &&
    (prev.item.readyDevices?.length ?? 0) === (next.item.readyDevices?.length ?? 0) &&
    prev.selected === next.selected &&
    prev.selectable === next.selectable &&
    prev.onToggle === next.onToggle,
);

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
