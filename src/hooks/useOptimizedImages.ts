import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OptimizedImage } from "@/components/admin/optimizer/ImageCard";
import type { OptimizedVariant } from "@/lib/imageSnippet";

export type OptimizedImageWithMeta = OptimizedImage & {
  piece_id?: string | null;
  image_role?: string | null;
};

interface Options {
  readyOnly?: boolean;
  limit?: number;
}

/**
 * Loads optimized_images. Used by the Otimizador page and the modal picker.
 * Subscribes to realtime updates so newly-ready images appear automatically.
 */
export const useOptimizedImages = ({ readyOnly = false, limit = 200 }: Options = {}) => {
  const [items, setItems] = useState<OptimizedImageWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const query = supabase
      .from("optimized_images")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (readyOnly) query.eq("status", "ready");
    const { data, error } = await query;
    if (!error && data) {
      setItems(
        data.map((d) => ({
          ...d,
          variants: (d.variants as unknown as OptimizedVariant[]) ?? [],
        })) as OptimizedImageWithMeta[],
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`optimized_images_hook_${readyOnly ? "ready" : "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "optimized_images" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyOnly, limit]);

  return { items, loading, reload: load };
};
