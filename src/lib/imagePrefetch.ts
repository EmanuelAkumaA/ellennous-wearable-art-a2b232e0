/**
 * Lightweight image prefetcher backed by `<link rel="prefetch" as="image">`.
 *
 * Used by the gallery to warm modal-resolution images when the user hovers
 * or focuses a card, so the modal opens with the image already cached.
 *
 * Deduplicated globally via a module-level Set — calling `prefetchImage`
 * multiple times for the same URL is a cheap no-op.
 */

const prefetched = new Set<string>();

export const prefetchImage = (url: string | null | undefined): void => {
  if (!url || typeof document === "undefined") return;
  if (prefetched.has(url)) return;
  prefetched.add(url);
  try {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "image";
    link.href = url;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  } catch {
    /* ignore */
  }
};
