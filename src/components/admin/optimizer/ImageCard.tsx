import { useState } from "react";
import { Code2, Trash2, RefreshCw, Loader2, Star, AlertCircle, CheckCircle2, Eye } from "lucide-react";
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
}

const BUCKET = "optimized-images";

export const ImageCard = ({ image, onOpenSnippet, onOpenDetail, onChanged }: ImageCardProps) => {
  const [busy, setBusy] = useState<null | "delete" | "reprocess" | "use">(null);

  const previewUrl =
    image.variants.find((v) => v.format === "webp" && v.width === 800)?.url ??
    image.variants.find((v) => v.format === "jpeg")?.url ??
    supabase.storage.from(BUCKET).getPublicUrl(image.original_path).data.publicUrl;

  // Smarter savings: compare original vs the JPEG fallback the browser will pick
  const fallbackJpeg = image.variants.find((v) => v.format === "jpeg" && v.width === 800)
    ?? image.variants.find((v) => v.format === "jpeg");
  const savings = fallbackJpeg && image.original_size_bytes
    ? Math.max(0, Math.round(((image.original_size_bytes - fallbackJpeg.size_bytes) / image.original_size_bytes) * 100))
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

  return (
    <div className="group relative rounded-lg border border-border/40 bg-card/40 backdrop-blur overflow-hidden hover:border-primary/40 transition-colors">
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
          <span>{image.variants.length} variantes</span>
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
