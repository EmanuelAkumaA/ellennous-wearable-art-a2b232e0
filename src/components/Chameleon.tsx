interface ChameleonProps {
  color?: string;
  className?: string;
  size?: number;
}

export const Chameleon = ({ color = "currentColor", className = "", size = 80 }: ChameleonProps) => (
  <svg
    viewBox="0 0 200 120"
    width={size}
    height={(size * 120) / 200}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Tail curl */}
    <path
      d="M 175 70 Q 195 70 192 50 Q 188 35 175 40 Q 168 45 172 55"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.85"
    />
    {/* Body */}
    <path
      d="M 50 70 Q 40 50 60 45 Q 90 38 120 42 Q 150 46 170 55 Q 178 62 175 70 Q 165 78 140 78 Q 100 80 70 78 Q 55 76 50 70 Z"
      fill={color}
      opacity="0.9"
    />
    {/* Crest */}
    <path
      d="M 60 45 Q 65 32 72 38 Q 78 30 85 36 Q 92 28 100 35"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    {/* Head */}
    <path
      d="M 40 60 Q 30 55 35 48 Q 45 42 55 48 Q 58 55 50 62 Z"
      fill={color}
    />
    {/* Eye */}
    <circle cx="44" cy="54" r="4" fill="hsl(var(--background))" />
    <circle cx="44" cy="54" r="2.2" fill={color} className="origin-center" style={{ animation: "chameleon-blink 6s infinite" }} />
    {/* Legs */}
    <path d="M 75 78 Q 72 90 68 95 Q 65 98 70 100" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M 130 78 Q 132 92 136 98 Q 140 102 134 104" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* Spots */}
    <circle cx="90" cy="58" r="2" fill="hsl(var(--background))" opacity="0.4" />
    <circle cx="115" cy="62" r="2.5" fill="hsl(var(--background))" opacity="0.3" />
    <circle cx="140" cy="60" r="1.8" fill="hsl(var(--background))" opacity="0.4" />
  </svg>
);
