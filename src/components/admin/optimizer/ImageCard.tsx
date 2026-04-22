import { memo, useState } from "react";
import { Code2, Trash2, RefreshCw, Loader2, Star, AlertCircle, CheckCircle2, Eye, CheckSquare, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatBytes, type OptimizedVariant } from "@/lib/imageSnippet";

export type OptimizedImage = {
  id: string;
  name: string;
  original_path: string;
  original_size_bytes: number;
  original_width: number | null;
  original_height: number | null;
  status: "processing" | "ready" | "error";
  error_message: string | null;
  variants: OptimizedVariant[];
  total_optimized_bytes: number | null;
  used_count: number;
  created_at: string;
};

interface ImageCardProps {
  image: OptimizedImage;
  onOpenSnippet: (img: OptimizedImage) => void;
  onOpenDetail: (img: OptimizedImage) => void;
  onChanged: () => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  selectionMode?: boolean;
}

const BUCKET = "optimized-images";

const ImageCardImpl = ({ image, onOpenSnippet, onOpenDetail, onChanged, selected = false, onToggleSelect, selectionMode = false }: ImageCardProps) => {
  const [busy, setBusy] = useState<null | "delete" | "reprocess" | "use">(null);

  // New pipeline: prefer device-tagged WebP. Legacy: any webp/jpeg.
  const tabletWebp =
    image.variants.find((v) => v.format === "webp" && v.device_label === "tablet") ??
    image.variants.find((v) => v.format === "webp" && v.device_label === "desktop") ??
    image.variants.find((v) => v.format === "webp") ??
    image.variants.find((v) => v.format === "jpeg");
  const previewUrl =
    tabletWebp?.url ?? supabase.storage.from(BUCKET).getPublicUrl(image.original_path).data.publicUrl;

  // Savings: compare original vs the tablet WebP (representative size)
  const savings = tabletWebp && image.original_size_bytes
    ? Math.max(0, Math.round(((image.original_size_bytes - tabletWebp.size_bytes) / image.original_size_bytes) * 100))
    : null;

  const remove = async () => {
    if (!confirm(`Excluir "${image.name}"?`)) return;
    setBusy("delete");
    try {
      const folder = image.original_path.split("/").slice(0, -1).join("/");
      const { data: list } = await supabase.storage.from(BUCKET).list(folder);
      if (list?.length) {
        await supabase.storage.from(BUCKET).remove(list.map((f) => `${folder}/${f.name}`));
      }
      await supabase.from("optimized_images").delete().eq("id", image.id);
      toast({ title: "Imagem excluída" });
      onChanged();
    } catch (e) {
      toast({ title: "Erro ao excluir", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const reprocess = async () => {
    setBusy("reprocess");
    try {
      await supabase
        .from("optimized_images")
        .update({ status: "processing", error_message: null })
        .eq("id", image.id);
      const { error } = await supabase.functions.invoke("optimize-image", { body: { imageId: image.id } });
      if (error) throw error;
      toast({ title: "Reprocessando…" });
      onChanged();
    } catch (e) {
      toast({ title: "Erro ao reprocessar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const toggleUsed = async () => {
    setBusy("use");
    try {
      await supabase
        .from("optimized_images")
        .update({ used_count: image.used_count > 0 ? 0 : image.used_count + 1 })
        .eq("id", image.id);
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const handleCardBackgroundClick = (e: React.MouseEvent) => {
    if (!selectionMode || !onToggleSelect) return;
    // Only toggle when clicking the card surface itself, not buttons/inputs/imgs
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a, picture, img")) return;
    onToggleSelect(image.id);
  };

  return (
    <div
      onClick={handleCardBackgroundClick}
      className={`group relative rounded-lg border bg-card/40 backdrop-blur overflow-hidden transition-all ${
        selected
          ? "border-primary ring-2 ring-primary/60"
          : "border-border/40 hover:border-primary/40"
      } ${selectionMode ? "cursor-pointer" : ""}`}
    >
      {onToggleSelect && (
        <label
          className={`absolute top-2 left-2 z-30 flex items-center justify-center h-6 w-6 rounded-md border bg-background/80 backdrop-blur cursor-pointer transition-all ${
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border/60 hover:border-primary/60"
          } ${selectionMode || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(image.id)}
            className="sr-only"
            aria-label={selected ? "Desmarcar imagem" : "Selecionar imagem"}
          />
          {selected && <CheckSquare className="h-3.5 w-3.5" />}
          {!selected && <Square className="h-3.5 w-3.5 text-muted-foreground" />}
        </label>
      )}
      <div className="relative aspect-square bg-secondary/30">
        {image.status === "processing" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary-glow" />
            <span className="font-accent text-[10px] tracking-[0.3em] uppercase">Processando</span>
          </div>
        ) : image.status === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-destructive p-4 text-center">
            <AlertCircle className="h-6 w-6" />
            <span className="font-accent text-[10px] tracking-[0.3em] uppercase">Erro</span>
            <p className="text-[10px] text-muted-foreground line-clamp-2">{image.error_message}</p>
          </div>
        ) : (
          <img
            src={previewUrl}
            alt={image.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {image.used_count > 0 && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-primary/90 text-primary-foreground text-[9px] font-accent tracking-[0.25em] uppercase px-2 py-0.5">
            <Star className="h-2.5 w-2.5 fill-current" /> Em uso
          </span>
        )}

        {image.status === "ready" && savings !== null && savings > 0 && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 text-white text-[9px] font-accent tracking-[0.25em] uppercase px-2 py-0.5">
            <CheckCircle2 className="h-2.5 w-2.5" /> -{savings}%
          </span>
        )}
      </div>

      <div className="p-3 space-y-2">
        <p className="text-xs truncate font-medium" title={image.name}>
          {image.name}
        </p>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{formatBytes(image.original_size_bytes)}</span>
          <span>{image.variants.length} {image.variants.length === 1 ? "variante" : "variantes"}</span>
        </div>

        <div className="flex items-center gap-1 pt-1">
          <button
            type="button"
            onClick={() => onOpenSnippet(image)}
            disabled={image.status !== "ready"}
            title="Ver código"
            className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-primary/15 hover:bg-primary/25 text-primary-glow text-[10px] font-accent tracking-[0.25em] uppercase py-1.5 disabled:opacity-40 transition-colors"
          >
            <Code2 className="h-3 w-3" /> Código
          </button>
          <button
            type="button"
            onClick={() => onOpenDetail(image)}
            title="Detalhes"
            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleUsed}
            disabled={!!busy}
            title={image.used_count > 0 ? "Desmarcar uso" : "Marcar como usada"}
            className="rounded p-1.5 text-muted-foreground hover:text-amber-400 hover:bg-secondary/60 transition-colors"
          >
            <Star className={`h-3.5 w-3.5 ${image.used_count > 0 ? "fill-amber-400 text-amber-400" : ""}`} />
          </button>
          <button
            type="button"
            onClick={reprocess}
            disabled={!!busy || image.status === "processing"}
            title="Reprocessar"
            className="rounded p-1.5 text-muted-foreground hover:text-primary-glow hover:bg-secondary/60 transition-colors disabled:opacity-40"
          >
            {busy === "reprocess" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={!!busy}
            title="Excluir"
            className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

/** Memoized to prevent grid-wide re-renders during bulk operations. */
export const ImageCard = memo(
  ImageCardImpl,
  (prev, next) =>
    prev.image.id === next.image.id &&
    prev.image.status === next.image.status &&
    prev.image.variants.length === next.image.variants.length &&
    prev.image.used_count === next.image.used_count &&
    prev.image.error_message === next.image.error_message &&
    prev.selected === next.selected &&
    prev.selectionMode === next.selectionMode &&
    prev.onOpenSnippet === next.onOpenSnippet &&
    prev.onOpenDetail === next.onOpenDetail &&
    prev.onToggleSelect === next.onToggleSelect &&
    prev.onChanged === next.onChanged,
);
