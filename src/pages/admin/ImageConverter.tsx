import { useEffect, useMemo, useState } from "react";
import { Wand2, History, Images, ScrollText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dropzone } from "@/components/admin/converter/Dropzone";
import { QueueItem, type QueueStatus } from "@/components/admin/converter/QueueItem";
import { QueueProgressBar } from "@/components/admin/converter/QueueProgressBar";
import { HistoryTable } from "@/components/admin/converter/HistoryTable";
import { GalleryTab } from "@/components/admin/converter/GalleryTab";
import { LogsTable } from "@/components/admin/converter/LogsTable";

interface QueueEntry {
  id: string;
  file: File;
  status: QueueStatus;
}

const MAX_CONCURRENCY = 2;

export const ImageConverter = () => {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [historyKey, setHistoryKey] = useState(0);
  const [stagingKey, setStagingKey] = useState(0);
  const [tab, setTab] = useState<"convert" | "history" | "gallery" | "logs">("convert");
  const [itemProgress, setItemProgress] = useState<Record<string, number>>({});
  const [completionTimes, setCompletionTimes] = useState<number[]>([]);

  useEffect(() => {
    document.title = "Conversor de Imagens · Atelier";
  }, []);

  const onFiles = (files: File[]) => {
    setQueue((prev) => [
      ...prev,
      ...files.map((f) => ({ id: crypto.randomUUID(), file: f, status: "queued" as QueueStatus })),
    ]);
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
    setItemProgress((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleStatusChange = (id: string, status: QueueStatus) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
    if (status === "done" || status === "error") {
      setCompletionTimes((prev) => [...prev, Date.now()]);
    }
  };

  const handleProgressChange = (id: string, percent: number) => {
    setItemProgress((prev) => (prev[id] === percent ? prev : { ...prev, [id]: percent }));
  };

  const counts = useMemo(() => {
    const total = queue.length;
    const done = queue.filter((q) => q.status === "done").length;
    const failed = queue.filter((q) => q.status === "error").length;
    const inProgress = queue.filter((q) => q.status === "validating" || q.status === "converting").length;
    return { total, done, failed, inProgress };
  }, [queue]);

  // Concurrency control: only the first N "queued" items get autoStart=true.
  const activeIds = useMemo(() => {
    const slots = MAX_CONCURRENCY - counts.inProgress;
    if (slots <= 0) return new Set<string>();
    const ids = new Set<string>();
    let used = 0;
    for (const q of queue) {
      if (q.status === "queued" && used < slots) {
        ids.add(q.id);
        used += 1;
      }
    }
    return ids;
  }, [queue, counts.inProgress]);

  const clearDone = () => {
    const doneIds = new Set(queue.filter((q) => q.status === "done").map((q) => q.id));
    setQueue((prev) => prev.filter((q) => q.status !== "done"));
    setItemProgress((prev) => {
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(prev)) if (!doneIds.has(k)) next[k] = v;
      return next;
    });
  };

  const clearAll = () => {
    setQueue([]);
    setItemProgress({});
    setCompletionTimes([]);
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-6">
      <TabsList className="bg-card/50 backdrop-blur border border-border/40 flex-wrap h-auto">
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
          <History className="h-3.5 w-3.5 mr-1.5" /> Histórico local
        </TabsTrigger>
        <TabsTrigger
          value="gallery"
          className="font-accent text-[11px] tracking-[0.25em] uppercase data-[state=active]:bg-primary/15 data-[state=active]:text-primary-glow"
        >
          <Images className="h-3.5 w-3.5 mr-1.5" /> Galeria
        </TabsTrigger>
        <TabsTrigger
          value="logs"
          className="font-accent text-[11px] tracking-[0.25em] uppercase data-[state=active]:bg-primary/15 data-[state=active]:text-primary-glow"
        >
          <ScrollText className="h-3.5 w-3.5 mr-1.5" /> Logs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="convert" className="space-y-6 m-0">
        <Dropzone onFiles={onFiles} />

        <QueueProgressBar
          total={counts.total}
          done={counts.done}
          failed={counts.failed}
          inProgress={counts.inProgress}
          itemProgress={itemProgress}
          completionTimes={completionTimes}
          hasDone={counts.done > 0}
          onClearDone={clearDone}
        />

        {queue.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="font-accent text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
              {queue.length} {queue.length === 1 ? "imagem" : "imagens"} na fila · até {MAX_CONCURRENCY} em paralelo
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] font-accent tracking-[0.25em] uppercase text-muted-foreground hover:text-destructive transition-colors"
            >
              Limpar tudo
            </button>
          </div>
        )}

        <div className="space-y-4">
          {queue.map((q) => (
            <QueueItem
              key={q.id}
              id={q.id}
              file={q.file}
              autoStart={activeIds.has(q.id) || q.status !== "queued"}
              onRemove={removeItem}
              onSavedToHistory={() => setHistoryKey((k) => k + 1)}
              onStatusChange={handleStatusChange}
              onStagingSaved={() => setStagingKey((k) => k + 1)}
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="history" className="m-0">
        <HistoryTable refreshKey={historyKey} />
      </TabsContent>

      <TabsContent value="gallery" className="m-0">
        <GalleryTab refreshKey={stagingKey} />
      </TabsContent>

      <TabsContent value="logs" className="m-0">
        <LogsTable />
      </TabsContent>
    </Tabs>
  );
};

export default ImageConverter;
