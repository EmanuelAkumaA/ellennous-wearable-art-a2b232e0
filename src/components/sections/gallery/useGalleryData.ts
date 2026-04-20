import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PieceData {
  id: string;
  nome: string;
  categoria: string;
  imagens: string[];
  capa: string;
  descricao: string;
  conceito: string;
  historia: string;
  tempo: string;
  destaque: boolean;
  novo: boolean;
  ordem: number;
}

export const useGalleryData = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [pieces, setPieces] = useState<PieceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [catsRes, piecesRes] = await Promise.all([
        supabase.from("gallery_categories").select("nome").order("ordem", { ascending: true }),
        supabase
          .from("gallery_pieces")
          .select("id, nome, descricao, conceito, historia, tempo, destaque, novo, ordem, cover_url, gallery_categories(nome), gallery_piece_images(id, url, ordem)")
          .order("ordem", { ascending: true }),
      ]);
      if (catsRes.data) setCategories(catsRes.data.map((c) => c.nome));
      if (piecesRes.data) {
        setPieces(
          piecesRes.data.map((p) => {
            const pAny = p as typeof p & { cover_url?: string | null };
            const sortedImages = [...(p.gallery_piece_images ?? [])].sort((a, b) => a.ordem - b.ordem);
            const urls = sortedImages.map((i) => i.url);
            const capa = pAny.cover_url ?? urls[0] ?? "";
            return {
              id: p.id,
              nome: p.nome,
              categoria: p.gallery_categories?.nome ?? "",
              imagens: urls,
              capa,
              descricao: p.descricao ?? "",
              conceito: p.conceito ?? "",
              historia: p.historia ?? "",
              tempo: p.tempo ?? "",
              destaque: p.destaque,
              novo: p.novo,
              ordem: p.ordem,
            };
          }),
        );
      }
      setLoading(false);
    };
    load();
  }, []);

  return { categories, pieces, loading };
};
