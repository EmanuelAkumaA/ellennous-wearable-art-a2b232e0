import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "./session";

/**
 * Lightweight client-side telemetry for events that affect performance
 * insights (e.g. WebP unsupported by the browser → fallback to original JPEG/PNG).
 *
 * Fire-and-forget: errors are swallowed. Per-session deduplication uses
 * sessionStorage so we don't flood the table with duplicate events from the
 * same visitor on a single tab.
 */

export type TelemetryEvent =
  | "webp_unsupported"
  | "webp_fallback_used"
  | "webp_served";

const ONCE_KEY = (eventType: string) => `telemetry_once_${eventType}`;

const alreadySent = (eventType: string): boolean => {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(ONCE_KEY(eventType)) === "1";
  } catch {
    return false;
  }
};

const markSent = (eventType: string) => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ONCE_KEY(eventType), "1");
  } catch {
    /* ignore */
  }
};

export const trackClientEvent = async (
  eventType: TelemetryEvent,
  meta?: Record<string, unknown>,
  options?: { oncePerSession?: boolean },
): Promise<void> => {
  const oncePerSession = options?.oncePerSession ?? true;
  if (oncePerSession && alreadySent(eventType)) return;
  if (oncePerSession) markSent(eventType);

  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    await supabase.from("client_telemetry").insert({
      event_type: eventType,
      session_id: getSessionId(),
      user_agent: ua,
      meta: (meta ?? {}) as never,
    });
  } catch {
    // never throw from telemetry
  }
};
