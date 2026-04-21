import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadOptimizedMap, findVariantsForUrl, type OptimizedMap } from "@/lib/optimizedImageMap";
import type { OptimizedVariant } from "@/lib/imageSnippet";

export interface PieceImageData {
  url: string;
  variants: OptimizedVariant[] | null;
}

export interface PieceData {
  id: string;
  nome: string;
  categoria: string;
  imagens: string[];
  imagensData: PieceImageData[];
  capa: string;
  capaVariants: OptimizedVariant[] | null;
  descricao: string;
  conceito: string;
  historia: string;
  tempo: string;
  destaque: boolean;
  novo: boolean;
  ordem: number;
}

const buildPieces = (
  rawPieces: Array<{
    id: string;
    nome: string;
    descricao: string | null;
    conceito: string | null;
    historia: string | null;
    tempo: string | null;
    destaque: boolean;
    novo: boolean;
    ordem: number;
    cover_url?: string | null;
    gallery_categories: { nome: string } | null;
    gallery_piece_images: Array<{ id: string; url: string; ordem: number }> | null;
  }>,
  optimizedMap: OptimizedMap,
): PieceData[] =>
  rawPieces.map((p) => {
    const sortedImages = [...(p.gallery_piece_images ?? [])].sort((a, b) => a.ordem - b.ordem);
    const urls = sortedImages.map((i) => i.url);
    const capa = p.cover_url ?? urls[0] ?? "";
    const imagensData: PieceImageData[] = urls.map((url) => ({
      url,
      variants: findVariantsForUrl(url, optimizedMap),
    }));
    return {
      id: p.id,
      nome: p.nome,
      categoria: p.gallery_categories?.nome ?? "",
      imagens: urls,
      imagensData,
      capa,
      descricao: p.descricao ?? "",
      conceito: p.conceito ?? "",
      historia: p.historia ?? "",
      tempo: p.tempo ?? "",
      destaque: p.destaque,
      novo: p.novo,
      ordem: p.ordem,
    };
  });

export const useGalleryData = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [pieces, setPieces] = useState<PieceData[]>([]);
  const [rawPieces, setRawPieces] = useState<Parameters<typeof buildPieces>[0]>([]);
  const [optimizedMap, setOptimizedMap] = useState<OptimizedMap>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [catsRes, piecesRes, mapRes] = await Promise.all([
        supabase.from("gallery_categories").select("nome").order("ordem", { ascending: true }),
        supabase
          .from("gallery_pieces")
          .select("id, nome, descricao, conceito, historia, tempo, destaque, novo, ordem, cover_url, gallery_categories(nome), gallery_piece_images(id, url, ordem)")
          .order("ordem", { ascending: true }),
        loadOptimizedMap(),
      ]);
      if (catsRes.data) setCategories(catsRes.data.map((c) => c.nome));
      const raw = (piecesRes.data ?? []) as unknown as Parameters<typeof buildPieces>[0];
      setRawPieces(raw);
      setOptimizedMap(mapRes);
      setPieces(buildPieces(raw, mapRes));
      setLoading(false);
    };
    load();
  }, []);

  // Realtime: refresh optimized map when an image becomes ready (debounced).
  useEffect(() => {
    let timeout: number | null = null;
    const refresh = () => {
      if (timeout != null) window.clearTimeout(timeout);
      timeout = window.setTimeout(async () => {
        const fresh = await loadOptimizedMap();
        setOptimizedMap(fresh);
        setPieces(buildPieces(rawPieces, fresh));
      }, 500);
    };
    const channel = supabase
      .channel("optimized_images_gallery")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "optimized_images" },
        refresh,
      )
      .subscribe();
    return () => {
      if (timeout != null) window.clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [rawPieces]);

  return { categories, pieces, loading };
};
