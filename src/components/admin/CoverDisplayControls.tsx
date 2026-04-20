import { useRef, type MouseEvent } from "react";
import { Label } from "@/components/ui/label";

type CoverFit = "contain" | "cover";

interface Props {
  imageUrl: string;
  coverFit: CoverFit;
  coverPosition: string; // e.g. "50% 50%"
  onChange: (patch: { cover_fit?: string; cover_position?: string }) => void;
}

const parsePosition = (pos: string): { x: number; y: number } => {
  const [xRaw, yRaw] = pos.split(/\s+/);
  const x = parseFloat(xRaw);
  const y = parseFloat(yRaw);
  return {
    x: Number.isFinite(x) ? Math.min(100, Math.max(0, x)) : 50,
    y: Number.isFinite(y) ? Math.min(100, Math.max(0, y)) : 50,
  };
};

export const CoverDisplayControls = ({ imageUrl, coverFit, coverPosition, onChange }: Props) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const { x, y } = parsePosition(coverPosition);

  const handlePreviewClick = (e: MouseEvent<HTMLDivElement>) => {
    if (coverFit !== "cover") return;
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    const clamped = (n: number) => Math.round(Math.min(100, Math.max(0, n)));
    onChange({ cover_position: `${clamped(px)}% ${clamped(py)}%` });
  };

  return (
    <div className="space-y-4 mt-2 p-4 rounded-md border border-border/40 bg-secondary/20">
      <div>
        <Label className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
          Modo de exibição na galeria
        </Label>
        <div className="flex gap-2 mt-2">
          {(["contain", "cover"] as const).map((mode) => {
            const active = coverFit === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onChange({ cover_fit: mode })}
                className={`flex-1 px-4 py-2 rounded-md font-accent text-[11px] tracking-[0.2em] uppercase border transition-colors ${
                  active
                    ? "border-primary bg-primary/15 text-primary-glow"
                    : "border-border/40 bg-secondary/30 text-muted-foreground hover:border-primary-glow/40 hover:text-foreground"
                }`}
              >
                {mode === "contain" ? "Conter (peça inteira)" : "Cobrir (preenche)"}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          {coverFit === "contain"
            ? "A peça aparece inteira no card, com fundo escuro nas laterais quando necessário."
            : "A imagem preenche todo o card. Clique no preview abaixo para escolher qual ponto deve ficar centralizado."}
        </p>
      </div>

      {/* Preview — same proportion as the public gallery card */}
      <div>
        <Label className="font-accent text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
          Preview do card
          {coverFit === "cover" && (
            <span className="ml-2 normal-case tracking-normal text-primary-glow/80">· clique para ajustar foco</span>
          )}
        </Label>
        <div
          ref={previewRef}
          onClick={handlePreviewClick}
          className={`relative mt-2 w-40 sm:w-48 aspect-[3/4] bg-secondary/40 border border-border/40 rounded overflow-hidden ${
            coverFit === "cover" ? "cursor-crosshair" : ""
          }`}
        >
          <img
            src={imageUrl}
            alt="Preview"
            style={{ objectPosition: coverPosition }}
            className={`w-full h-full ${coverFit === "contain" ? "object-contain" : "object-cover"}`}
          />
          {coverFit === "cover" && (
            <div
              className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow-[0_0_0_2px_hsl(var(--primary)/0.7)] pointer-events-none"
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          )}
        </div>
        {coverFit === "cover" && (
          <p className="text-[10px] text-muted-foreground mt-2 font-mono">
            Foco: {Math.round(x)}% × {Math.round(y)}%
          </p>
        )}
      </div>
    </div>
  );
};
