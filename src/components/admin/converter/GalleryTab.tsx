import { useEffect, useMemo, useState } from "react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, Star, Link2, RefreshCw, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  listStaging, discardStaging, attachStagingToPiece, type StagingRow,
} from "@/lib/galleryStaging";
import { removeGalleryVariants, deriveGalleryVariants } from "@/lib/galleryUploader";
import { formatBytes } from "@/lib/imageSnippet";
import { AssociatePieceDialog } from "./AssociatePieceDialog";

interface PieceRow {
  id: string;
  nome: string;
  cover_url: string | null;
  cover_storage_path: string | null;
  gallery_categories: { nome: string } | null;
  gallery_piece_images: Array<{
    id: string;
    url: string;
    storage_path: string | null;
    ordem: number;
    variant_overrides: Record<string, boolean> | null;
  }>;
}

interface GalleryTabProps {
  refreshKey: number;
}

const VARIANT_LABELS: Array<{ key: "mobile" | "tablet" | "desktop"; label: string; px: number }> = [
  { key: "mobile",  label: "Mobile",  px: 480 },
  { key: "tablet",  label: "Tablet",  px: 768 },
  { key: "desktop", label: "Desktop", px: 1200 },
];

export const GalleryTab = ({ refreshKey }: GalleryTabProps) => {
  const [staging, setStaging] = useState<StagingRow[]>([]);
  const [pieces, setPieces] = useState<PieceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [associateTarget, setAssociateTarget] = useState<StagingRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [stg, pcs] = await Promise.all([
        listStaging(),
        supabase
          .from("gallery_pieces")
          .select("id, nome, cover_url, cover_storage_path, gallery_categories(nome), gallery_piece_images(id, url, storage_path, ordem, variant_overrides)")
          .order("ordem", { ascending: true }),
      ]);
      setStaging(stg);
      if (pcs.error) throw pcs.error;
      const sorted = (pcs.data ?? []).map((p) => ({
        ...p,
        gallery_piece_images: [...(p.gallery_piece_images ?? [])].sort((a, b) => a.ordem - b.ordem),
      })) as PieceRow[];
      setPieces(sorted);
    } catch (e) {
      toast({ title: "Erro ao carregar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleDiscardStaging = async (row: StagingRow) => {
    if (!confirm(`Descartar "${row.original_filename}"? Os arquivos serão removidos do bucket.`)) return;
    try {
      await discardStaging(row.id);
      toast({ title: "Descartado" });
      await load();
    } catch (e) {
      toast({ title: "Erro ao descartar", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleAttach = async (pieceId: string, asCover: boolean) => {
    if (!associateTarget) return;
    await attachStagingToPiece(associateTarget.id, pieceId, { asCover });
    toast({ title: asCover ? "Capa atualizada" : "Imagem associada" });
    setAssociateTarget(null);
    await load();
  };

  const handlePromoteCover = async (piece: PieceRow, imageId: string, url: string, path: string | null) => {
    if (!confirm("Definir esta imagem como capa da obra?")) return;
    try {
      // Move existing cover into the gallery (if any) so nothing is lost
      if (piece.cover_url && piece.cover_storage_path) {
        const newOrdem = piece.gallery_piece_images.length;
        await supabase.from("gallery_piece_images").insert({
          piece_id: piece.id,
          url: piece.cover_url,
          storage_path: piece.cover_storage_path,
          ordem: newOrdem,
        });
      }
      await supabase.from("gallery_piece_images").delete().eq("id", imageId);
      const { error } = await supabase
        .from("gallery_pieces")
        .update({ cover_url: url, cover_storage_path: path })
        .eq("id", piece.id);
      if (error) throw error;
      toast({ title: "Capa definida" });
      await load();
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteImage = async (imageId: string, path: string | null) => {
    if (!confirm("Remover esta imagem? Os 3 arquivos webp serão excluídos.")) return;
    try {
      if (path) await removeGalleryVariants(path);
      const { error } = await supabase.from("gallery_piece_images").delete().eq("id", imageId);
      if (error) throw error;
      toast({ title: "Removida" });
      await load();
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleToggleVariant = async (
    imageId: string,
    overrides: Record<string, boolean> | null,
    key: "mobile" | "tablet" | "desktop",
  ) => {
    const current = overrides ?? {};
    const next = { ...current, [key]: !(current[key] ?? true) };
    // If everything is back to default (all true), clear the column.
    const allDefault = next.mobile !== false && next.tablet !== false && next.desktop !== false;
    try {
      await supabase
        .from("gallery_piece_images")
        .update({ variant_overrides: allDefault ? null : next })
        .eq("id", imageId);
      await load();
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    }
  };

  const totalImages = useMemo(
    () => pieces.reduce((sum, p) => sum + p.gallery_piece_images.length, 0),
    [pieces],
  );

  if (loading) {
    return (
      <div className="glass-card p-12 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* STAGING */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-accent text-[11px] tracking-[0.3em] uppercase text-primary-glow flex items-center gap-2">
            <span className="h-px w-6 bg-primary-glow" />
            Staging — não associadas
            <span className="text-muted-foreground">({staging.length})</span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px]"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
        </div>
        {staging.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">
            Nenhuma imagem em staging.
            <br />
            <span className="text-xs">
              Use o botão <strong>"Enviar p/ galeria"</strong> em uma conversão pronta para subir as 3 variantes aqui.
            </span>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {staging.map((row) => {
              const sizes = (row.sizes as Record<string, number>) ?? {};
              const total = (sizes.mobile ?? 0) + (sizes.tablet ?? 0) + (sizes.desktop ?? 0);
              return (
                <article key={row.id} className="glass-card p-3 space-y-3">
                  <div className="aspect-square bg-secondary/30 rounded-md overflow-hidden">
                    <img src={row.desktop_url} alt={row.original_filename} className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs truncate font-display" title={row.original_filename}>{row.original_filename}</p>
                    <p className="text-[10px] font-accent tracking-[0.25em] uppercase text-muted-foreground">
                      3 variantes · {formatBytes(total)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setAssociateTarget(row)}
                      className="flex-1 rounded-none font-accent tracking-[0.2em] uppercase text-[10px] bg-gradient-purple-wine"
                    >
                      <Link2 className="h-3 w-3 mr-1" /> Associar
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDiscardStaging(row)}
                      className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive"
                      title="Descartar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* GALLERY BY PIECE */}
      <section className="space-y-3">
        <h3 className="font-accent text-[11px] tracking-[0.3em] uppercase text-primary-glow flex items-center gap-2">
          <span className="h-px w-6 bg-primary-glow" />
          Galeria por obra
          <span className="text-muted-foreground">({pieces.length} obras · {totalImages} imagens)</span>
        </h3>
        {pieces.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">Nenhuma obra cadastrada ainda.</div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {pieces.map((piece) => (
              <AccordionItem key={piece.id} value={piece.id} className="glass-card border-border/40 rounded-md overflow-hidden">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded bg-secondary/30 overflow-hidden shrink-0">
                      {piece.cover_url ? (
                        <img src={piece.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground/40" /></div>
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-display truncate">{piece.nome}</p>
                      <p className="text-[10px] font-accent tracking-[0.2em] uppercase text-muted-foreground">
                        {piece.gallery_categories?.nome ?? "Sem categoria"} · {piece.gallery_piece_images.length} img
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {piece.gallery_piece_images.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sem imagens na galeria.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {piece.gallery_piece_images.map((img) => {
                        const overrides = (img.variant_overrides ?? {}) as Record<string, boolean>;
                        const variants = img.url ? deriveGalleryVariants(img.url) : null;
                        return (
                          <div key={img.id} className="bg-card/40 border border-border/40 rounded-md p-3 space-y-2">
                            <div className="aspect-square rounded overflow-hidden bg-secondary/30">
                              <img src={img.url} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {VARIANT_LABELS.map((v) => {
                                const enabled = overrides[v.key] ?? true;
                                const exists = variants?.some((x) => x.device_label === v.key);
                                return (
                                  <button
                                    key={v.key}
                                    type="button"
                                    onClick={() => handleToggleVariant(img.id, img.variant_overrides, v.key)}
                                    title={`${v.label} (${v.px}px) — ${enabled ? "ativa" : "inativa"}`}
                                    className={`px-2 py-1 rounded text-[9px] font-accent tracking-[0.2em] uppercase transition-colors ${
                                      enabled
                                        ? "bg-primary/15 text-primary-glow hover:bg-primary/25"
                                        : "bg-muted/30 text-muted-foreground line-through"
                                    } ${!exists ? "opacity-50" : ""}`}
                                  >
                                    {v.label}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePromoteCover(piece, img.id, img.url, img.storage_path)}
                                className="flex-1 rounded-none font-accent tracking-[0.2em] uppercase text-[9px] h-7"
                                title="Definir como capa"
                              >
                                <Star className="h-3 w-3 mr-1" /> Capa
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteImage(img.id, img.storage_path)}
                                className="rounded-none font-accent tracking-[0.2em] uppercase text-[9px] h-7 hover:bg-destructive/15 hover:text-destructive"
                                title="Remover"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </section>

      <AssociatePieceDialog
        open={!!associateTarget}
        onOpenChange={(o) => !o && setAssociateTarget(null)}
        onConfirm={handleAttach}
        title={associateTarget ? `Associar "${associateTarget.original_filename}"` : "Associar"}
      />
    </div>
  );
};
