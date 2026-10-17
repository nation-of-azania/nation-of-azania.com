/**
 * The national crest of Condoria, drawn by hand as inline SVG.
 *
 * Blazon (loosely): beneath the North Star, a condor volant above three
 * peaks and the valley river, the shield flanked by laurel. Everything uses
 * `currentColor`, so it reads equally well in pine on parchment and in
 * parchment or gold on pine.
 *
 * Decorative by default (`aria-hidden`) — always pair it with visible text.
 */
export function Crest({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 75"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* North Star */}
      <path
        d="M32 3 L33.41 7.06 L37.71 7.15 L34.28 9.74 L35.53 13.85 L32 11.4 L28.47 13.85 L29.72 9.74 L26.29 7.15 L30.59 7.06 Z"
        fill="currentColor"
      />
      {/* Shield */}
      <path
        d="M14 20 H50 V40 C50 51 42.5 59 32 65 C21.5 59 14 51 14 40 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Per-fess division */}
      <path d="M14 40 H50" stroke="currentColor" strokeWidth="1.5" />
      {/* Condor volant */}
      <path
        d="M18.5 28.5 C23 33.5 27.5 35 32 34 C36.5 35 41 33.5 45.5 28.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M32 34 L33.8 38.7 L30.2 38.7 Z" fill="currentColor" />
      {/* Three peaks */}
      <path
        d="M20.5 53.5 L27.5 44.5 L31.5 49.5 L36.5 42.5 L43.5 53.5 Z"
        fill="currentColor"
      />
      {/* The valley river */}
      <path
        d="M24 58.5 H40 M27 62 H37"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Laurel, dexter */}
      <path
        d="M10 42 C8.5 53 14 64 24.5 70.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9.3 48.5 L5.2 46.8 M10.6 55.5 L6.3 55.7 M13.6 62 L9.8 64 M18.4 67.3 L15.6 70.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Laurel, sinister */}
      <path
        d="M54 42 C55.5 53 50 64 39.5 70.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M54.7 48.5 L58.8 46.8 M53.4 55.5 L57.7 55.7 M50.4 62 L54.2 64 M45.6 67.3 L48.4 70.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
