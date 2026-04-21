import { useCallback, useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const BUCKET = "optimized-images";

interface UploadDropzoneProps {
  onUploaded?: () => void;
}

export const UploadDropzone = ({ onUploaded }: UploadDropzoneProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;
      setBusy(true);
      try {
        for (let i = 0; i < list.length; i++) {
          const file = list[i];
          setProgress(`${i + 1}/${list.length} · ${file.name}`);

          if (!ACCEPTED.includes(file.type)) {
            toast({ title: "Formato não suportado", description: file.name, variant: "destructive" });
            continue;
          }
          if (file.size > MAX_BYTES) {
            toast({ title: "Arquivo > 10MB", description: file.name, variant: "destructive" });
            continue;
          }

          const ext = file.name.split(".").pop()?.toLowerCase() || (file.type.split("/")[1] ?? "jpg");
          const id = crypto.randomUUID();
          const path = `images/${id}/original.${ext}`;

          // 1. Upload original
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) {
            toast({ title: "Falha no upload", description: upErr.message, variant: "destructive" });
            continue;
          }

          // 2. Insert row
          const { data: row, error: insErr } = await supabase
            .from("optimized_images")
            .insert({
              id,
              name: file.name,
              original_path: path,
              original_size_bytes: file.size,
              status: "processing",
            })
            .select("id")
            .single();
          if (insErr || !row) {
            await supabase.storage.from(BUCKET).remove([path]);
            toast({ title: "Erro ao registrar", description: insErr?.message, variant: "destructive" });
            continue;
          }

          // 3. Fire-and-forget pipeline
          supabase.functions
            .invoke("optimize-image", { body: { imageId: row.id } })
            .catch((e) => console.error("optimize-image invoke failed:", e));
        }
        toast({ title: "Upload concluído", description: "Processando variantes…" });
        onUploaded?.();
      } finally {
        setBusy(false);
        setProgress(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onUploaded],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
      }}
      className={`relative rounded-lg border-2 border-dashed transition-all ${
        dragActive ? "border-primary bg-primary/5" : "border-border/60 bg-card/30"
      } p-8 text-center`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary-glow">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
        </div>
        <div>
          <p className="font-display text-lg">Arraste imagens aqui</p>
          <p className="text-xs text-muted-foreground mt-1">
            JPG, PNG ou WebP · até 10MB · serão geradas variantes AVIF/WebP/JPG em 4 larguras
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary/15 hover:bg-primary/25 text-primary-glow font-accent text-[11px] tracking-[0.3em] uppercase px-4 py-2 transition-colors disabled:opacity-50"
        >
          {busy ? "Enviando…" : "Selecionar arquivos"}
        </button>
        {progress && <p className="text-[10px] text-muted-foreground">{progress}</p>}
      </div>
    </div>
  );
};
