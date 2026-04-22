import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Options {
  /** Postgres table to subscribe to. */
  table: string;
  /** Optional channel suffix to keep multiple subscribers from sharing a channel. */
  channelKey?: string;
  /** Called at most once per debounce window. */
  onChange: () => void;
  /** When true, events are buffered; a single onChange fires on resume. */
  paused?: boolean;
  /** Debounce window in ms. */
  debounceMs?: number;
  /** When true (default), suspend events while the tab is hidden. */
  pauseWhenHidden?: boolean;
}

/**
 * Subscribes to realtime postgres_changes and calls `onChange` at most once
 * per `debounceMs`. While `paused` is true (or the tab is hidden, when
 * `pauseWhenHidden`), events are coalesced into a single trailing call that
 * fires when we resume.
 *
 * This dramatically reduces refetch storms during bulk operations
 * (e.g. ~100 events become 1 trailing fetch).
 */
export const useCoalescedRealtime = ({
  table,
  channelKey,
  onChange,
  paused = false,
  debounceMs = 800,
  pauseWhenHidden = true,
}: Options) => {
  // Keep the latest `onChange` and `paused` in refs so the subscribe effect
  // can stay stable (no resubscribes when those change).
  const onChangeRef = useRef(onChange);
  const pausedRef = useRef(paused);
  const pendingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Track external paused state + visibility paused state combined.
  useEffect(() => {
    const wasPaused = pausedRef.current;
    pausedRef.current = paused;
    // Resuming: if we have a pending event, flush it now.
    if (wasPaused && !paused && pendingRef.current) {
      pendingRef.current = false;
      onChangeRef.current();
    }
  }, [paused]);

  // Visibility handler: suspend while hidden, flush on resume.
  useEffect(() => {
    if (!pauseWhenHidden || typeof document === "undefined") return;
    const handler = () => {
      if (document.visibilityState === "visible" && pendingRef.current && !pausedRef.current) {
        pendingRef.current = false;
        onChangeRef.current();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [pauseWhenHidden]);

  useEffect(() => {
    const channelName = `${table}_coalesced_${channelKey ?? "default"}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { event: "*", schema: "public", table } as any,
        () => {
          const isHidden =
            pauseWhenHidden &&
            typeof document !== "undefined" &&
            document.visibilityState !== "visible";
          if (pausedRef.current || isHidden) {
            pendingRef.current = true;
            return;
          }
          if (timerRef.current != null) window.clearTimeout(timerRef.current);
          timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            onChangeRef.current();
          }, debounceMs);
        },
      )
      .subscribe();
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [table, channelKey, debounceMs, pauseWhenHidden]);
};
