import { useEffect, useState } from "react";
import JSZip from "jszip";
import { Download, Trash2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  clearHistory,
  deleteHistoryRecord,
  listHistoryRecords,
  type HistoryRecord,
} from "@/lib/conversionHistoryDb";
import { formatBytes } from "@/lib/imageSnippet";

interface HistoryTableProps {
  /** Bumped by parent when a new record is saved, forcing a refresh. */
  refreshKey: number;
}

const baseFromName = (name: string): string =>
  name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase() || "imagem";

export const HistoryTable = ({ refreshKey }: HistoryTableProps) => {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      setRecords(await listHistoryRecords());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [refreshKey]);

  const downloadOne = async (rec: HistoryRecord) => {
    if (rec.variants.length === 1) {
      const v = rec.variants[0];
      const url = URL.createObjectURL(v.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = v.filename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const zip = new JSZip();
    rec.variants.forEach((v) => zip.file(v.filename, v.blob));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseFromName(rec.name)}-bundle.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta entrada do histórico?")) return;
    await deleteHistoryRecord(id);
    toast({ title: "Removida" });
    void refresh();
  };

  const clearAll = async () => {
    if (!confirm("Limpar todo o histórico?")) return;
    await clearHistory();
    toast({ title: "Histórico limpo" });
    void refresh();
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }

  if (records.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma conversão salva ainda.</p>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          As entradas ficam no seu navegador (IndexedDB) e podem ser baixadas a qualquer momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="rounded-none font-accent tracking-[0.2em] uppercase text-[10px] hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar histórico
        </Button>
      </div>
      <div className="overflow-x-auto glass-card rounded-md">
        <table className="w-full text-sm">
          <thead className="text-[10px] font-accent tracking-[0.25em] uppercase text-muted-foreground">
            <tr className="border-b border-border/40">
              <th className="text-left px-4 py-3">Arquivo</th>
              <th className="text-left px-4 py-3">Data</th>
              <th className="text-left px-4 py-3">Variantes</th>
              <th className="text-right px-4 py-3">Tamanho total</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-border/20 last:border-0 hover:bg-secondary/20">
                <td className="px-4 py-3 font-display truncate max-w-[260px]" title={r.name}>
                  {r.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums text-xs">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {r.variants.map((v) => v.preset).join(" · ")}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs">
                  {formatBytes(r.totalSize)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => downloadOne(r)}
                      title="Baixar"
                      className="h-8 w-8 hover:bg-primary/15 hover:text-primary-glow"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(r.id)}
                      title="Excluir"
                      className="h-8 w-8 hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
