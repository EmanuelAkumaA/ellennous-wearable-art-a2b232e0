import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, Info, RefreshCw, Trash2, X, Loader2, CheckSquare, LayoutGrid, List, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ImageCard, type OptimizedImage } from "@/components/admin/optimizer/ImageCard";
import { ImageRow, type PieceLink } from "@/components/admin/optimizer/ImageRow";
import { CodeSnippetDialog } from "@/components/admin/optimizer/CodeSnippetDialog";
import { ImageDetailSheet } from "@/components/admin/optimizer/ImageDetailSheet";
import { formatBytes, type OptimizedVariant } from "@/lib/imageSnippet";

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
  const [bulkBusy, setBulkBusy] = useState<null | "reprocess" | "delete">(null);
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

  const stats = useMemo(() => {
    const ready = items.filter((i) => i.status === "ready");
    const totalOriginal = ready.reduce((s, i) => s + (i.original_size_bytes ?? 0), 0);
    const totalFallback = ready.reduce((s, i) => {
      const f = i.variants.find((v) => v.format === "jpeg" && v.width === 800)
        ?? i.variants.find((v) => v.format === "jpeg");
      return s + (f?.size_bytes ?? 0);
    }, 0);
    const savedPct = totalOriginal > 0 ? Math.round(((totalOriginal - totalFallback) / totalOriginal) * 100) : 0;
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

      <div className="rounded-lg border border-primary/10 bg-primary/[0.03] px-4 py-3 flex items-start gap-3">
        <Sparkles className="h-4 w-4 mt-0.5 text-primary-glow shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          Cada imagem é processada em <strong className="text-foreground">12 variantes</strong> (4 larguras × AVIF/WebP/JPG).
          O navegador escolhe automaticamente o melhor formato suportado em cada aparelho.
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

      {/* Status filter pills */}
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

export default ImageOptimizer;
