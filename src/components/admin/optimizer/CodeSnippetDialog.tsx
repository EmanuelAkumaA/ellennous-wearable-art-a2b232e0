import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Copy, Check } from "lucide-react";
import { buildPictureSnippet } from "@/lib/imageSnippet";
import type { OptimizedImage } from "./ImageCard";
import { toast } from "@/hooks/use-toast";

interface CodeSnippetDialogProps {
  image: OptimizedImage | null;
  onClose: () => void;
}

export const CodeSnippetDialog = ({ image, onClose }: CodeSnippetDialogProps) => {
  const [copied, setCopied] = useState(false);
  const snippet = useMemo(() => (image ? buildPictureSnippet(image.variants, image.name) : ""), [image]);

  const copy = async () => {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast({ title: "Código copiado" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Falha ao copiar", variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!image} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Código otimizado</DialogTitle>
          <DialogDescription>
            Cole no HTML/JSX onde a imagem deve aparecer. O navegador escolhe o melhor formato disponível.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <pre className="text-[11px] leading-relaxed bg-secondary/40 border border-border/40 rounded-md p-4 overflow-auto max-h-[60vh] font-mono">
{snippet}
          </pre>
          <button
            type="button"
            onClick={copy}
            className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded bg-primary/20 hover:bg-primary/30 text-primary-glow text-[10px] font-accent tracking-[0.25em] uppercase px-2.5 py-1.5 transition-colors"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
