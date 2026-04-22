import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { ACCEPTED_INPUT_EXT, ACCEPTED_INPUT_MIME } from "@/lib/imageConverter";
import { validateFiles, VALIDATION_LIMITS } from "@/lib/converterValidation";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export const Dropzone = ({ onFiles, disabled }: DropzoneProps) => {
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      const arr = Array.from(files);
      if (!arr.length) return;
      const { valid, errors } = validateFiles(arr);
      if (errors.length) {
        toast({
          title: errors.length === 1 ? "Arquivo rejeitado" : `${errors.length} arquivos rejeitados`,
          description: errors
            .slice(0, 4)
            .map((e) => `${e.file.name}: ${e.reason}`)
            .join("\n"),
          variant: "destructive",
        });
      }
      if (valid.length) onFiles(valid);
    },
    [onFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setActive(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-all p-10 text-center",
        active ? "border-primary bg-primary/10" : "border-border/60 bg-card/40",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={[...ACCEPTED_INPUT_MIME, ...ACCEPTED_INPUT_EXT].join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          handle(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary-glow">
          <UploadCloud className="h-6 w-6" />
        </div>
        <div>
          <p className="font-display text-xl">Arraste imagens aqui</p>
          <p className="text-xs text-muted-foreground mt-1">
            JPG, PNG, WebP ou HEIC · até {VALIDATION_LIMITS.maxSizeMb} MB · conversão local no navegador
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary/15 hover:bg-primary/25 text-primary-glow font-accent text-[11px] tracking-[0.3em] uppercase px-5 py-2.5 transition-colors disabled:opacity-50"
        >
          Selecionar arquivos
        </button>
      </div>
    </div>
  );
};
