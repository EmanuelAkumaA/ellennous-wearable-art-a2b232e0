import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import JSZip from "jszip";
import { Loader2, Download, Trash2, Sparkles, Upload, RefreshCw, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  convertImage,
  convertResponsivePreset,
  readImageMeta,
  type ResponsivePresetResult,
} from "@/lib/imageConverter";
import { addHistoryRecord, type HistoryVariantRecord } from "@/lib/conversionHistoryDb";
import { formatBytes } from "@/lib/imageSnippet";
import { validateFileDeep } from "@/lib/converterValidation";
import { logConversion } from "@/lib/conversionLogs";
import { uploadStaging } from "@/lib/galleryStaging";
import { ComparePanel } from "./ComparePanel";
import { VariantGrid, type VariantSlot, type VariantKey } from "./VariantGrid";

export type QueueStatus = "queued" | "validating" | "converting" | "done" | "error";

export interface QueueItemHandle {
  start: () => Promise<void>;
  retry: () => Promise<void>;
  status: QueueStatus;
}

interface QueueItemProps {
  id: string;
  file: File;
  /** Auto-start conversion as soon as the parent allows. */
  autoStart: boolean;
  onRemove: (id: string) => void;
  onSavedToHistory: () => void;
  onStatusChange: (id: string, status: QueueStatus) => void;
  onStagingSaved?: () => void;
  /** Reports per-item progress (0–100) so the parent can compute weighted ETA. */
  onProgressChange?: (id: string, percent: number) => void;
}

interface ConvertedState {
  mainBlob: Blob;
  mainUrl: string;
  preset: ResponsivePresetResult | null;
  totalSize: number;
}

const baseName = (filename: string): string =>
  filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "imagem";

const STATUS_LABEL: Record<QueueStatus, string> = {
  queued: "Enfileirado",
  validating: "Validando",
  converting: "Convertendo",
  done: "Concluído",
  error: "Falhou",
};

const STATUS_TONE: Record<QueueStatus, string> = {
  queued: "text-muted-foreground",
  validating: "text-primary-glow",
  converting: "text-primary-glow",
  done: "text-emerald-400",
  error: "text-destructive",
};

export const QueueItem = forwardRef<QueueItemHandle, QueueItemProps>(({
  id,
  file,
  autoStart,
  onRemove,
  onSavedToHistory,
  onStatusChange,
  onStagingSaved,
  onProgressChange,
}, ref) => {
  const [meta, setMeta] = useState<{ width: number; height: number; size: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [quality, setQuality] = useState(82);
  const [responsive, setResponsive] = useState(true);
  const [status, setStatus] = useState<QueueStatus>("queued");
  const [progress, setProgressState] = useState(0);
  const [converted, setConverted] = useState<ConvertedState | null>(null);
  const [variantUrls, setVariantUrls] = useState<Partial<Record<VariantKey, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [stagingUploading, setStagingUploading] = useState(false);
  const [stagingDone, setStagingDone] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const setProgress = (p: number) => {
    setProgressState(p);
    onProgressChange?.(id, p);
  };

  // Build a stable preview URL for the original (works for HEIC too via blob:).
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Read dimensions (decodes HEIC if needed, so it can take a moment).
  useEffect(() => {
    let cancelled = false;
    readImageMeta(file)
      .then((m) => {
        if (!cancelled) setMeta(m);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível ler a imagem");
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const updateStatus = (s: QueueStatus) => {
    setStatus(s);
    onStatusChange(id, s);
  };

  const runConversion = async (): Promise<void> => {
    setError(null);
    updateStatus("validating");
    setProgress(5);
    const t0 = performance.now();

    const validation = await validateFileDeep(file);
    if (validation.ok !== true) {
      const reason = validation.reason;
      setError(reason);
      updateStatus("error");
      void logConversion({
        source: "converter",
        filename: file.name,
        originalSize: file.size,
        optimizedSize: 0,
        originalFormat: file.type || null,
        status: "error",
        errorMessage: reason,
        durationMs: Math.round(performance.now() - t0),
      });
      return;
    }

    updateStatus("converting");
    setProgress(25);
    try {
      let preset: ResponsivePresetResult | null = null;
      let mainBlob: Blob;
      let totalSize: number;
      if (responsive) {
        setProgress(45);
        preset = await convertResponsivePreset(file, quality);
        mainBlob = preset.desktop.blob;
        totalSize =
          preset.mobile.blob.size +
          preset.tablet.blob.size +
          preset.desktop.blob.size +
          preset.original.blob.size;
      } else {
        setProgress(60);
        const result = await convertImage(file, { quality });
        mainBlob = result.blob;
        totalSize = mainBlob.size;
      }
      setProgress(95);
      const mainUrl = URL.createObjectURL(mainBlob);
      setConverted((prev) => {
        if (prev) URL.revokeObjectURL(prev.mainUrl);
        return { mainBlob, mainUrl, preset, totalSize };
      });
      setProgress(100);
      updateStatus("done");
      void logConversion({
        source: "converter",
        filename: file.name,
        originalSize: file.size,
        optimizedSize: totalSize,
        originalFormat: file.type || null,
        status: "success",
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (e) {
      const reason = (e as Error).message ?? "Falha na conversão";
      setError(reason);
      updateStatus("error");
      void logConversion({
        source: "converter",
        filename: file.name,
        originalSize: file.size,
        optimizedSize: 0,
        originalFormat: file.type || null,
        status: "error",
        errorMessage: reason,
        durationMs: Math.round(performance.now() - t0),
      });
    }
  };

  // Re-convert (debounced) when quality/responsive change AFTER first success.
  useEffect(() => {
    if (!converted || status === "converting" || status === "validating") return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void runConversion();
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, responsive]);

  // Auto-start when allowed by parent (concurrency-aware queue).
  useEffect(() => {
    if (autoStart && !startedRef.current && meta) {
      startedRef.current = true;
      void runConversion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, meta]);

  // Cleanup converted blob URL on unmount
  useEffect(() => {
    return () => {
      if (converted?.mainUrl) URL.revokeObjectURL(converted.mainUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    start: runConversion,
    retry: async () => {
      startedRef.current = true;
      await runConversion();
    },
    status,
  }), [status]);

  const safeName = useMemo(() => baseName(file.name), [file.name]);

  const downloadMain = () => {
    if (!converted) return;
    const a = document.createElement("a");
    a.href = converted.mainUrl;
    a.download = `${safeName}.webp`;
    a.click();
  };

  const downloadAllZip = async () => {
    if (!converted) return;
    const zip = new JSZip();
    if (converted.preset) {
      zip.file(`${safeName}-mobile.webp`, converted.preset.mobile.blob);
      zip.file(`${safeName}-tablet.webp`, converted.preset.tablet.blob);
      zip.file(`${safeName}-desktop.webp`, converted.preset.desktop.blob);
      zip.file(`${safeName}.webp`, converted.preset.original.blob);
    } else {
      zip.file(`${safeName}.webp`, converted.mainBlob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}-bundle.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveToHistory = async () => {
    if (!converted) return;
    const variants: HistoryVariantRecord[] = converted.preset
      ? [
          { preset: "mobile",  filename: `${safeName}-mobile.webp`,  width: converted.preset.mobile.width,  height: converted.preset.mobile.height,  size: converted.preset.mobile.blob.size,  blob: converted.preset.mobile.blob },
          { preset: "tablet",  filename: `${safeName}-tablet.webp`,  width: converted.preset.tablet.width,  height: converted.preset.tablet.height,  size: converted.preset.tablet.blob.size,  blob: converted.preset.tablet.blob },
          { preset: "desktop", filename: `${safeName}-desktop.webp`, width: converted.preset.desktop.width, height: converted.preset.desktop.height, size: converted.preset.desktop.blob.size, blob: converted.preset.desktop.blob },
          { preset: "original",filename: `${safeName}.webp`,         width: converted.preset.original.width,height: converted.preset.original.height,size: converted.preset.original.blob.size,blob: converted.preset.original.blob },
        ]
      : [
          { preset: "original", filename: `${safeName}.webp`, width: meta?.width ?? 0, height: meta?.height ?? 0, size: converted.mainBlob.size, blob: converted.mainBlob },
        ];
    await addHistoryRecord({
      id: crypto.randomUUID(),
      name: file.name,
      createdAt: Date.now(),
      originalSize: file.size,
      totalSize: converted.totalSize,
      variants,
    });
    toast({ title: "Salvo no histórico" });
    onSavedToHistory();
  };

  const sendToStaging = async () => {
    if (!converted?.preset) {
      toast({ title: "Ative as variantes responsivas para enviar à galeria", variant: "destructive" });
      return;
    }
    setStagingUploading(true);
    try {
      await uploadStaging({ originalFilename: file.name, preset: converted.preset });
      setStagingDone(true);
      toast({
        title: "Enviado para a galeria",
        description: "Disponível na aba Galeria → Staging para associar a uma obra.",
      });
      onStagingSaved?.();
    } catch (e) {
      toast({ title: "Erro ao enviar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setStagingUploading(false);
    }
  };

  const StatusIcon =
    status === "done" ? Check :
    status === "error" ? AlertCircle :
    status === "queued" ? Sparkles :
    Loader2;

  const isWorking = status === "validating" || status === "converting";

  return (
    <article className="glass-card p-5 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-base truncate" title={file.name}>
            {file.name}
          </p>
          <p className="text-[10px] font-accent tracking-[0.25em] uppercase text-muted-foreground mt-1">
            {meta ? `${meta.width}×${meta.height}` : "lendo…"} · {formatBytes(file.size)}
          </p>
          <div className={`flex items-center gap-1.5 mt-2 text-[10px] font-accent tracking-[0.3em] uppercase ${STATUS_TONE[status]}`}>
            <StatusIcon className={`h-3 w-3 ${isWorking ? "animate-spin" : ""}`} />
            <span>{STATUS_LABEL[status]}</span>
            {isWorking && <span className="tabular-nums">· {progress}%</span>}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onRemove(id)}
          className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive"
          title="Remover"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </header>

      {(isWorking || (progress > 0 && progress < 100)) && (
        <Progress value={progress} className="h-1.5" />
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-destructive">{error}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { startedRef.current = true; void runConversion(); }}
            className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px] shrink-0"
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
          </Button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {/* Controls */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                Qualidade
              </Label>
              <span className="font-display text-sm tabular-nums text-primary-glow">{quality}</span>
            </div>
            <Slider
              value={[quality]}
              min={20}
              max={100}
              step={1}
              disabled={isWorking}
              onValueChange={(v) => setQuality(v[0])}
            />
          </div>

          <div className="flex items-center gap-3 glass-card p-3 rounded-md">
            <Switch checked={responsive} onCheckedChange={setResponsive} disabled={isWorking} />
            <div>
              <Label className="cursor-pointer text-sm">Variantes responsivas</Label>
              <p className="text-[10px] text-muted-foreground">
                Mobile 480 · Tablet 768 · Desktop 1200 + original
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={downloadMain}
              disabled={!converted || isWorking}
              size="sm"
              className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px] bg-gradient-purple-wine"
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Baixar WebP
            </Button>
            <Button
              onClick={downloadAllZip}
              disabled={!converted || isWorking}
              variant="outline"
              size="sm"
              className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px]"
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Baixar tudo (.zip)
            </Button>
            <Button
              onClick={saveToHistory}
              disabled={!converted || isWorking}
              variant="outline"
              size="sm"
              className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px]"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Salvar no histórico
            </Button>
            <Button
              onClick={sendToStaging}
              disabled={!converted || isWorking || stagingUploading || stagingDone}
              variant="outline"
              size="sm"
              className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px]"
              title="Envia as 3 variantes para a aba Galeria → Staging"
            >
              {stagingUploading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : stagingDone ? (
                <Check className="h-3.5 w-3.5 mr-1" />
              ) : (
                <Upload className="h-3.5 w-3.5 mr-1" />
              )}
              {stagingDone ? "Enviado" : "Enviar p/ galeria"}
            </Button>
          </div>
        </div>

        {/* Compare */}
        {converted ? (
          <ComparePanel
            originalUrl={previewUrl}
            convertedUrl={converted.mainUrl}
            originalSize={file.size}
            convertedSize={converted.totalSize}
          />
        ) : (
          <div className="rounded-md bg-secondary/30 border border-border/40 flex items-center justify-center min-h-[180px]">
            {isWorking ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-[10px] font-accent tracking-[0.3em] uppercase text-muted-foreground/60">
                {status === "queued" ? "Aguardando vez na fila" : "Sem prévia"}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
});

QueueItem.displayName = "QueueItem";
