import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadOptimizedMap, findVariantsForUrl, type OptimizedMap } from "@/lib/optimizedImageMap";
import type { OptimizedVariant } from "@/lib/imageSnippet";
import { useCoalescedRealtime } from "@/lib/useCoalescedRealtime";

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

type RawPiece = {
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
};

const buildPieces = (rawPieces: RawPiece[], optimizedMap: OptimizedMap): PieceData[] =>
  rawPieces.map((p) => {
    const sortedImages = [...(p.gallery_piece_images ?? [])].sort((a, b) => a.ordem - b.ordem);
    const urls = sortedImages.map((i) => i.url);
    const capa = p.cover_url ?? urls[0] ?? "";
    const imagensData: PieceImageData[] = urls.map((url) => ({
      url,
      variants: findVariantsForUrl(url, optimizedMap),
    }));
    const capaVariants = capa ? findVariantsForUrl(capa, optimizedMap) : null;
    return {
      id: p.id,
      nome: p.nome,
      categoria: p.gallery_categories?.nome ?? "",
      imagens: urls,
      imagensData,
      capa,
      capaVariants,
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
  const [rawPieces, setRawPieces] = useState<RawPiece[]>([]);
  const [optimizedMap, setOptimizedMap] = useState<OptimizedMap>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [catsRes, piecesRes, mapRes] = await Promise.all([
        supabase.from("gallery_categories").select("nome").order("ordem", { ascending: true }),
        supabase
          .from("gallery_pieces")
          .select(
            "id, nome, descricao, conceito, historia, tempo, destaque, novo, ordem, cover_url, gallery_categories(nome), gallery_piece_images(id, url, ordem)",
          )
          .order("ordem", { ascending: true }),
        loadOptimizedMap(),
      ]);
      if (catsRes.data) setCategories(catsRes.data.map((c) => c.nome));
      const raw = (piecesRes.data ?? []) as unknown as RawPiece[];
      setRawPieces(raw);
      setOptimizedMap(mapRes);
      setLoading(false);
    };
    load();
  }, []);

  // Coalesced realtime: refresh optimized map when new images become ready,
  // but suspend while the tab is hidden (visitors don't need live updates).
  useCoalescedRealtime({
    table: "optimized_images",
    channelKey: "gallery",
    debounceMs: 1500,
    pauseWhenHidden: true,
    onChange: async () => {
      const fresh = await loadOptimizedMap();
      setOptimizedMap(fresh);
    },
  });

  // Pure derivation: only recompute when raw data or the optimized map change.
  const pieces = useMemo(() => buildPieces(rawPieces, optimizedMap), [rawPieces, optimizedMap]);

  return { categories, pieces, loading };
};
