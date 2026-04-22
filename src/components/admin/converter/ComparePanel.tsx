import { formatBytes } from "@/lib/imageSnippet";

interface ComparePanelProps {
  originalUrl: string;
  convertedUrl: string;
  originalSize: number;
  convertedSize: number;
}

export const ComparePanel = ({
  originalUrl,
  convertedUrl,
  originalSize,
  convertedSize,
}: ComparePanelProps) => {
  const reduction = originalSize > 0 ? 1 - convertedSize / originalSize : 0;
  const reductionPct = Math.round(reduction * 100);
  const speedupPct = Math.max(0, Math.round(reduction * 100));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <figure className="space-y-2">
          <div className="aspect-square rounded-md overflow-hidden bg-secondary/40 border border-border/40">
            <img src={originalUrl} alt="Original" className="w-full h-full object-cover" />
          </div>
          <figcaption className="text-[10px] font-accent tracking-[0.25em] uppercase text-muted-foreground text-center">
            Original · {formatBytes(originalSize)}
          </figcaption>
        </figure>
        <figure className="space-y-2">
          <div className="aspect-square rounded-md overflow-hidden bg-secondary/40 border border-primary/30">
            <img src={convertedUrl} alt="WebP" className="w-full h-full object-cover" />
          </div>
          <figcaption className="text-[10px] font-accent tracking-[0.25em] uppercase text-primary-glow text-center">
            WebP · {formatBytes(convertedSize)}
          </figcaption>
        </figure>
      </div>
      <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-center">
        <p className="font-display text-2xl text-primary-glow tabular-nums">
          {reductionPct >= 0 ? `−${reductionPct}%` : `+${Math.abs(reductionPct)}%`}
        </p>
        <p className="text-[10px] font-accent tracking-[0.3em] uppercase text-muted-foreground mt-1">
          {reductionPct > 0
            ? `Carregamento ~${speedupPct}% mais rápido`
            : "Já estava bem otimizada"}
        </p>
      </div>
    </div>
  );
};
