import { useId } from "react";
import { Camera } from "lucide-react";

type Size = "sm" | "md" | "lg";

interface PalettePhotoProps {
  src?: string | null;
  initials?: string;
  size?: Size;
  editable?: boolean;
  onPick?: () => void;
  className?: string;
  /** Optional 5 hex colors for the paint dots. Falls back to brand tokens when omitted. */
  colors?: string[] | null;
}

const SIZES: Record<Size, { box: number; initials: string; dot: number }> = {
  sm: { box: 52, initials: "text-[11px]", dot: 3 },
  md: { box: 80, initials: "text-base", dot: 4 },
  lg: { box: 144, initials: "text-3xl", dot: 7 },
};

const PALETTE_PATH =
  "M 50 4 C 78 4 96 22 96 48 C 96 70 82 86 64 92 C 56 95 50 95 44 92 C 38 89 34 83 32 76 C 30 69 24 66 18 68 C 10 70 4 64 4 56 C 4 30 22 4 50 4 Z";

const THUMB_HOLE = { cx: 26, cy: 60, r: 5 };

export const DEFAULT_PALETTE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary-glow))",
  "hsl(var(--brand-red))",
  "hsl(var(--brand-deepblue))",
  "hsl(var(--brand-gold, 45 90% 60%))",
];

const DOT_POSITIONS = [
  { cx: 72, cy: 22 },
  { cx: 82, cy: 30 },
  { cx: 78, cy: 42 },
  { cx: 66, cy: 32 },
  { cx: 88, cy: 50 },
];

export const PalettePhoto = ({
  src,
  initials = "?",
  size = "md",
  editable = false,
  onPick,
  className = "",
  colors,
}: PalettePhotoProps) => {
  const id = useId();
  const clipId = `palette-clip-${id}`;
  const { box, initials: initialsCls, dot } = SIZES[size];

  const palette =
    Array.isArray(colors) && colors.length === 5 ? colors : DEFAULT_PALETTE_COLORS;

  return (
    <div
      className={`relative inline-block group ${editable ? "cursor-pointer" : ""} ${className}`}
      style={{ width: box, height: box, filter: "drop-shadow(0 8px 20px hsl(var(--primary) / 0.35))" }}
      onClick={editable ? onPick : undefined}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      aria-label={editable ? "Trocar foto de perfil" : undefined}
    >
      <svg viewBox="0 0 100 100" width={box} height={box} className="absolute inset-0">
        <defs>
          <clipPath id={clipId}>
            <path d={`${PALETTE_PATH} M ${THUMB_HOLE.cx + THUMB_HOLE.r} ${THUMB_HOLE.cy} a ${THUMB_HOLE.r} ${THUMB_HOLE.r} 0 1 0 -${THUMB_HOLE.r * 2} 0 a ${THUMB_HOLE.r} ${THUMB_HOLE.r} 0 1 0 ${THUMB_HOLE.r * 2} 0 Z`} fillRule="evenodd" />
          </clipPath>
          <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.85)" />
            <stop offset="100%" stopColor="hsl(var(--brand-red) / 0.75)" />
          </linearGradient>
        </defs>

        {/* Body */}
        <g clipPath={`url(#${clipId})`}>
          {src ? (
            <image href={src} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" />
          ) : (
            <rect width="100" height="100" fill={`url(#bg-${id})`} />
          )}
        </g>

        {/* Outer stroke */}
        <path d={PALETTE_PATH} fill="none" stroke="hsl(var(--primary-glow) / 0.5)" strokeWidth="0.8" />
        {/* Thumb hole inner ring */}
        <circle
          cx={THUMB_HOLE.cx}
          cy={THUMB_HOLE.cy}
          r={THUMB_HOLE.r}
          fill="none"
          stroke="hsl(var(--primary-glow) / 0.4)"
          strokeWidth="0.6"
        />

        {/* Paint dots */}
        {DOT_POSITIONS.map((d, i) => (
          <g key={i}>
            <circle cx={d.cx} cy={d.cy} r={dot * 0.9} fill={palette[i]} opacity="0.95" />
            <circle cx={d.cx - dot * 0.25} cy={d.cy - dot * 0.25} r={dot * 0.25} fill="white" opacity="0.5" />
          </g>
        ))}
      </svg>

      {/* Initials overlay when no src */}
      {!src && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className={`font-display text-white/90 ${initialsCls} drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]`}
            style={{ marginLeft: "8%", marginTop: "-4%" }}
          >
            {initials}
          </span>
        </div>
      )}

      {/* Editable hover overlay */}
      {editable && (
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ clipPath: "url(#" + clipId + ")" }}
        >
          <div className="absolute inset-0 bg-black/55" />
          <div className="relative flex flex-col items-center gap-1 text-white">
            <Camera className="h-5 w-5" />
            <span className="font-accent text-[9px] tracking-[0.25em] uppercase">Trocar</span>
          </div>
        </div>
      )}
    </div>
  );
};
