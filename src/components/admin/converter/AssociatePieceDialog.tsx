import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PieceOption {
  id: string;
  nome: string;
}

interface AssociatePieceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (pieceId: string, asCover: boolean) => Promise<void>;
  title?: string;
}

export const AssociatePieceDialog = ({
  open, onOpenChange, onConfirm, title = "Associar a uma obra",
}: AssociatePieceDialogProps) => {
  const [pieces, setPieces] = useState<PieceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [pieceId, setPieceId] = useState<string>("");
  const [asCover, setAsCover] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("gallery_pieces")
      .select("id, nome")
      .order("ordem", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "Erro ao carregar obras", description: error.message, variant: "destructive" });
        } else {
          setPieces((data as PieceOption[]) ?? []);
          if (data?.[0]) setPieceId(data[0].id);
        }
        setLoading(false);
      });
  }, [open]);

  const handleConfirm = async () => {
    if (!pieceId) return;
    setSubmitting(true);
    try {
      await onConfirm(pieceId, asCover);
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card/95 backdrop-blur-xl border-border/40">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1.5 block">
              Obra de destino
            </Label>
            {loading ? (
              <div className="h-10 flex items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : (
              <Select value={pieceId} onValueChange={setPieceId}>
                <SelectTrigger className="bg-secondary/40 border-border/40"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pieces.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-3 glass-card p-3 rounded-md">
            <Switch checked={asCover} onCheckedChange={setAsCover} />
            <div>
              <Label className="cursor-pointer">Usar como capa</Label>
              <p className="text-[10px] text-muted-foreground">Substitui a capa atual da obra</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-none font-accent tracking-[0.2em] uppercase text-xs">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!pieceId || submitting}
            className="rounded-none font-accent tracking-[0.2em] uppercase text-xs bg-gradient-purple-wine"
          >
            {submitting ? "Associando…" : "Associar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
