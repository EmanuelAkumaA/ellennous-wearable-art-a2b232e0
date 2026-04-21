import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Sparkles, ImageIcon, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  detectLegacyImages,
  runBackfill,
  type BackfillProgressItem,
  type LegacyImageItem,
} from "@/lib/optimizerBackfill";

const STATUS_LABEL: Record<BackfillProgressItem["status"], string> = {
  pending: "Pendente",
  downloading: "Baixando",
  uploading: "Enviando",
  optimizing: "Otimizando",
  done: "Pronta",
  skipped: "Já otimizada",
  error: "Erro",
};

const STATUS_TONE: Record<BackfillProgressItem["status"], string> = {
  pending: "text-muted-foreground",
  downloading: "text-primary-glow",
  uploading: "text-primary-glow",
  optimizing: "text-primary-glow",
  done: "text-emerald-400",
  skipped: "text-muted-foreground",
  error: "text-destructive",
};

export const BackfillRunner = () => {
  const [items, setItems] = useState<BackfillProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const detect = async () => {
    setLoading(true);
    try {
      const detected = await detectLegacyImages();
      setItems(detected.map((d) => ({ ...d, status: "pending" as const })));
    } catch (e) {
      toast({
        title: "Erro ao detectar imagens",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    detect();
  }, []);

  const updateItem = (id: string, patch: Partial<BackfillProgressItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const start = async () => {
    if (running) return;
    const pending = items.filter((i) => i.status === "pending" || i.status === "error");
    if (pending.length === 0) {
      toast({ title: "Nada a fazer", description: "Todas as imagens já estão otimizadas." });
      return;
    }
    setRunning(true);
    // Reset any error rows back to pending visually
    pending.forEach((p) => updateItem(p.id, { status: "pending", error: undefined }));

    const legacy: LegacyImageItem[] = pending.map(
      ({ id, kind, pieceId, pieceName, url, storagePath, filename }) => ({
        id,
        kind,
        pieceId,
        pieceName,
        url,
        storagePath,
        filename,
      }),
    );

    const { done, failed } = await runBackfill(legacy, updateItem, 2);
    setRunning(false);
    toast({
      title: `Backfill concluído`,
      description: `${done} otimizada(s)${failed ? `, ${failed} falha(s)` : ""}.`,
      variant: failed > 0 && done === 0 ? "destructive" : "default",
    });
  };

  const stats = {
    total: items.length,
    done: items.filter((i) => i.status === "done").length,
    error: items.filter((i) => i.status === "error").length,
    pending: items.filter((i) => i.status === "pending").length,
  };
  const progressPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3">
        <Sparkles className="h-4 w-4 mt-0.5 text-primary-glow shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          Esta tela detecta imagens já existentes no site que <strong className="text-foreground">não foram processadas pelo Otimizador</strong>.
          Ao rodar, cada imagem é baixada, reenviada pelo pipeline (AVIF / WebP / JPG em 4 larguras) e o link da galeria
          é atualizado para servir a versão otimizada. Os arquivos originais permanecem intocados como fallback.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Detectadas" value={String(stats.total)} />
        <Stat label="Otimizadas" value={String(stats.done)} highlight={stats.done > 0} />
        <Stat label="Pendentes" value={String(stats.pending)} />
        <Stat label="Erros" value={String(stats.error)} tone={stats.error > 0 ? "destructive" : "muted"} />
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-accent tracking-[0.3em] uppercase text-muted-foreground">
            <span>Progresso</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
            <div
              className="h-full bg-primary-glow transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={start}
          disabled={running || loading || items.length === 0}
          className="rounded-none font-accent tracking-[0.2em] uppercase text-xs bg-gradient-purple-wine hover:opacity-90 shadow-glow"
        >
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
          Otimizar todas ({stats.pending + stats.error})
        </Button>
        <Button
          variant="outline"
          onClick={detect}
          disabled={running || loading}
          className="rounded-none font-accent tracking-[0.2em] uppercase text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Re-detectar
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-12 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
          <p className="text-sm text-foreground">Tudo otimizado!</p>
          <p className="text-xs text-muted-foreground mt-1">
            Não há imagens antigas pendentes. Novos uploads já passam automaticamente pelo Otimizador.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <BackfillRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

const BackfillRow = ({ item }: { item: BackfillProgressItem }) => {
  const Icon =
    item.status === "done"
      ? CheckCircle2
      : item.status === "error"
        ? AlertCircle
        : item.status === "pending"
          ? ImageIcon
          : Loader2;
  const animate = item.status === "downloading" || item.status === "uploading" || item.status === "optimizing";
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 backdrop-blur p-3 flex items-center gap-3">
      <div className="relative h-12 w-12 shrink-0 rounded-md overflow-hidden bg-secondary/30">
        <img src={item.url} alt={item.filename} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate font-medium" title={item.filename}>
          {item.filename}
        </p>
        <p className="text-[10px] text-muted-foreground/80 truncate">
          <span className="font-accent tracking-[0.2em] uppercase">
            {item.kind === "cover" ? "Capa" : "Galeria"}
          </span>
          {" · "}{item.pieceName}
        </p>
        {item.error && (
          <p className="text-[10px] text-destructive truncate mt-0.5" title={item.error}>
            {item.error}
          </p>
        )}
      </div>
      <div className={`inline-flex items-center gap-1.5 text-[10px] font-accent tracking-[0.25em] uppercase shrink-0 ${STATUS_TONE[item.status]}`}>
        <Icon className={`h-3.5 w-3.5 ${animate ? "animate-spin" : ""}`} />
        {STATUS_LABEL[item.status]}
      </div>
    </div>
  );
};

const Stat = ({
  label,
  value,
  highlight,
  tone = "default",
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "default" | "muted" | "destructive";
}) => (
  <div
    className={`rounded-lg border px-4 py-3 ${
      tone === "destructive"
        ? "border-destructive/40 bg-destructive/10"
        : highlight
          ? "border-primary/40 bg-primary/10"
          : "border-border/40 bg-card/40"
    }`}
  >
    <p className="font-accent text-[9px] tracking-[0.3em] uppercase text-muted-foreground">{label}</p>
    <p
      className={`font-display text-xl mt-1 ${
        tone === "destructive" ? "text-destructive" : highlight ? "text-primary-glow" : ""
      }`}
    >
      {value}
    </p>
  </div>
);

export default BackfillRunner;
