interface DragonProps {
  className?: string;
}

export const Dragon = ({ className = "" }: DragonProps) => (
  <svg
    viewBox="0 0 600 600"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="dragonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(274 76% 53%)" stopOpacity="0.6" />
        <stop offset="100%" stopColor="hsl(357 84% 51%)" stopOpacity="0.4" />
      </linearGradient>
    </defs>
    {/* Coiling oriental dragon */}
    <path
      d="M 100 300 Q 60 220 140 180 Q 240 140 320 200 Q 400 260 460 220 Q 520 180 540 240 Q 550 290 500 320 Q 440 350 380 320 Q 320 300 280 340 Q 220 390 160 360 Q 110 340 100 300 Z"
      stroke="url(#dragonGrad)"
      strokeWidth="3"
      fill="none"
      opacity="0.9"
    />
    {/* Inner coils */}
    <path
      d="M 150 280 Q 200 250 260 270 Q 320 290 380 270 Q 440 250 480 280"
      stroke="url(#dragonGrad)"
      strokeWidth="2"
      fill="none"
      opacity="0.7"
      strokeDasharray="4 6"
    />
    {/* Head */}
    <path
      d="M 80 300 Q 50 280 60 250 Q 75 230 100 240 Q 115 250 110 270 Q 105 285 90 290"
      stroke="url(#dragonGrad)"
      strokeWidth="3"
      fill="none"
    />
    {/* Whiskers */}
    <path d="M 60 260 Q 30 240 20 200" stroke="hsl(357 84% 51%)" strokeWidth="1.5" fill="none" opacity="0.6" />
    <path d="M 70 280 Q 40 290 25 320" stroke="hsl(357 84% 51%)" strokeWidth="1.5" fill="none" opacity="0.6" />
    {/* Eye */}
    <circle cx="78" cy="260" r="3" fill="hsl(357 84% 51%)" opacity="0.9" />
    {/* Scales suggestion */}
    <g opacity="0.5">
      <circle cx="200" cy="220" r="4" stroke="hsl(274 76% 53%)" fill="none" />
      <circle cx="280" cy="240" r="4" stroke="hsl(274 76% 53%)" fill="none" />
      <circle cx="360" cy="260" r="4" stroke="hsl(274 76% 53%)" fill="none" />
      <circle cx="440" cy="280" r="4" stroke="hsl(274 76% 53%)" fill="none" />
    </g>
    {/* Tail flame */}
    <path
      d="M 540 240 Q 570 220 580 190 Q 575 170 555 175 Q 565 200 540 240"
      fill="url(#dragonGrad)"
      opacity="0.5"
    />
  </svg>
);
