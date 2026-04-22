import { useEffect, useMemo, useState } from "react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Star, Link2, RefreshCw, Image as ImageIcon, MoveRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  listStaging, discardStaging, attachStagingToPiece, type StagingRow,
} from "@/lib/galleryStaging";
import { removeGalleryVariants, deriveGalleryVariants } from "@/lib/galleryUploader";
import { formatBytes } from "@/lib/imageSnippet";
import { AssociatePieceDialog } from "./AssociatePieceDialog";
import { VariantGrid, type VariantKey, type VariantSlot } from "./VariantGrid";

interface PieceRow {
  id: string;
  nome: string;
  cover_url: string | null;
  cover_storage_path: string | null;
  cover_url_mobile: string | null;
  cover_path_mobile: string | null;
  cover_url_tablet: string | null;
  cover_path_tablet: string | null;
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

const PRESET_WIDTHS: Record<VariantKey, number> = { mobile: 480, tablet: 768, desktop: 1200 };

/**
 * Builds the URL for a specific variant from a desktop URL like
 * `…/{folder}/desktop.webp` → `…/{folder}/{key}.webp`. Returns null when the
 * URL doesn't match the convention (legacy images).
 */
const variantUrlFromDesktop = (desktopUrl: string, key: VariantKey): string | null => {
  const match = desktopUrl.match(/^(.*)\/desktop\.webp(\?.*)?$/);
  if (!match) return null;
  return `${match[1]}/${key}.webp${match[2] ?? ""}`;
};

const variantPathFromDesktop = (desktopPath: string | null, key: VariantKey): string | null => {
  if (!desktopPath || !desktopPath.endsWith("/desktop.webp")) return null;
  const folder = desktopPath.slice(0, -"/desktop.webp".length);
  return `${folder}/${key}.webp`;
};

export const GalleryTab = ({ refreshKey }: GalleryTabProps) => {
  const [staging, setStaging] = useState<StagingRow[]>([]);
  const [pieces, setPieces] = useState<PieceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [associateTarget, setAssociateTarget] = useState<StagingRow | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ pieceId: string; imageId: string; url: string; path: string | null } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [stg, pcs] = await Promise.all([
        listStaging(),
        supabase
          .from("gallery_pieces")
          .select("id, nome, cover_url, cover_storage_path, cover_url_mobile, cover_path_mobile, cover_url_tablet, cover_path_tablet, gallery_categories(nome), gallery_piece_images(id, url, storage_path, ordem, variant_overrides)")
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

  /** Move an existing image (3 variants) from one piece to another. */
  const handleMoveImage = async (toPieceId: string) => {
    if (!moveTarget) return;
    try {
      // Compute next ordem on destination piece
      const { count } = await supabase
        .from("gallery_piece_images")
        .select("id", { count: "exact", head: true })
        .eq("piece_id", toPieceId);
      const nextOrdem = count ?? 0;
      const { error } = await supabase
        .from("gallery_piece_images")
        .update({ piece_id: toPieceId, ordem: nextOrdem })
        .eq("id", moveTarget.imageId);
      if (error) throw error;
      toast({ title: "Imagem movida" });
      setMoveTarget(null);
      await load();
    } catch (e) {
      toast({ title: "Erro ao mover", description: (e as Error).message, variant: "destructive" });
    }
  };

  /**
   * Sets a specific device variant of this image as the cover for that device.
   * Desktop uses the legacy `cover_url`/`cover_storage_path` columns.
   */
  const handleSetCoverPerDevice = async (
    piece: PieceRow,
    image: PieceRow["gallery_piece_images"][number],
    key: VariantKey,
  ) => {
    const url = key === "desktop" ? image.url : variantUrlFromDesktop(image.url, key);
    const path = key === "desktop" ? image.storage_path : variantPathFromDesktop(image.storage_path, key);
    if (!url) {
      toast({ title: "Variante indisponível", description: "Esta imagem não segue o padrão responsivo.", variant: "destructive" });
      return;
    }
    const patch =
      key === "mobile"
        ? { cover_url_mobile: url, cover_path_mobile: path }
        : key === "tablet"
        ? { cover_url_tablet: url, cover_path_tablet: path }
        : { cover_url: url, cover_storage_path: path };
    try {
      const { error } = await supabase.from("gallery_pieces").update(patch).eq("id", piece.id);
      if (error) throw error;
      toast({ title: `Capa ${key === "mobile" ? "Mobile" : key === "tablet" ? "Tablet" : "Desktop"} definida` });
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
    key: VariantKey,
  ) => {
    const current = overrides ?? {};
    const next = { ...current, [key]: !(current[key] ?? true) };
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
          <div className="grid md:grid-cols-2 gap-4">
            {staging.map((row) => {
              const sizes = (row.sizes as Record<string, number>) ?? {};
              const total = (sizes.mobile ?? 0) + (sizes.tablet ?? 0) + (sizes.desktop ?? 0);
              const slots: VariantSlot[] = (["mobile", "tablet", "desktop"] as VariantKey[]).map((key) => ({
                key,
                url: variantUrlFromDesktop(row.desktop_url, key) ?? (key === "desktop" ? row.desktop_url : null),
                width: PRESET_WIDTHS[key],
                sizeBytes: sizes[key],
              }));
              return (
                <article key={row.id} className="glass-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-display truncate" title={row.original_filename}>{row.original_filename}</p>
                      <p className="text-[10px] font-accent tracking-[0.25em] uppercase text-muted-foreground mt-0.5">
                        3 variantes · {formatBytes(total)}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDiscardStaging(row)}
                      className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive shrink-0"
                      title="Descartar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <VariantGrid slots={slots} size="compact" />
                  <Button
                    size="sm"
                    onClick={() => setAssociateTarget(row)}
                    className="w-full rounded-none font-accent tracking-[0.25em] uppercase text-[10px] bg-gradient-purple-wine"
                  >
                    <Link2 className="h-3 w-3 mr-1" /> Associar a uma obra
                  </Button>
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
                        <img src={piece.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
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
                <AccordionContent className="px-4 pb-4 space-y-4">
                  {/* Cover summary per device */}
                  <div className="rounded-md bg-card/30 border border-border/30 p-3">
                    <p className="font-accent text-[9px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
                      Capas atuais por dispositivo
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      {(["mobile", "tablet", "desktop"] as VariantKey[]).map((key) => {
                        const url =
                          key === "mobile" ? (piece.cover_url_mobile ?? piece.cover_url) :
                          key === "tablet" ? (piece.cover_url_tablet ?? piece.cover_url) :
                          piece.cover_url;
                        const usingFallback =
                          (key === "mobile" && !piece.cover_url_mobile) ||
                          (key === "tablet" && !piece.cover_url_tablet);
                        return (
                          <div key={key} className="flex flex-col items-center gap-1">
                            <span className="font-accent tracking-[0.2em] uppercase text-primary-glow text-[9px]">
                              {key === "mobile" ? "📱 Mobile" : key === "tablet" ? "💻 Tablet" : "🖥 Desktop"}
                            </span>
                            <div className="w-full aspect-square bg-secondary/30 rounded overflow-hidden flex items-center justify-center">
                              {url ? (
                                <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                              )}
                            </div>
                            {usingFallback && url && (
                              <span className="text-[8px] font-accent tracking-[0.2em] uppercase text-muted-foreground/70">
                                ↳ usando desktop
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {piece.gallery_piece_images.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sem imagens na galeria.</p>
                  ) : (
                    <div className="space-y-4">
                      {piece.gallery_piece_images.map((img, idx) => {
                        const overrides = (img.variant_overrides ?? {}) as Record<string, boolean>;
                        const desktopVariants = img.url ? deriveGalleryVariants(img.url) : null;
                        const slots: VariantSlot[] = (["mobile", "tablet", "desktop"] as VariantKey[]).map((key) => {
                          const url =
                            key === "desktop"
                              ? img.url
                              : variantUrlFromDesktop(img.url, key);
                          const isCover =
                            key === "mobile"
                              ? piece.cover_url_mobile === url
                              : key === "tablet"
                              ? piece.cover_url_tablet === url
                              : piece.cover_url === url;
                          return {
                            key,
                            url,
                            width: PRESET_WIDTHS[key],
                            active: overrides[key] ?? true,
                            isCover,
                            onToggleActive: () => handleToggleVariant(img.id, img.variant_overrides, key),
                            actions: (
                              <Button
                                size="sm"
                                variant={isCover ? "default" : "outline"}
                                onClick={() => handleSetCoverPerDevice(piece, img, key)}
                                disabled={isCover || !url}
                                className={`rounded-none font-accent tracking-[0.2em] uppercase text-[9px] h-7 ${
                                  isCover ? "bg-gradient-purple-wine" : ""
                                }`}
                                title={isCover ? "Já é a capa" : `Definir como capa ${key}`}
                              >
                                <Star className="h-3 w-3 mr-1" />
                                {isCover ? "★ Capa" : "Capa"}
                              </Button>
                            ),
                          };
                        });
                        return (
                          <div key={img.id} className="bg-card/40 border border-border/40 rounded-md p-3 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                                Imagem #{idx + 1}
                              </span>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setMoveTarget({ pieceId: piece.id, imageId: img.id, url: img.url, path: img.storage_path })}
                                  className="rounded-none font-accent tracking-[0.2em] uppercase text-[9px] h-7"
                                  title="Mover este registro inteiro para outra obra"
                                >
                                  <MoveRight className="h-3 w-3 mr-1" /> Mover
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteImage(img.id, img.storage_path)}
                                  className="rounded-none font-accent tracking-[0.2em] uppercase text-[9px] h-7 hover:bg-destructive/15 hover:text-destructive"
                                  title="Excluir o registro completo (3 arquivos)"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <VariantGrid slots={slots} />
                            {!desktopVariants && (
                              <p className="text-[9px] font-accent tracking-[0.2em] uppercase text-muted-foreground/70 italic">
                                Imagem legada — sem variantes responsivas detectadas.
                              </p>
                            )}
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

      <AssociatePieceDialog
        open={!!moveTarget}
        onOpenChange={(o) => !o && setMoveTarget(null)}
        onConfirm={(pid) => handleMoveImage(pid)}
        title="Mover imagem para outra obra"
      />
    </div>
  );
};
