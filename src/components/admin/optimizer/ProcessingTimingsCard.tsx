import { useEffect, useState } from "react";
import { Clock, RefreshCw, Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Painel "Tempos médios estimados" — mostra quanto tempo cada etapa do
 * pipeline (conversão WebP no cliente, upload, otimização na edge) costuma
 * levar, com base nas últimas 30 imagens processadas com sucesso nos
 * últimos 7 dias. Ajuda o admin a saber quanto esperar antes de
 * reprocessar.
 */

type Timings = {
  samples: number;
  convertMs: number;
  uploadMs: number;
  optimizeMs: number;
  totalMs: number;
  reprocessHintMs: number;
};

const BULK_CONCURRENCY = 3;

const fmtSec = (ms: number) => {
  if (!ms || ms <= 0) return "—";
  const s = ms / 1000;
  return s < 1 ? `${ms} ms` : `${s.toFixed(1)}s`;
};

const Bar = ({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className: string;
}) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
      <div className={`h-full ${className}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

export const ProcessingTimingsCard = () => {
  const [data, setData] = useState<Timings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [convRes, optRes] = await Promise.all([
      supabase
        .from("client_telemetry")
        .select("meta, created_at")
        .eq("event_type", "webp_client_conversion")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("optimized_images")
        .select("created_at, updated_at, original_size_bytes, total_optimized_bytes")
        .eq("status", "ready")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const convMs: number[] = [];
    if (convRes.data) {
      for (const row of convRes.data) {
        const m = (row.meta ?? {}) as { conversionMs?: number };
        if (typeof m.conversionMs === "number" && m.conversionMs > 0) {
          convMs.push(m.conversionMs);
        }
      }
    }

    const optMs: number[] = [];
    const uploadEstMs: number[] = [];
    if (optRes.data) {
      for (const row of optRes.data) {
        const created = new Date(row.created_at).getTime();
        const updated = new Date(row.updated_at).getTime();
        const dt = updated - created;
        if (dt > 0 && dt < 5 * 60 * 1000) optMs.push(dt);
        // Rough upload estimate: 250 KB/s lower bound for typical conexão
        const bytes = row.original_size_bytes ?? 0;
        if (bytes > 0) {
          uploadEstMs.push(Math.round((bytes / (1024 * 1024)) * 800));
        }
      }
    }

    const mean = (a: number[]) =>
      a.length ? Math.round(a.reduce((s, n) => s + n, 0) / a.length) : 0;
    const p99 = (a: number[]) => {
      if (!a.length) return 0;
      const sorted = [...a].sort((x, y) => x - y);
      const idx = Math.floor(sorted.length * 0.99);
      return sorted[Math.min(idx, sorted.length - 1)];
    };

    const convertMs = mean(convMs);
    const uploadMs = mean(uploadEstMs);
    const optimizeMs = mean(optMs);
    const totalMs = convertMs + uploadMs + optimizeMs;
    const reprocessHintMs =
      Math.max(p99(optMs), optimizeMs * 2) + uploadMs + convertMs;

    setData({
      samples: optMs.length,
      convertMs,
      uploadMs,
      optimizeMs,
      totalMs,
      reprocessHintMs,
    });
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-border/40 bg-card/40 backdrop-blur p-4 h-24 animate-pulse" />
    );
  }
  if (!data) return null;

  const max = Math.max(data.convertMs, data.uploadMs, data.optimizeMs, 1);
  const noData = data.samples === 0;

  // Estimate a 10-image batch with the bulk concurrency the optimizer uses
  const batchOf10Ms = Math.ceil(10 / BULK_CONCURRENCY) * data.totalMs;

  return (
    <div className="rounded-lg border border-border/40 bg-card/40 backdrop-blur p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5 text-primary-glow" />
          <p className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Tempos médios{data.samples > 0 ? ` (últimas ${data.samples})` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={refreshing}
          className="inline-flex items-center gap-1 text-[10px] font-accent tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {noData ? (
        <p className="text-xs text-muted-foreground">
          Coletando dados — processe algumas imagens para ver as estimativas.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stage
              label="Conversão WebP"
              value={fmtSec(data.convertMs)}
              bar={<Bar value={data.convertMs} max={max} className="bg-sky-400/70" />}
            />
            <Stage
              label="Upload"
              value={fmtSec(data.uploadMs)}
              bar={<Bar value={data.uploadMs} max={max} className="bg-amber-400/70" />}
            />
            <Stage
              label="Otimização"
              value={fmtSec(data.optimizeMs)}
              bar={<Bar value={data.optimizeMs} max={max} className="bg-emerald-400/70" />}
            />
            <Stage
              label="Total"
              value={fmtSec(data.totalMs)}
              bar={<Bar value={data.totalMs} max={data.totalMs || 1} className="bg-primary/70" />}
              highlight
            />
          </div>
          <div className="rounded-md border border-border/40 bg-secondary/20 px-3 py-2 text-[11px] text-muted-foreground flex items-start gap-2">
            <Clock className="h-3 w-3 mt-0.5 text-primary-glow shrink-0" />
            <div className="space-y-0.5">
              <p>
                Aguarde <span className="text-foreground font-medium">~{fmtSec(data.reprocessHintMs)}</span> antes de reprocessar uma imagem.
              </p>
              <p>
                Lote de 10 imagens: <span className="text-foreground font-medium">~{fmtSec(batchOf10Ms)}</span> ({BULK_CONCURRENCY} paralelas).
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Stage = ({
  label,
  value,
  bar,
  highlight,
}: {
  label: string;
  value: string;
  bar: React.ReactNode;
  highlight?: boolean;
}) => (
  <div className="space-y-1.5">
    <p className="font-accent text-[9px] tracking-[0.3em] uppercase text-muted-foreground">
      {label}
    </p>
    <p
      className={`font-display text-base tabular-nums ${
        highlight ? "text-primary-glow" : "text-foreground"
      }`}
    >
      {value}
    </p>
    {bar}
  </div>
);
