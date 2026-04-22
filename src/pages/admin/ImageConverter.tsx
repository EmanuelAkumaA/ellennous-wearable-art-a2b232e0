import { useEffect, useState } from "react";
import { Wand2, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dropzone } from "@/components/admin/converter/Dropzone";
import { QueueItem } from "@/components/admin/converter/QueueItem";
import { HistoryTable } from "@/components/admin/converter/HistoryTable";

interface QueueEntry {
  id: string;
  file: File;
}

export const ImageConverter = () => {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [historyKey, setHistoryKey] = useState(0);
  const [tab, setTab] = useState<"convert" | "history">("convert");

  useEffect(() => {
    document.title = "Conversor de Imagens · Atelier";
  }, []);

  const onFiles = (files: File[]) => {
    setQueue((prev) => [
      ...prev,
      ...files.map((f) => ({ id: crypto.randomUUID(), file: f })),
    ]);
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const clearQueue = () => setQueue([]);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-6">
      <TabsList className="bg-card/50 backdrop-blur border border-border/40">
        <TabsTrigger
          value="convert"
          className="font-accent text-[11px] tracking-[0.25em] uppercase data-[state=active]:bg-primary/15 data-[state=active]:text-primary-glow"
        >
          <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Conversor
        </TabsTrigger>
        <TabsTrigger
          value="history"
          className="font-accent text-[11px] tracking-[0.25em] uppercase data-[state=active]:bg-primary/15 data-[state=active]:text-primary-glow"
        >
          <History className="h-3.5 w-3.5 mr-1.5" /> Histórico
        </TabsTrigger>
      </TabsList>

      <TabsContent value="convert" className="space-y-6 m-0">
        <Dropzone onFiles={onFiles} />

        {queue.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="font-accent text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
              {queue.length} {queue.length === 1 ? "imagem" : "imagens"} na fila
            </p>
            <button
              type="button"
              onClick={clearQueue}
              className="text-[10px] font-accent tracking-[0.25em] uppercase text-muted-foreground hover:text-destructive transition-colors"
            >
              Limpar fila
            </button>
          </div>
        )}

        <div className="space-y-4">
          {queue.map((q) => (
            <QueueItem
              key={q.id}
              id={q.id}
              file={q.file}
              onRemove={removeItem}
              onSavedToHistory={() => setHistoryKey((k) => k + 1)}
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="history" className="m-0">
        <HistoryTable refreshKey={historyKey} />
      </TabsContent>
    </Tabs>
  );
};

export default ImageConverter;
