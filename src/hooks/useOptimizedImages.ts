import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OptimizedImage } from "@/components/admin/optimizer/ImageCard";
import type { OptimizedVariant } from "@/lib/imageSnippet";
import { useCoalescedRealtime } from "@/lib/useCoalescedRealtime";

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
 * Subscribes to coalesced realtime updates so newly-ready images appear
 * automatically without flooding the UI.
 */
export const useOptimizedImages = ({ readyOnly = false, limit = 200 }: Options = {}) => {
  const [items, setItems] = useState<OptimizedImageWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
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
  }, [readyOnly, limit]);

  useEffect(() => {
    load();
  }, [load]);

  useCoalescedRealtime({
    table: "optimized_images",
    channelKey: `hook_${readyOnly ? "ready" : "all"}_${limit}`,
    onChange: load,
    debounceMs: 800,
  });

  return { items, loading, reload: load };
};
