import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { Loader2, Download, Trash2, Sparkles, Upload } from "lucide-react";
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
import { ComparePanel } from "./ComparePanel";

interface QueueItemProps {
  id: string;
  file: File;
  onRemove: (id: string) => void;
  onSavedToHistory: () => void;
}

interface ConvertedState {
  mainBlob: Blob;
  mainUrl: string;
  preset: ResponsivePresetResult | null;
  totalSize: number;
}

const baseName = (filename: string): string =>
  filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "imagem";

export const QueueItem = ({ id, file, onRemove, onSavedToHistory }: QueueItemProps) => {
  const [meta, setMeta] = useState<{ width: number; height: number; size: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [quality, setQuality] = useState(82);
  const [responsive, setResponsive] = useState(true);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [converted, setConverted] = useState<ConvertedState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

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

  const runConversion = async () => {
    setWorking(true);
    setError(null);
    setProgress(10);
    try {
      let preset: ResponsivePresetResult | null = null;
      let mainBlob: Blob;
      let totalSize: number;
      if (responsive) {
        setProgress(30);
        preset = await convertResponsivePreset(file, quality);
        mainBlob = preset.desktop.blob;
        totalSize =
          preset.mobile.blob.size +
          preset.tablet.blob.size +
          preset.desktop.blob.size +
          preset.original.blob.size;
      } else {
        setProgress(40);
        const result = await convertImage(file, { quality });
        mainBlob = result.blob;
        totalSize = mainBlob.size;
      }
      setProgress(90);
      const mainUrl = URL.createObjectURL(mainBlob);
      setConverted((prev) => {
        if (prev) URL.revokeObjectURL(prev.mainUrl);
        return { mainBlob, mainUrl, preset, totalSize };
      });
      setProgress(100);
    } catch (e) {
      setError((e as Error).message ?? "Falha na conversão");
    } finally {
      setWorking(false);
      window.setTimeout(() => setProgress(0), 600);
    }
  };

  // Initial conversion + re-convert when quality/responsive change (debounced).
  useEffect(() => {
    if (!meta) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void runConversion();
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, quality, responsive]);

  // Cleanup converted blob URL on unmount
  useEffect(() => {
    return () => {
      if (converted?.mainUrl) URL.revokeObjectURL(converted.mainUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeName = useMemo(() => baseName(file.name), [file.name]);

  const downloadMain = () => {
    if (!converted) return;
    const url = converted.mainUrl;
    const a = document.createElement("a");
    a.href = url;
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
          {
            preset: "mobile",
            filename: `${safeName}-mobile.webp`,
            width: converted.preset.mobile.width,
            height: converted.preset.mobile.height,
            size: converted.preset.mobile.blob.size,
            blob: converted.preset.mobile.blob,
          },
          {
            preset: "tablet",
            filename: `${safeName}-tablet.webp`,
            width: converted.preset.tablet.width,
            height: converted.preset.tablet.height,
            size: converted.preset.tablet.blob.size,
            blob: converted.preset.tablet.blob,
          },
          {
            preset: "desktop",
            filename: `${safeName}-desktop.webp`,
            width: converted.preset.desktop.width,
            height: converted.preset.desktop.height,
            size: converted.preset.desktop.blob.size,
            blob: converted.preset.desktop.blob,
          },
          {
            preset: "original",
            filename: `${safeName}.webp`,
            width: converted.preset.original.width,
            height: converted.preset.original.height,
            size: converted.preset.original.blob.size,
            blob: converted.preset.original.blob,
          },
        ]
      : [
          {
            preset: "original",
            filename: `${safeName}.webp`,
            width: meta?.width ?? 0,
            height: meta?.height ?? 0,
            size: converted.mainBlob.size,
            blob: converted.mainBlob,
          },
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

  return (
    <article className="glass-card p-5 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base truncate" title={file.name}>
            {file.name}
          </p>
          <p className="text-[10px] font-accent tracking-[0.25em] uppercase text-muted-foreground mt-1">
            {meta ? `${meta.width}×${meta.height}` : "lendo…"} · {formatBytes(file.size)}
          </p>
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
              onValueChange={(v) => setQuality(v[0])}
            />
          </div>

          <div className="flex items-center gap-3 glass-card p-3 rounded-md">
            <Switch checked={responsive} onCheckedChange={setResponsive} />
            <div>
              <Label className="cursor-pointer text-sm">Variantes responsivas</Label>
              <p className="text-[10px] text-muted-foreground">
                Mobile 480 · Tablet 768 · Desktop 1200 + original
              </p>
            </div>
          </div>

          {(working || progress > 0) && (
            <div className="space-y-1.5">
              <Progress value={progress} className="h-1.5" />
              <p className="text-[10px] font-accent tracking-[0.25em] uppercase text-muted-foreground flex items-center gap-1.5">
                {working ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {working ? "Convertendo…" : "Pronto"}
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={downloadMain}
              disabled={!converted || working}
              size="sm"
              className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px] bg-gradient-purple-wine"
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Baixar WebP
            </Button>
            <Button
              onClick={downloadAllZip}
              disabled={!converted || working}
              variant="outline"
              size="sm"
              className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px]"
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Baixar tudo (.zip)
            </Button>
            <Button
              onClick={saveToHistory}
              disabled={!converted || working}
              variant="outline"
              size="sm"
              className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px]"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Salvar no histórico
            </Button>
            <Button
              onClick={() =>
                toast({
                  title: "Em breve",
                  description: "Integração direta com obras em uma próxima versão.",
                })
              }
              variant="ghost"
              size="sm"
              className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px]"
            >
              <Upload className="h-3.5 w-3.5 mr-1" /> Usar no site
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
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </article>
  );
};
