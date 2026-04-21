import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadDropzone } from "@/components/admin/optimizer/UploadDropzone";
import { ImageCard, type OptimizedImage } from "@/components/admin/optimizer/ImageCard";
import { CodeSnippetDialog } from "@/components/admin/optimizer/CodeSnippetDialog";
import { ImageDetailSheet } from "@/components/admin/optimizer/ImageDetailSheet";
import { formatBytes, type OptimizedVariant } from "@/lib/imageSnippet";

const PAGE_SIZE = 50;

type SortMode = "recent" | "used";

export const ImageOptimizer = () => {
  const [items, setItems] = useState<OptimizedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortMode>("recent");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [snippetTarget, setSnippetTarget] = useState<OptimizedImage | null>(null);
  const [detailTarget, setDetailTarget] = useState<OptimizedImage | null>(null);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const load = async () => {
    setLoading(true);
    const query = supabase
      .from("optimized_images")
      .select("*")
      .limit(PAGE_SIZE);
    if (sort === "recent") query.order("created_at", { ascending: false });
    else query.order("used_count", { ascending: false }).order("created_at", { ascending: false });
    const { data, error } = await query;
    if (!error && data) {
      setItems(
        data.map((d) => ({
          ...d,
          variants: (d.variants as unknown as OptimizedVariant[]) ?? [],
        })) as OptimizedImage[],
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  // Realtime updates
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
    if (!debounced) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(debounced) || i.id.toLowerCase().includes(debounced),
    );
  }, [items, debounced]);

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

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3">
        <Sparkles className="h-4 w-4 mt-0.5 text-primary-glow" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          Cada imagem é processada em <strong className="text-foreground">12 variantes</strong> (4 larguras × AVIF/WebP/JPG).
          O snippet gerado entrega o melhor formato suportado pelo navegador automaticamente, sem URL dinâmica.
        </div>
      </div>

      <UploadDropzone onUploaded={load} />

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
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-12 text-center">
          <Info className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {items.length === 0 ? "Nenhuma imagem otimizada ainda." : "Nenhum resultado para a busca."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((img) => (
            <ImageCard
              key={img.id}
              image={img}
              onOpenSnippet={setSnippetTarget}
              onOpenDetail={setDetailTarget}
              onChanged={load}
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
