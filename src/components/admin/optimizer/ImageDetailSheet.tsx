import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { formatBytes } from "@/lib/imageSnippet";
import type { OptimizedImage } from "./ImageCard";

interface ImageDetailSheetProps {
  image: OptimizedImage | null;
  onClose: () => void;
}

export const ImageDetailSheet = ({ image, onClose }: ImageDetailSheetProps) => {
  return (
    <Sheet open={!!image} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {image && (
          <>
            <SheetHeader>
              <SheetTitle className="truncate">{image.name}</SheetTitle>
              <SheetDescription>
                {image.original_width}×{image.original_height} · {formatBytes(image.original_size_bytes)}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <div>
                <p className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
                  Antes vs depois
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border border-border/40 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Original</p>
                    <p className="font-display text-lg">{formatBytes(image.original_size_bytes)}</p>
                  </div>
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                    <p className="text-[10px] text-primary-glow uppercase tracking-wider">Soma variantes</p>
                    <p className="font-display text-lg">{formatBytes(image.total_optimized_bytes)}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
                  Variantes geradas ({image.variants.length})
                </p>
                <div className="rounded-md border border-border/40 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Largura</th>
                        <th className="text-left px-3 py-2">Formato</th>
                        <th className="text-right px-3 py-2">Peso</th>
                        <th className="text-right px-3 py-2">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...image.variants]
                        .sort((a, b) => a.width - b.width || a.format.localeCompare(b.format))
                        .map((v) => {
                          const delta = image.original_size_bytes
                            ? Math.round(((image.original_size_bytes - v.size_bytes) / image.original_size_bytes) * 100)
                            : 0;
                          return (
                            <tr key={v.path} className="border-t border-border/30">
                              <td className="px-3 py-2">{v.width}px</td>
                              <td className="px-3 py-2 uppercase text-muted-foreground">{v.format}</td>
                              <td className="px-3 py-2 text-right">{formatBytes(v.size_bytes)}</td>
                              <td className="px-3 py-2 text-right text-emerald-400">-{delta}%</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {image.error_message && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  {image.error_message}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
