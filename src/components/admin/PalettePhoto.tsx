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
  /** Optional 5 hex colors. Slots 0–3 → animated gradient border. Slot 4 → solid background fill (when no photo). */
  colors?: string[] | null;
}

const SIZES: Record<Size, { box: number; initials: string; dot: number }> = {
  sm: { box: 68, initials: "text-sm", dot: 3.2 },
  md: { box: 84, initials: "text-base", dot: 4 },
  lg: { box: 144, initials: "text-3xl", dot: 7 },
};

const PALETTE_PATH =
  "M 50 4 C 78 4 96 22 96 48 C 96 70 82 86 64 92 C 56 95 50 95 44 92 C 38 89 34 83 32 76 C 30 69 24 66 18 68 C 10 70 4 64 4 56 C 4 30 22 4 50 4 Z";

const THUMB_HOLE = { cx: 26, cy: 60, r: 5 };

export const DEFAULT_PALETTE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary-glow))",
  "hsl(var(--accent-red))",
  "hsl(var(--deep-blue))",
  "hsl(45 90% 60%)",
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

  const borderColors = [palette[0], palette[1], palette[2], palette[3]];
  const bgFill = palette[4];

  // Conic gradient for animated border (uses --angle so the gradient itself spins, not the element)
  const borderGradient = `conic-gradient(from var(--angle, 0deg), ${borderColors[0]}, ${borderColors[1]}, ${borderColors[2]}, ${borderColors[3]}, ${borderColors[0]})`;

  return (
    <div
      className={`palette-frame relative inline-block group ${editable ? "cursor-pointer" : ""} ${className}`}
      style={{ width: box, height: box, filter: "drop-shadow(0 8px 20px hsl(var(--primary) / 0.35))" }}
      onClick={editable ? onPick : undefined}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      aria-label={editable ? "Trocar foto de perfil" : undefined}
    >
      {/* Animated gradient border layer — clipped to the palette outline */}
      <div
        className="palette-border absolute inset-0 animate-palette-spin"
        style={{
          background: borderGradient,
          WebkitClipPath: `path('${PALETTE_PATH}')`,
          clipPath: `path('${PALETTE_PATH}')`,
          transform: "scale(1)",
        }}
      />

      {/* Inner content (slightly inset to reveal the border underneath) */}
      <svg
        viewBox="0 0 100 100"
        width={box}
        height={box}
        className="absolute inset-0"
        style={{
          WebkitClipPath: `path('${PALETTE_PATH}')`,
          clipPath: `path('${PALETTE_PATH}')`,
          transform: "scale(0.94)",
          transformOrigin: "50% 50%",
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <path
              d={`${PALETTE_PATH} M ${THUMB_HOLE.cx + THUMB_HOLE.r} ${THUMB_HOLE.cy} a ${THUMB_HOLE.r} ${THUMB_HOLE.r} 0 1 0 -${THUMB_HOLE.r * 2} 0 a ${THUMB_HOLE.r} ${THUMB_HOLE.r} 0 1 0 ${THUMB_HOLE.r * 2} 0 Z`}
              fillRule="evenodd"
            />
          </clipPath>
        </defs>

        {/* Body */}
        <g clipPath={`url(#${clipId})`}>
          {/* Solid background = 5th color (always present so transparent images blend nicely) */}
          <rect width="100" height="100" fill={bgFill} />
          {src && (
            <image
              href={src}
              x="-2"
              y="0"
              width="104"
              height="100"
              preserveAspectRatio="xMidYMid slice"
            />
          )}
        </g>

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
            className={`font-display text-white/95 ${initialsCls} drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]`}
            style={{ marginLeft: "6%", marginTop: "-2%" }}
          >
            {initials}
          </span>
        </div>
      )}

      {/* Editable hover overlay */}
      {editable && (
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            WebkitClipPath: `path('${PALETTE_PATH}')`,
            clipPath: `path('${PALETTE_PATH}')`,
          }}
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
