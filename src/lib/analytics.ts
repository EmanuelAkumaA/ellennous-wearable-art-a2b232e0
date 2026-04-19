import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "./session";

type EventType = "modal_open" | "cta_click" | "modal_close";

export const trackPieceEvent = async (
  pieceId: string,
  eventType: EventType,
  durationMs?: number,
) => {
  try {
    await supabase.from("gallery_piece_events").insert({
      piece_id: pieceId,
      event_type: eventType,
      session_id: getSessionId(),
      duration_ms: durationMs ?? null,
    });
  } catch {
    // analytics never throw
  }
};
