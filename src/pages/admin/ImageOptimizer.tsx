import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, Info, RefreshCw, Trash2, X, Loader2, CheckSquare, LayoutGrid, List, ImageIcon, Wand2, Activity, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { ImageCard, type OptimizedImage } from "@/components/admin/optimizer/ImageCard";
import { ImageRow, type PieceLink } from "@/components/admin/optimizer/ImageRow";
import { CodeSnippetDialog } from "@/components/admin/optimizer/CodeSnippetDialog";
import { ImageDetailSheet } from "@/components/admin/optimizer/ImageDetailSheet";
import { formatBytes, isLegacyFormat, isAtRiskOfFallback, type OptimizedVariant } from "@/lib/imageSnippet";

const PAGE_SIZE = 100;
const BUCKET = "optimized-images";
const BULK_CONCURRENCY = 3;

type SortMode = "recent" | "used";
type ViewMode = "list" | "grid";
type StatusFilter = "all" | "active" | "orphan";

const runWithConcurrency = async <T,>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
) => {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        await fn(items[i], i);
      } catch {
        /* swallowed */
      }
    }
  });
  await Promise.all(workers);
};

type OptimizedImageWithLink = OptimizedImage & { piece_id?: string | null; image_role?: string | null };

export const ImageOptimizer = () => {
  const [items, setItems] = useState<OptimizedImageWithLink[]>([]);
  const [pieceLinks, setPieceLinks] = useState<Map<string, PieceLink>>(new Map());
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortMode>("recent");
  const [view, setView] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [snippetTarget, setSnippetTarget] = useState<OptimizedImage | null>(null);
  const [detailTarget, setDetailTarget] = useState<OptimizedImage | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<null | "reprocess" | "delete" | "modernize" | "atrisk">(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const load = async () => {
    setLoading(true);
    const query = supabase.from("optimized_images").select("*").limit(PAGE_SIZE);
    if (sort === "recent") query.order("created_at", { ascending: false });
    else query.order("used_count", { ascending: false }).order("created_at", { ascending: false });
    const { data, error } = await query;
    if (!error && data) {
      const mapped = data.map((d) => ({
        ...d,
        variants: (d.variants as unknown as OptimizedVariant[]) ?? [],
      })) as OptimizedImageWithLink[];
      setItems(mapped);

      // Fetch piece names for items linked to a piece
      const pieceIds = Array.from(
        new Set(mapped.map((m) => m.piece_id).filter((v): v is string => !!v)),
      );
      if (pieceIds.length > 0) {
        const { data: pieces } = await supabase
          .from("gallery_pieces")
          .select("id, nome")
          .in("id", pieceIds);
        const linkMap = new Map<string, PieceLink>();
        if (pieces) {
          const byPiece = new Map(pieces.map((p) => [p.id, p.nome]));
          for (const item of mapped) {
            if (item.piece_id && byPiece.has(item.piece_id)) {
              linkMap.set(item.id, { pieceId: item.piece_id, pieceName: byPiece.get(item.piece_id)! });
            }
          }
        }
        setPieceLinks(linkMap);
      } else {
        setPieceLinks(new Map());
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  useEffect(() => {
    const channel = supabase
      .channel("optimized_images_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "optimized_images" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const filtered = useMemo(() => {
    let out = items;
    if (statusFilter === "active") {
      out = out.filter((i) => pieceLinks.has(i.id) || i.used_count > 0);
    } else if (statusFilter === "orphan") {
      out = out.filter((i) => !pieceLinks.has(i.id) && i.used_count === 0);
    }
    if (debounced) {
      out = out.filter(
        (i) => i.name.toLowerCase().includes(debounced) || i.id.toLowerCase().includes(debounced),
      );
    }
    return out;
  }, [items, debounced, statusFilter, pieceLinks]);

  const orphanCount = useMemo(
    () => items.filter((i) => !pieceLinks.has(i.id) && i.used_count === 0).length,
    [items, pieceLinks],
  );
  const activeCount = items.length - orphanCount;

  /** Imagens "ready" sem o triple device-tagged WebP do novo pipeline. */
  const legacyIds = useMemo(
    () =>
      items
        .filter((i) => i.status === "ready" && isLegacyFormat(i.variants))
        .map((i) => i.id),
    [items],
  );
  const legacyCount = legacyIds.length;

  /** Conjunto ampliado: legacy + órfãs (ready sem variants) + erros. */
  const atRiskIds = useMemo(
    () =>
      items
        .filter((i) => isAtRiskOfFallback(i.status, i.variants))
        .map((i) => i.id),
    [items],
  );
  const atRiskCount = atRiskIds.length;

  const stats = useMemo(() => {
    const ready = items.filter((i) => i.status === "ready");
    const totalOriginal = ready.reduce((s, i) => s + (i.original_size_bytes ?? 0), 0);
    // Use tablet WebP (representative middle variant) for savings calc.
    const totalRepresentative = ready.reduce((s, i) => {
      const tablet =
        i.variants.find((v) => v.format === "webp" && v.device_label === "tablet") ??
        i.variants.find((v) => v.format === "webp") ??
        i.variants.find((v) => v.format === "jpeg");
      return s + (tablet?.size_bytes ?? 0);
    }, 0);
    const savedPct = totalOriginal > 0 ? Math.round(((totalOriginal - totalRepresentative) / totalOriginal) * 100) : 0;
    return { count: items.length, ready: ready.length, totalOriginal, savedPct };
  }, [items]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => setSelectedIds(new Set(filtered.map((i) => i.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkReprocess = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkBusy("reprocess");
    setBulkProgress({ done: 0, total: ids.length });

    setItems((prev) =>
      prev.map((it) =>
        selectedIds.has(it.id) ? { ...it, status: "processing", error_message: null } : it,
      ),
    );

    await supabase
      .from("optimized_images")
      .update({ status: "processing", error_message: null })
      .in("id", ids);

    let done = 0;
    let failed = 0;
    await runWithConcurrency(ids, BULK_CONCURRENCY, async (id) => {
      const { error } = await supabase.functions.invoke("optimize-image", { body: { imageId: id } });
      if (error) failed++;
      done++;
      setBulkProgress({ done, total: ids.length });
    });

    setBulkBusy(null);
    setBulkProgress(null);
    if (failed > 0) {
      toast({
        title: `Reprocessamento concluído com ${failed} erro(s)`,
        description: `${ids.length - failed}/${ids.length} disparados com sucesso.`,
        variant: failed === ids.length ? "destructive" : "default",
      });
    } else {
      toast({ title: `${ids.length} imagens reprocessando…` });
    }
    clearSelection();
    load();
  };

  const handleModernizeLegacy = async () => {
    const ids = [...legacyIds];
    if (!ids.length) return;
    setBulkBusy("modernize");
    setBulkProgress({ done: 0, total: ids.length });

    setItems((prev) =>
      prev.map((it) =>
        ids.includes(it.id) ? { ...it, status: "processing", error_message: null } : it,
      ),
    );
    await supabase
      .from("optimized_images")
      .update({ status: "processing", error_message: null })
      .in("id", ids);

    let done = 0;
    let failed = 0;
    await runWithConcurrency(ids, BULK_CONCURRENCY, async (id) => {
      const { error } = await supabase.functions.invoke("optimize-image", { body: { imageId: id } });
      if (error) failed++;
      done++;
      setBulkProgress({ done, total: ids.length });
    });

    setBulkBusy(null);
    setBulkProgress(null);
    if (failed > 0) {
      toast({
        title: `Modernização concluída com ${failed} erro(s)`,
        description: `${ids.length - failed}/${ids.length} reprocessadas no novo pipeline WebP.`,
        variant: failed === ids.length ? "destructive" : "default",
      });
    } else {
      toast({
        title: `${ids.length} imagem(ns) modernizadas`,
        description: "Variantes mobile/tablet/desktop geradas no novo pipeline.",
      });
    }
    load();
  };

  const handleAutoOptimizeAtRisk = async () => {
    const ids = [...atRiskIds];
    if (!ids.length) return;
    setBulkBusy("atrisk");
    setBulkProgress({ done: 0, total: ids.length });

    setItems((prev) =>
      prev.map((it) =>
        ids.includes(it.id) ? { ...it, status: "processing", error_message: null } : it,
      ),
    );
    await supabase
      .from("optimized_images")
      .update({ status: "processing", error_message: null })
      .in("id", ids);

    let done = 0;
    let failed = 0;
    await runWithConcurrency(ids, BULK_CONCURRENCY, async (id) => {
      const { error } = await supabase.functions.invoke("optimize-image", { body: { imageId: id } });
      if (error) failed++;
      done++;
      setBulkProgress({ done, total: ids.length });
    });

    setBulkBusy(null);
    setBulkProgress(null);
    if (failed > 0) {
      toast({
        title: `Auto-otimização concluída com ${failed} erro(s)`,
        description: `${ids.length - failed}/${ids.length} reprocessadas.`,
        variant: failed === ids.length ? "destructive" : "default",
      });
    } else {
      toast({
        title: `${ids.length} imagem(ns) em risco reprocessadas`,
        description: "Variantes WebP do novo pipeline foram regeneradas.",
      });
    }
    load();
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`Excluir ${ids.length} imagem(ns) selecionada(s)? Esta ação não pode ser desfeita.`)) return;

    setBulkBusy("delete");
    setBulkProgress({ done: 0, total: ids.length });

    const targets = items.filter((i) => selectedIds.has(i.id));
    let done = 0;
    let failed = 0;

    await runWithConcurrency(targets, BULK_CONCURRENCY, async (img) => {
      try {
        const folder = img.original_path.split("/").slice(0, -1).join("/");
        const { data: list } = await supabase.storage.from(BUCKET).list(folder);
        if (list?.length) {
          await supabase.storage.from(BUCKET).remove(list.map((f) => `${folder}/${f.name}`));
        }
      } catch {
        failed++;
      }
      done++;
      setBulkProgress({ done, total: ids.length });
    });

    await supabase.from("optimized_images").delete().in("id", ids);

    setBulkBusy(null);
    setBulkProgress(null);
    toast({
      title: `${ids.length - failed} imagem(ns) excluída(s)`,
      ...(failed > 0 ? { description: `${failed} falha(s) ao limpar storage.`, variant: "destructive" as const } : {}),
    });
    clearSelection();
    load();
  };

  const selectionCount = selectedIds.size;
  const allVisibleSelected = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3">
        <ImageIcon className="h-4 w-4 mt-0.5 text-primary-glow shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          As imagens são enviadas pelo modal de cada obra em <strong className="text-foreground">Criar e gerenciar Imagens</strong>.
          Esta tela mostra o histórico, o estado de otimização e quais variantes (mobile/tablet/desktop) foram geradas.
        </div>
      </div>

      <WebpTelemetryCard />

      <div className="rounded-lg border border-primary/10 bg-primary/[0.03] px-4 py-3 flex items-start gap-3">
        <Sparkles className="h-4 w-4 mt-0.5 text-primary-glow shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed flex-1">
          Pipeline rápido: cada imagem gera <strong className="text-foreground">3 variantes WebP</strong> — 📱 mobile (480px), 💻 tablet (1024px) e 🖥 desktop (1600px).
          O navegador escolhe automaticamente o tamanho ideal para cada aparelho.
          <span className="ml-2 text-muted-foreground/70">
            Otimização ~3-5s por imagem.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Imagens" value={String(stats.count)} />
        <StatCard label="Prontas" value={String(stats.ready)} />
        <StatCard label="Original total" value={formatBytes(stats.totalOriginal)} />
        <StatCard label="Economia média" value={`${stats.savedPct}%`} highlight />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs value={sort} onValueChange={(v) => setSort(v as SortMode)}>
          <TabsList>
            <TabsTrigger value="recent">Recentes</TabsTrigger>
            <TabsTrigger value="used">Mais usadas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="inline-flex rounded-md border border-border/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`px-3 h-9 inline-flex items-center gap-1.5 text-xs font-accent tracking-[0.2em] uppercase transition-colors ${
              view === "list" ? "bg-primary/15 text-primary-glow" : "text-muted-foreground hover:text-foreground"
            }`}
            aria-label="Visualização em lista"
          >
            <List className="h-3.5 w-3.5" /> Lista
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`px-3 h-9 inline-flex items-center gap-1.5 text-xs font-accent tracking-[0.2em] uppercase transition-colors ${
              view === "grid" ? "bg-primary/15 text-primary-glow" : "text-muted-foreground hover:text-foreground"
            }`}
            aria-label="Visualização em grade"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Grade
          </button>
        </div>
      </div>

      {/* Status filter pills + legacy modernization */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-border/60 overflow-hidden text-xs">
          <FilterPill
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
            label="Todas"
            count={items.length}
          />
          <FilterPill
            active={statusFilter === "active"}
            onClick={() => setStatusFilter("active")}
            label="Na galeria"
            count={activeCount}
          />
          <FilterPill
            active={statusFilter === "orphan"}
            onClick={() => setStatusFilter("orphan")}
            label="Órfãs"
            count={orphanCount}
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {atRiskCount > 0 && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleAutoOptimizeAtRisk}
                    disabled={!!bulkBusy}
                    className="inline-flex items-center gap-1.5 text-[11px] font-accent tracking-[0.2em] uppercase px-3 h-9 rounded-md border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-colors disabled:opacity-40"
                  >
                    {bulkBusy === "atrisk" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {bulkBusy === "atrisk" && bulkProgress
                      ? `Auto ${bulkProgress.done}/${bulkProgress.total}`
                      : `Auto-otimizar em risco (${atRiskCount})`}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                  Reprocessa automaticamente as imagens com maior risco de cair no fallback original — sem WebP, com erro ou no formato antigo.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

        {legacyCount > 0 && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleModernizeLegacy}
                  disabled={!!bulkBusy}
                  className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-accent tracking-[0.2em] uppercase px-3 h-9 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary-glow transition-colors disabled:opacity-40"
                >
                  {bulkBusy === "modernize" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  {bulkBusy === "modernize" && bulkProgress
                    ? `Modernizando ${bulkProgress.done}/${bulkProgress.total}`
                    : `Modernizar antigas (${legacyCount})`}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                Reprocessa imagens que ainda não têm variantes mobile/tablet/desktop
                no novo pipeline WebP.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectionCount > 0 && (
        <div className="sticky top-0 z-20 -mx-2 px-2">
          <div className="rounded-lg border border-primary/40 bg-card/95 backdrop-blur shadow-glow px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckSquare className="h-4 w-4 text-primary-glow" />
              <span className="font-medium">
                {selectionCount} selecionada{selectionCount > 1 ? "s" : ""}
              </span>
              {bulkProgress && (
                <span className="text-xs text-muted-foreground ml-2">
                  {bulkBusy === "reprocess" ? "Reprocessando" : "Excluindo"} {bulkProgress.done}/{bulkProgress.total}…
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={allVisibleSelected ? clearSelection : selectAllVisible}
                disabled={!!bulkBusy}
                className="text-xs font-accent tracking-[0.2em] uppercase px-3 py-1.5 rounded border border-border/60 hover:border-primary/60 hover:text-foreground text-muted-foreground transition-colors disabled:opacity-40"
              >
                {allVisibleSelected ? "Limpar" : "Selecionar todas"}
              </button>
              <button
                type="button"
                onClick={handleBulkReprocess}
                disabled={!!bulkBusy}
                className="inline-flex items-center gap-1.5 text-xs font-accent tracking-[0.2em] uppercase px-3 py-1.5 rounded bg-primary/15 hover:bg-primary/25 text-primary-glow transition-colors disabled:opacity-40"
              >
                {bulkBusy === "reprocess" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Reprocessar ({selectionCount})
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={!!bulkBusy}
                className="inline-flex items-center gap-1.5 text-xs font-accent tracking-[0.2em] uppercase px-3 py-1.5 rounded bg-destructive/15 hover:bg-destructive/25 text-destructive transition-colors disabled:opacity-40"
              >
                {bulkBusy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Excluir ({selectionCount})
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={!!bulkBusy}
                title="Cancelar seleção"
                className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        view === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-secondary/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-secondary/30 animate-pulse" />
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-12 text-center">
          <Info className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {items.length === 0 ? "Nenhuma imagem otimizada ainda." : "Nenhum resultado para a busca."}
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((img) => (
            <ImageCard
              key={img.id}
              image={img}
              onOpenSnippet={setSnippetTarget}
              onOpenDetail={setDetailTarget}
              onChanged={load}
              selected={selectedIds.has(img.id)}
              onToggleSelect={toggleSelect}
              selectionMode={selectionCount > 0}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((img) => (
            <ImageRow
              key={img.id}
              image={img}
              pieceLink={pieceLinks.get(img.id) ?? null}
              onOpenSnippet={setSnippetTarget}
              onOpenDetail={setDetailTarget}
              onChanged={load}
              selected={selectedIds.has(img.id)}
              onToggleSelect={toggleSelect}
              selectionMode={selectionCount > 0}
            />
          ))}
        </div>
      )}

      <CodeSnippetDialog image={snippetTarget} onClose={() => setSnippetTarget(null)} />
      <ImageDetailSheet image={detailTarget} onClose={() => setDetailTarget(null)} />
    </div>
  );
};

const StatCard = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div
    className={`rounded-lg border px-4 py-3 ${
      highlight ? "border-primary/40 bg-primary/10" : "border-border/40 bg-card/40"
    }`}
  >
    <p className="font-accent text-[9px] tracking-[0.3em] uppercase text-muted-foreground">{label}</p>
    <p className={`font-display text-xl mt-1 ${highlight ? "text-primary-glow" : ""}`}>{value}</p>
  </div>
);

const FilterPill = ({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 h-9 inline-flex items-center gap-1.5 font-accent tracking-[0.2em] uppercase text-[11px] transition-colors ${
      active ? "bg-primary/15 text-primary-glow" : "text-muted-foreground hover:text-foreground"
    }`}
  >
    <span>{label}</span>
    <span className={`text-[10px] tabular-nums ${active ? "text-primary-glow" : "text-muted-foreground/60"}`}>
      {count}
    </span>
  </button>
);

type WebpTelemetryRow = {
  event_type: string;
  session_id: string;
  user_agent: string | null;
  created_at: string;
  meta: { loadMs?: number; originalBytes?: number; webpBytesEstimate?: number } | null;
};

type ImpactBucket = {
  sessions: number;
  avgLoadMs: number;
  avgBytes: number;
};

type WebpTelemetryStats = {
  unsupportedSessions7d: number;
  unsupportedSessions30d: number;
  fallbackSessions7d: number;
  fallbackSessions30d: number;
  topUserAgents: { ua: string; count: number }[];
  totalSessions30d: number;
  fallbackPct30d: number;
  impactWebp: ImpactBucket;
  impactFallback: ImpactBucket;
};

const WebpTelemetryCard = () => {
  const [stats, setStats] = useState<WebpTelemetryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("client_telemetry")
      .select("event_type, session_id, user_agent, created_at, meta")
      .in("event_type", ["webp_unsupported", "webp_fallback_used", "webp_served"])
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(5000);

    const emptyImpact: ImpactBucket = { sessions: 0, avgLoadMs: 0, avgBytes: 0 };

    if (error || !data) {
      setStats({
        unsupportedSessions7d: 0,
        unsupportedSessions30d: 0,
        fallbackSessions7d: 0,
        fallbackSessions30d: 0,
        topUserAgents: [],
        totalSessions30d: 0,
        fallbackPct30d: 0,
        impactWebp: emptyImpact,
        impactFallback: emptyImpact,
      });
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const rows = data as WebpTelemetryRow[];
    const uniq = (preds: (r: WebpTelemetryRow) => boolean) =>
      new Set(rows.filter(preds).map((r) => r.session_id)).size;

    const isFb = (r: WebpTelemetryRow) => r.event_type === "webp_fallback_used";
    const isUn = (r: WebpTelemetryRow) => r.event_type === "webp_unsupported";
    const after7 = (r: WebpTelemetryRow) => r.created_at >= since7;

    const allSessions30d = new Set(rows.map((r) => r.session_id)).size;
    const fb30 = uniq(isFb);
    const fallbackPct30d = allSessions30d > 0 ? Math.round((fb30 / allSessions30d) * 100) : 0;

    // Top user agents (truncated for readability)
    const uaCounts = new Map<string, number>();
    for (const r of rows) {
      if (!r.user_agent) continue;
      const key = r.user_agent.slice(0, 80);
      uaCounts.set(key, (uaCounts.get(key) ?? 0) + 1);
    }
    const topUserAgents = Array.from(uaCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([ua, count]) => ({ ua, count }));

    // --- Impact buckets: aggregate per-session averages of meta.loadMs / originalBytes
    //     to compare WebP-served sessions vs fallback sessions.
    const aggregate = (predicate: (r: WebpTelemetryRow) => boolean): ImpactBucket => {
      const byS = new Map<string, { l: number[]; b: number[] }>();
      for (const r of rows.filter(predicate)) {
        const m = r.meta ?? {};
        const slot = byS.get(r.session_id) ?? { l: [], b: [] };
        if (typeof m.loadMs === "number" && m.loadMs > 0) slot.l.push(m.loadMs);
        if (typeof m.originalBytes === "number" && m.originalBytes > 0) slot.b.push(m.originalBytes);
        byS.set(r.session_id, slot);
      }
      const sessLoad: number[] = [];
      const sessBytes: number[] = [];
      for (const slot of byS.values()) {
        if (slot.l.length) sessLoad.push(slot.l.reduce((a, b) => a + b, 0) / slot.l.length);
        if (slot.b.length) sessBytes.push(slot.b.reduce((a, b) => a + b, 0) / slot.b.length);
      }
      const mean = (arr: number[]) =>
        arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
      return {
        sessions: byS.size,
        avgLoadMs: mean(sessLoad),
        avgBytes: mean(sessBytes),
      };
    };

    const impactWebp = aggregate((r) => r.event_type === "webp_served");
    const impactFallback = aggregate(isFb);

    setStats({
      unsupportedSessions7d: uniq((r) => isUn(r) && after7(r)),
      unsupportedSessions30d: uniq(isUn),
      fallbackSessions7d: uniq((r) => isFb(r) && after7(r)),
      fallbackSessions30d: fb30,
      topUserAgents,
      totalSessions30d: allSessions30d,
      fallbackPct30d,
      impactWebp,
      impactFallback,
    });
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-border/40 bg-card/40 backdrop-blur p-4 h-24 animate-pulse" />
    );
  }
  if (!stats) return null;

  const noData =
    stats.unsupportedSessions30d === 0 && stats.fallbackSessions30d === 0;

  return (
    <div className="rounded-lg border border-border/40 bg-card/40 backdrop-blur p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary-glow" />
          <p className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Telemetria do navegador (WebP)
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={refreshing}
          className="inline-flex items-center gap-1 text-[10px] font-accent tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {noData ? (
        <p className="text-xs text-muted-foreground">
          Nenhum evento de fallback registrado nos últimos 30 dias. 🎉 Todos os visitantes têm suporte a WebP.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Sem WebP · 7d" value={String(stats.unsupportedSessions7d)} />
            <MiniStat label="Sem WebP · 30d" value={String(stats.unsupportedSessions30d)} />
            <MiniStat label="Fallback · 7d" value={String(stats.fallbackSessions7d)} />
            <MiniStat
              label="% sessões 30d"
              value={`${stats.fallbackPct30d}%`}
              tone={stats.fallbackPct30d >= 5 ? "warning" : "success"}
            />
          </div>

          <ImpactSection webp={stats.impactWebp} fallback={stats.impactFallback} />
          {stats.fallbackPct30d >= 5 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Mais de 5% das sessões caíram no fallback original. Considere manter os JPEGs originais bem dimensionados — a otimização WebP não está alcançando essa parcela do público.
              </p>
            </div>
          )}
          {stats.topUserAgents.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-accent text-[9px] tracking-[0.3em] uppercase text-muted-foreground/70">
                Top user agents
              </p>
              <ul className="space-y-1">
                {stats.topUserAgents.map((row) => (
                  <li
                    key={row.ua}
                    className="text-[11px] text-muted-foreground flex items-center gap-2"
                  >
                    <span className="font-mono text-[10px] text-primary-glow tabular-nums shrink-0">
                      {row.count}×
                    </span>
                    <span className="truncate" title={row.ua}>
                      {row.ua}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const MiniStat = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "success";
}) => {
  const toneClass =
    tone === "warning"
      ? "text-amber-400"
      : tone === "success"
        ? "text-emerald-400"
        : "text-foreground";
  return (
    <div className="rounded-md border border-border/40 bg-card/30 px-3 py-2">
      <p className="font-accent text-[8px] tracking-[0.25em] uppercase text-muted-foreground truncate">
        {label}
      </p>
      <p className={`font-display text-base mt-0.5 tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
};

const ImpactSection = ({
  webp,
  fallback,
}: {
  webp: ImpactBucket;
  fallback: ImpactBucket;
}) => {
  const MIN_SAMPLES = 3;
  const enough = webp.sessions >= MIN_SAMPLES && fallback.sessions >= MIN_SAMPLES;

  if (webp.sessions === 0 && fallback.sessions === 0) return null;

  if (!enough) {
    return (
      <div className="rounded-md border border-border/40 bg-card/30 px-3 py-2">
        <p className="font-accent text-[9px] tracking-[0.3em] uppercase text-muted-foreground/70 mb-1">
          Impacto por sessão (30d)
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Aguardando mais dados para correlação confiável ({webp.sessions} c/ WebP · {fallback.sessions} em fallback).
        </p>
      </div>
    );
  }

  const dLoad = fallback.avgLoadMs - webp.avgLoadMs;
  const dBytes = fallback.avgBytes - webp.avgBytes;
  const severity = dLoad < 100 ? "success" : dLoad < 300 ? "warning" : "destructive";
  const severityCls =
    severity === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : severity === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : "border-destructive/40 bg-destructive/10 text-destructive";
  const severityLabel =
    severity === "success"
      ? "Impacto mínimo"
      : severity === "warning"
        ? "Impacto moderado"
        : "Impacto significativo — considere otimizar JPEGs originais";

  return (
    <div className="space-y-2">
      <p className="font-accent text-[9px] tracking-[0.3em] uppercase text-muted-foreground/70">
        Impacto por sessão (30d)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <ImpactBucketCard label="Sessões com WebP" tone="success" bucket={webp} />
        <ImpactBucketCard label="Sessões em fallback" tone="warning" bucket={fallback} />
      </div>
      <div className={`rounded-md border px-3 py-2 text-[11px] flex items-center gap-2 ${severityCls}`}>
        <Activity className="h-3 w-3 shrink-0" />
        <span className="font-medium">{severityLabel}</span>
        <span className="text-muted-foreground ml-auto tabular-nums">
          Δ {dLoad >= 0 ? "+" : ""}{Math.round(dLoad)} ms · Δ {dBytes >= 0 ? "+" : ""}{formatBytes(Math.abs(dBytes))} por imagem
        </span>
      </div>
    </div>
  );
};

const ImpactBucketCard = ({
  label,
  tone,
  bucket,
}: {
  label: string;
  tone: "success" | "warning";
  bucket: ImpactBucket;
}) => {
  const toneCls = tone === "success" ? "text-emerald-400" : "text-amber-400";
  return (
    <div className="rounded-md border border-border/40 bg-card/30 px-3 py-2 space-y-1">
      <p className="font-accent text-[8px] tracking-[0.25em] uppercase text-muted-foreground truncate">
        {label} <span className="text-muted-foreground/60 normal-case tracking-normal">· {bucket.sessions} sessões</span>
      </p>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-accent text-[8px] tracking-[0.25em] uppercase text-muted-foreground/70">Tempo</p>
          <p className={`font-display text-sm tabular-nums ${toneCls}`}>
            {bucket.avgLoadMs > 0 ? `${bucket.avgLoadMs} ms` : "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-accent text-[8px] tracking-[0.25em] uppercase text-muted-foreground/70">Tamanho</p>
          <p className={`font-display text-sm tabular-nums ${toneCls}`}>
            {bucket.avgBytes > 0 ? formatBytes(bucket.avgBytes) : "—"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ImageOptimizer;
