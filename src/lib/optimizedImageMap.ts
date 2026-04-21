import { supabase } from "@/integrations/supabase/client";
import type { OptimizedVariant } from "@/lib/imageSnippet";

export type OptimizedMap = Map<string, OptimizedVariant[]>;

/** Extract the basename (final path segment, decoded, query-stripped) from a URL or path. */
export const getBasenameFromUrl = (urlOrPath: string): string | null => {
  if (!urlOrPath) return null;
  try {
    const clean = urlOrPath.split("?")[0].split("#")[0];
    const segments = clean.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) return null;
    return decodeURIComponent(last).toLowerCase();
  } catch {
    return null;
  }
};

/** Load a map of basename → variants[] for all "ready" optimized images. */
export const loadOptimizedMap = async (): Promise<OptimizedMap> => {
  const map: OptimizedMap = new Map();
  const { data, error } = await supabase
    .from("optimized_images")
    .select("original_path, variants, status, updated_at")
    .eq("status", "ready")
    .order("updated_at", { ascending: true }); // newer overwrites older
  if (error || !data) return map;
  for (const row of data) {
    const basename = getBasenameFromUrl(row.original_path);
    if (!basename) continue;
    const variants = (row.variants as unknown as OptimizedVariant[]) ?? [];
    if (variants.length === 0) continue;
    map.set(basename, variants);
  }
  return map;
};

/** Find variants for a given image URL by matching basename. */
export const findVariantsForUrl = (
  url: string,
  map: OptimizedMap,
): OptimizedVariant[] | null => {
  const basename = getBasenameFromUrl(url);
  if (!basename) return null;
  return map.get(basename) ?? null;
};
