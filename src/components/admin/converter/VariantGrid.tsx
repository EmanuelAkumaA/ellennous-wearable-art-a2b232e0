import { useState, type ReactNode } from "react";
import { Smartphone, Tablet, Monitor, ImageOff } from "lucide-react";
import { formatBytes } from "@/lib/imageSnippet";

export type VariantKey = "mobile" | "tablet" | "desktop";

export interface VariantSlot {
  key: VariantKey;
  /** Display URL for the thumbnail. */
  url: string | null;
  /** Optional pixel width to display under the label (e.g. 480). */
  width?: number;
  /** Optional pixel height to display under the label (e.g. 360). */
  height?: number;
  /** Optional file size in bytes. */
  sizeBytes?: number;
  /** True when the slot is "active" (used for variant_overrides toggle). */
  active?: boolean;
  /** True when this variant is currently the cover for that device. */
  isCover?: boolean;
  /** Footer / action buttons rendered below the metadata. */
  actions?: ReactNode;
  /** Click on the active toggle. When undefined the toggle row is hidden. */
  onToggleActive?: () => void;
}

interface VariantGridProps {
  slots: VariantSlot[];
  /** When true thumbnails fill a square; otherwise keep the image's aspect. */
  square?: boolean;
  /** Additional density. Defaults to "comfortable". */
  size?: "comfortable" | "compact";
}

const META: Record<VariantKey, { label: string; Icon: typeof Smartphone; defaultWidth: number }> = {
  mobile: { label: "Mobile", Icon: Smartphone, defaultWidth: 480 },
  tablet: { label: "Tablet", Icon: Tablet, defaultWidth: 768 },
  desktop: { label: "Desktop", Icon: Monitor, defaultWidth: 1200 },
};

const Thumb = ({ url, alt, square }: { url: string | null; alt: string; square: boolean }) => {
  const [errored, setErrored] = useState(false);
  const baseCls = `w-full ${square ? "aspect-square" : "aspect-[4/3]"} bg-secondary/30 overflow-hidden rounded-md flex items-center justify-center`;
  if (!url || errored) {
    return (
      <div className={baseCls}>
        <div className="flex flex-col items-center gap-1 text-muted-foreground/60 px-2 text-center">
          <ImageOff className="h-5 w-5" />
          <span className="text-[9px] font-accent tracking-[0.2em] uppercase">arquivo ausente</span>
        </div>
      </div>
    );
  }
  return (
    <div className={baseCls}>
      <img
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setErrored(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export const VariantGrid = ({ slots, square = true, size = "comfortable" }: VariantGridProps) => {
  const padding = size === "compact" ? "p-2" : "p-3";
  const gap = size === "compact" ? "gap-2" : "gap-3";
  return (
    <div className={`grid grid-cols-3 ${gap}`}>
      {slots.map((slot) => {
        const { Icon, label, defaultWidth } = META[slot.key];
        const w = slot.width ?? defaultWidth;
        const h = slot.height;
        const inactive = slot.active === false;
        return (
          <div
            key={slot.key}
            className={`bg-card/40 border border-border/40 rounded-md ${padding} space-y-2 flex flex-col ${
              inactive ? "opacity-60" : ""
            } ${slot.isCover ? "ring-1 ring-primary-glow/60 border-primary-glow/40" : ""}`}
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 text-[9px] font-accent tracking-[0.25em] uppercase text-primary-glow">
                <Icon className="h-3 w-3" />
                <span>{label}</span>
              </div>
              {slot.isCover && (
                <span className="text-[8px] font-accent tracking-[0.2em] uppercase text-primary-glow">
                  ★ capa
                </span>
              )}
            </div>
            <Thumb url={slot.url} alt={`${label} variant`} square={square} />
            <div className="text-[9px] font-accent tracking-[0.2em] uppercase text-muted-foreground space-y-0.5">
              <div className="tabular-nums">
                {w}
                {h ? `×${h}` : "px"}
              </div>
              {typeof slot.sizeBytes === "number" && slot.sizeBytes > 0 && (
                <div className="tabular-nums">{formatBytes(slot.sizeBytes)}</div>
              )}
            </div>
            {slot.onToggleActive && (
              <button
                type="button"
                onClick={slot.onToggleActive}
                className={`text-[9px] font-accent tracking-[0.2em] uppercase rounded px-2 py-1 transition-colors ${
                  inactive
                    ? "bg-muted/30 text-muted-foreground line-through"
                    : "bg-primary/15 text-primary-glow hover:bg-primary/25"
                }`}
              >
                {inactive ? "Inativa" : "✓ Ativa"}
              </button>
            )}
            {slot.actions && <div className="flex flex-col gap-1.5 mt-auto">{slot.actions}</div>}
          </div>
        );
      })}
    </div>
  );
};
