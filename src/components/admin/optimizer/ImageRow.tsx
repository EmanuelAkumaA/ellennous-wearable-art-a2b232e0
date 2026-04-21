import { useState } from "react";
import {
  Code2,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Eye,
  CheckSquare,
  Square,
  Smartphone,
  Tablet,
  Monitor,
  Link2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBytes } from "@/lib/imageSnippet";
import type { OptimizedImage } from "./ImageCard";

const BUCKET = "optimized-images";

export interface PieceLink {
  pieceId: string;
  pieceName: string;
}

interface ImageRowProps {
  image: OptimizedImage & { piece_id?: string | null; image_role?: string | null };
  pieceLink?: PieceLink | null;
  onOpenSnippet: (img: OptimizedImage) => void;
  onOpenDetail: (img: OptimizedImage) => void;
  onChanged: () => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  selectionMode?: boolean;
}

const findVariant = (
  image: OptimizedImage,
  width: number,
  format: "jpeg" | "webp" | "avif" = "jpeg",
) => image.variants.find((v) => v.format === format && v.width === width);

export const ImageRow = ({
  image,
  pieceLink,
  onOpenSnippet,
  onOpenDetail,
  onChanged,
  selected = false,
  onToggleSelect,
  selectionMode = false,
}: ImageRowProps) => {
  const [busy, setBusy] = useState<null | "delete" | "reprocess" | "use">(null);

  const previewUrl =
    findVariant(image, 400, "webp")?.url ??
    findVariant(image, 800, "webp")?.url ??
    findVariant(image, 800, "jpeg")?.url ??
    supabase.storage.from(BUCKET).getPublicUrl(image.original_path).data.publicUrl;

  const mobile = findVariant(image, 400, "jpeg");
  const tablet = findVariant(image, 800, "jpeg");
  const desktop = findVariant(image, 1200, "jpeg");

  const isLinked = !!pieceLink;
  const isActive = isLinked || image.used_count > 0;

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

  const toggleActive = async () => {
    if (isLinked) return; // readonly when linked to a piece
    setBusy("use");
    try {
      await supabase
        .from("optimized_images")
        .update({ used_count: image.used_count > 0 ? 0 : 1 })
        .eq("id", image.id);
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const handleRowBackgroundClick = (e: React.MouseEvent) => {
    if (!selectionMode || !onToggleSelect) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a, [role='switch'], label")) return;
    onToggleSelect(image.id);
  };

  const DeviceChip = ({
    icon: Icon,
    label,
    variant,
  }: {
    icon: typeof Smartphone;
    label: string;
    variant: ReturnType<typeof findVariant>;
  }) => {
    const original = image.original_size_bytes;
    let savedPct: number | null = null;
    let savedBytes = 0;
    if (variant && original > 0) {
      savedBytes = original - variant.size_bytes;
      savedPct = Math.round((savedBytes / original) * 100);
    }
    const tone =
      savedPct === null
        ? "bg-secondary/20 text-muted-foreground/50"
        : savedPct >= 50
          ? "bg-emerald-500/15 text-emerald-300"
          : savedPct >= 0
            ? "bg-amber-500/15 text-amber-300"
            : "bg-destructive/15 text-destructive";
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-mono tabular-nums ${tone}`}
            >
              <Icon className="h-3 w-3" />
              <span className="font-accent text-[8px] tracking-[0.2em] uppercase opacity-60">{label}</span>
              <span>{variant ? formatBytes(variant.size_bytes) : "—"}</span>
              {savedPct !== null && (
                <span className="font-accent text-[9px] tracking-wide opacity-90">
                  {savedPct >= 0 ? "−" : "+"}
                  {Math.abs(savedPct)}%
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {variant
              ? `${variant.width}px · ${variant.format.toUpperCase()}${
                  savedBytes > 0 ? ` · ${formatBytes(savedBytes)} economizados` : ""
                }`
              : "Variante não disponível"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div
      onClick={handleRowBackgroundClick}
      className={`group relative rounded-lg border bg-card/40 backdrop-blur transition-all ${
        selected
          ? "border-primary ring-2 ring-primary/50"
          : "border-border/40 hover:border-primary/30"
      } ${selectionMode ? "cursor-pointer" : ""}`}
    >
      <div className="flex flex-col sm:flex-row gap-3 p-3">
        {/* Selection checkbox */}
        {onToggleSelect && (
          <label
            className={`absolute top-2 left-2 z-10 sm:static sm:self-center flex items-center justify-center h-6 w-6 rounded-md border bg-background/80 backdrop-blur cursor-pointer transition-all shrink-0 ${
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 hover:border-primary/60"
            } ${selectionMode || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 sm:opacity-100"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(image.id)}
              className="sr-only"
              aria-label={selected ? "Desmarcar imagem" : "Selecionar imagem"}
            />
            {selected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
          </label>
        )}

        {/* Thumb */}
        <div className="relative w-full sm:w-16 h-32 sm:h-16 shrink-0 rounded-md overflow-hidden bg-secondary/30">
          {image.status === "processing" ? (
            <div className="absolute inset-0 flex items-center justify-center text-primary-glow">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : image.status === "error" ? (
            <div className="absolute inset-0 flex items-center justify-center text-destructive">
              <AlertCircle className="h-5 w-5" />
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
        </div>

        {/* Name + ID + piece link */}
        <div className="min-w-0 flex-1 sm:max-w-[220px] flex flex-col justify-center">
          <p className="text-sm font-medium truncate" title={image.name}>
            {image.name}
          </p>
          <p className="text-[10px] text-muted-foreground/70 font-mono truncate">
            {image.id.slice(0, 8)}…
          </p>
          {pieceLink && (
            <p className="text-[10px] text-primary-glow inline-flex items-center gap-1 mt-1 truncate">
              <Link2 className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{pieceLink.pieceName}</span>
            </p>
          )}
        </div>

        {/* Device sizes */}
        <div className="flex flex-wrap items-center gap-1.5 sm:flex-1 sm:justify-center">
          <DeviceChip icon={Smartphone} label="Mob" variant={mobile} />
          <DeviceChip icon={Tablet} label="Tab" variant={tablet} />
          <DeviceChip icon={Monitor} label="Desk" variant={desktop} />
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-2 sm:w-32 sm:justify-end shrink-0">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isActive}
                    disabled={isLinked || busy === "use"}
                    onCheckedChange={toggleActive}
                    aria-label="Ativa na galeria"
                  />
                  <span
                    className={`text-[10px] font-accent tracking-[0.2em] uppercase ${
                      isActive ? "text-emerald-400" : "text-muted-foreground/60"
                    }`}
                  >
                    {isActive ? "Na galeria" : "Inativa"}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {isLinked
                  ? `Vinculada à obra: ${pieceLink!.pieceName}`
                  : isActive
                    ? "Marcada como em uso"
                    : "Não usada em nenhuma obra"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 sm:self-center">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenSnippet(image); }}
            disabled={image.status !== "ready"}
            title="Ver código"
            className="rounded p-1.5 text-muted-foreground hover:text-primary-glow hover:bg-secondary/60 transition-colors disabled:opacity-30"
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenDetail(image); }}
            title="Detalhes"
            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); reprocess(); }}
            disabled={!!busy || image.status === "processing"}
            title="Reprocessar"
            className="rounded p-1.5 text-muted-foreground hover:text-primary-glow hover:bg-secondary/60 transition-colors disabled:opacity-30"
          >
            {busy === "reprocess" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(); }}
            disabled={!!busy}
            title="Excluir"
            className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
          >
            {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
