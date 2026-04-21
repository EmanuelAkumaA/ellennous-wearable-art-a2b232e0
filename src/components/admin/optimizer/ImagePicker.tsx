import { useEffect, useMemo, useState } from "react";
import { Search, Library, Link2, Loader2, X, CheckSquare, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOptimizedImages, type OptimizedImageWithMeta } from "@/hooks/useOptimizedImages";
import { formatBytes, type OptimizedVariant } from "@/lib/imageSnippet";
import { getBestUrlForPiece } from "@/lib/optimizerUpload";

const BUCKET = "optimized-images";

export interface PickedImage {
  optimizedImageId: string;
  name: string;
  previewUrl: string;
  variants: OptimizedVariant[];
  originalPath: string;
  bestUrl: string;
}

type PickerMode = "gallery" | "cover";

interface ImagePickerProps {
  open: boolean;
  onClose: () => void;
  /** What we're picking for. Cover allows only single selection. */
  defaultMode?: PickerMode;
  /** ids already chosen (in this modal session) so we can disable them. */
  alreadyUsedIds?: Set<string>;
  onConfirm: (images: PickedImage[], mode: PickerMode) => void;
}

const findThumb = (variants: OptimizedVariant[], originalPath: string) => {
  const v =
    variants.find((x) => x.format === "webp" && x.width === 400) ??
    variants.find((x) => x.format === "jpeg" && x.width === 400) ??
    variants.find((x) => x.format === "webp") ??
    variants.find((x) => x.format === "jpeg");
  return v?.url ?? supabase.storage.from(BUCKET).getPublicUrl(originalPath).data.publicUrl;
};

export const ImagePicker = ({
  open,
  onClose,
  defaultMode = "gallery",
  alreadyUsedIds,
  onConfirm,
}: ImagePickerProps) => {
  const [mode, setMode] = useState<PickerMode>(defaultMode);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pieceLinks, setPieceLinks] = useState<Map<string, string>>(new Map());
  const { items, loading } = useOptimizedImages({ readyOnly: true, limit: 200 });

  // Reset state when reopened
  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setSearch("");
      setMode(defaultMode);
    }
  }, [open, defaultMode]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Resolve piece names for linked items so we can show "Vinculada à obra X"
  useEffect(() => {
    const ids = Array.from(
      new Set(items.map((i) => i.piece_id).filter((v): v is string => !!v)),
    );
    if (ids.length === 0) {
      setPieceLinks(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("gallery_pieces").select("id, nome").in("id", ids);
      if (cancelled || !data) return;
      const m = new Map<string, string>();
      for (const p of data) m.set(p.id, p.nome);
      const linkMap = new Map<string, string>();
      for (const it of items) {
        if (it.piece_id && m.has(it.piece_id)) linkMap.set(it.id, m.get(it.piece_id)!);
      }
      setPieceLinks(linkMap);
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const filtered = useMemo(() => {
    if (!debounced) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(debounced) || i.id.toLowerCase().includes(debounced),
    );
  }, [items, debounced]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (mode === "cover") next.clear();
        next.add(id);
      }
      return next;
    });
  };

  const confirm = () => {
    const picked: PickedImage[] = [];
    for (const it of items) {
      if (!selected.has(it.id)) continue;
      const variants = it.variants;
      const previewUrl = findThumb(variants, it.original_path);
      const bestUrl = getBestUrlForPiece(variants, previewUrl);
      picked.push({
        optimizedImageId: it.id,
        name: it.name,
        previewUrl,
        variants,
        originalPath: it.original_path,
        bestUrl,
      });
    }
    onConfirm(picked, mode);
    onClose();
  };

  const count = selected.size;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 font-display">
            <Library className="h-5 w-5 text-primary-glow" /> Reaproveitar do histórico
          </DialogTitle>
          <DialogDescription>
            Reuse imagens já otimizadas em vez de fazer novo upload.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b border-border/40 space-y-3">
          <Tabs value={mode} onValueChange={(v) => setMode(v as PickerMode)}>
            <TabsList>
              <TabsTrigger value="gallery">Galeria (várias)</TabsTrigger>
              <TabsTrigger value="cover">Capa (uma)</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-md bg-secondary/30 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma imagem otimizada disponível.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {filtered.map((img) => (
                <PickerThumb
                  key={img.id}
                  image={img}
                  selected={selected.has(img.id)}
                  alreadyUsed={alreadyUsedIds?.has(img.id) ?? false}
                  pieceName={pieceLinks.get(img.id) ?? null}
                  onToggle={() => toggle(img.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {count > 0
              ? `${count} selecionada${count > 1 ? "s" : ""}`
              : "Nenhuma seleção"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="rounded-none font-accent tracking-[0.2em] uppercase text-xs">
              Cancelar
            </Button>
            <Button
              onClick={confirm}
              disabled={count === 0}
              className="rounded-none font-accent tracking-[0.2em] uppercase text-xs"
            >
              Adicionar ({count})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PickerThumb = ({
  image,
  selected,
  alreadyUsed,
  pieceName,
  onToggle,
}: {
  image: OptimizedImageWithMeta;
  selected: boolean;
  alreadyUsed: boolean;
  pieceName: string | null;
  onToggle: () => void;
}) => {
  const previewUrl = findThumb(image.variants, image.original_path);
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={alreadyUsed}
      className={`relative group aspect-square rounded-md overflow-hidden border text-left transition-all ${
        selected
          ? "border-primary ring-2 ring-primary/60"
          : alreadyUsed
            ? "border-border/30 opacity-50 cursor-not-allowed"
            : "border-border/40 hover:border-primary/40"
      }`}
    >
      <img
        src={previewUrl}
        alt={image.name}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent pointer-events-none" />
      <span className="absolute top-1.5 left-1.5 inline-flex items-center justify-center h-5 w-5 rounded-md bg-background/80 backdrop-blur border border-border/60">
        {selected ? (
          <CheckSquare className="h-3 w-3 text-primary-glow" />
        ) : (
          <Square className="h-3 w-3 text-muted-foreground" />
        )}
      </span>
      {pieceName && (
        <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 max-w-[70%] rounded bg-primary/80 text-primary-foreground text-[8px] font-accent tracking-[0.2em] uppercase px-1.5 py-0.5 truncate">
          <Link2 className="h-2 w-2 shrink-0" />
          <span className="truncate">{pieceName}</span>
        </span>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1">
        <p className="text-[10px] text-foreground truncate font-medium" title={image.name}>
          {image.name}
        </p>
        <p className="text-[9px] text-muted-foreground/80 font-mono">
          {formatBytes(image.original_size_bytes)}
        </p>
      </div>
      {alreadyUsed && (
        <span className="absolute inset-0 flex items-center justify-center bg-background/70 text-[9px] font-accent tracking-[0.2em] uppercase">
          Já adicionada
        </span>
      )}
    </button>
  );
};
