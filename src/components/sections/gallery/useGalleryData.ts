import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deriveGalleryVariants } from "@/lib/galleryUploader";
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
  cover_url_mobile?: string | null;
  cover_url_tablet?: string | null;
  gallery_categories: { nome: string } | null;
  gallery_piece_images: Array<{ id: string; url: string; ordem: number }> | null;
};

const PRESET_WIDTHS = { mobile: 480, tablet: 768, desktop: 1200 } as const;

/** Builds 3 webp variants when at least one explicit per-device cover is set. */
const buildCoverVariants = (
  desktop: string | null,
  mobile: string | null,
  tablet: string | null,
): OptimizedVariant[] | null => {
  if (!desktop && !mobile && !tablet) return null;
  const fallback = desktop ?? mobile ?? tablet ?? "";
  const make = (label: "mobile" | "tablet" | "desktop", url: string): OptimizedVariant => ({
    width: PRESET_WIDTHS[label],
    format: "webp",
    device_label: label,
    path: "",
    url,
    size_bytes: 0,
  });
  return [
    make("mobile", mobile ?? fallback),
    make("tablet", tablet ?? fallback),
    make("desktop", desktop ?? fallback),
  ];
};

const buildPieces = (rawPieces: RawPiece[]): PieceData[] =>
  rawPieces.map((p) => {
    const sortedImages = [...(p.gallery_piece_images ?? [])].sort((a, b) => a.ordem - b.ordem);
    const urls = sortedImages.map((i) => i.url);
    const capa = p.cover_url ?? urls[0] ?? "";
    const imagensData: PieceImageData[] = urls.map((url) => ({
      url,
      variants: deriveGalleryVariants(url),
    }));
    // Prefer explicit per-device covers; fall back to deriving from desktop URL.
    const explicitCover = buildCoverVariants(p.cover_url ?? null, p.cover_url_mobile ?? null, p.cover_url_tablet ?? null);
    const capaVariants = explicitCover ?? (capa ? deriveGalleryVariants(capa) : null);
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [catsRes, piecesRes] = await Promise.all([
        supabase.from("gallery_categories").select("nome").order("ordem", { ascending: true }),
        supabase
          .from("gallery_pieces")
          .select(
            "id, nome, descricao, conceito, historia, tempo, destaque, novo, ordem, cover_url, gallery_categories(nome), gallery_piece_images(id, url, ordem)",
          )
          .order("ordem", { ascending: true }),
      ]);
      if (catsRes.data) setCategories(catsRes.data.map((c) => c.nome));
      const raw = (piecesRes.data ?? []) as unknown as RawPiece[];
      setRawPieces(raw);
      setLoading(false);
    };
    load();
  }, []);

  // Pure derivation: variants are derived from the URL by filename convention.
  const pieces = useMemo(() => buildPieces(rawPieces), [rawPieces]);

  return { categories, pieces, loading };
};
