import { get, set } from "idb-keyval";

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

export const cacheGet = async <T>(key: string): Promise<CacheEntry<T> | undefined> => {
  try {
    return (await get<CacheEntry<T>>(`ellennous:${key}`)) ?? undefined;
  } catch {
    return undefined;
  }
};

export const cacheSet = async <T>(key: string, data: T): Promise<void> => {
  try {
    await set(`ellennous:${key}`, { data, cachedAt: Date.now() } satisfies CacheEntry<T>);
  } catch {
    // ignore quota / private mode errors
  }
};

/**
 * Stale-while-revalidate:
 * - Returns cached data immediately (if any) via `onCache`.
 * - Then fetches fresh data and calls `onFresh` (unless offline).
 * - Persists fresh result to cache on success.
 */
export const cacheStaleWhileRevalidate = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  callbacks: {
    onCache?: (data: T, cachedAt: number) => void;
    onFresh?: (data: T) => void;
    onError?: (error: unknown) => void;
  },
): Promise<void> => {
  const cached = await cacheGet<T>(key);
  if (cached) callbacks.onCache?.(cached.data, cached.cachedAt);

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }

  try {
    const fresh = await fetcher();
    await cacheSet(key, fresh);
    callbacks.onFresh?.(fresh);
  } catch (error) {
    callbacks.onError?.(error);
  }
};

export const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;
