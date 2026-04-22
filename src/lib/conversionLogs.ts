/**
 * Records every image conversion (success or failure) to the
 * `conversion_logs` table. Logs are admin-only and intentionally
 * non-blocking — a failed log write never breaks the upload flow.
 */

import { supabase } from "@/integrations/supabase/client";

export type ConversionSource = "converter" | "piece_upload";
export type ConversionStatus = "success" | "error";

export interface ConversionLogPayload {
  source: ConversionSource;
  pieceId?: string | null;
  filename: string;
  originalSize: number;
  optimizedSize: number;
  originalFormat?: string | null;
  status: ConversionStatus;
  errorMessage?: string | null;
  durationMs: number;
  desktopPath?: string | null;
}

export interface ConversionLogRow {
  id: string;
  user_id: string;
  source: ConversionSource;
  piece_id: string | null;
  filename: string;
  original_size: number;
  optimized_size: number;
  original_format: string | null;
  status: ConversionStatus;
  error_message: string | null;
  duration_ms: number;
  desktop_path: string | null;
  created_at: string;
}

export const logConversion = async (payload: ConversionLogPayload): Promise<void> => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return; // not authenticated — silently skip
    await supabase.from("conversion_logs").insert({
      user_id: userId,
      source: payload.source,
      piece_id: payload.pieceId ?? null,
      filename: payload.filename.slice(0, 240),
      original_size: Math.max(0, Math.round(payload.originalSize)),
      optimized_size: Math.max(0, Math.round(payload.optimizedSize)),
      original_format: payload.originalFormat ?? null,
      status: payload.status,
      error_message: payload.errorMessage?.slice(0, 1000) ?? null,
      duration_ms: Math.max(0, Math.round(payload.durationMs)),
      desktop_path: payload.desktopPath ?? null,
    });
  } catch (e) {
    // Logs must never break the upload pipeline.
    console.warn("[conversionLogs] failed to write log:", e);
  }
};

export interface ListLogsOptions {
  status?: ConversionStatus | "all";
  source?: ConversionSource | "all";
  search?: string;
  fromDate?: string; // ISO
  toDate?: string;   // ISO
  limit?: number;
}

export const listConversionLogs = async (opts: ListLogsOptions = {}): Promise<ConversionLogRow[]> => {
  let q = supabase
    .from("conversion_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 500);
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts.source && opts.source !== "all") q = q.eq("source", opts.source);
  if (opts.search?.trim()) q = q.ilike("filename", `%${opts.search.trim()}%`);
  if (opts.fromDate) q = q.gte("created_at", opts.fromDate);
  if (opts.toDate)   q = q.lte("created_at", opts.toDate);
  const { data, error } = await q;
  if (error) throw error;
  return (data as ConversionLogRow[]) ?? [];
};
