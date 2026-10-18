/**
 * The national crest of Azania, drawn by hand as inline SVG.
 *
 * Blazon (loosely): beneath a sun in splendour, a lighthouse on its rock
 * above the sea barry-wavy, the shield flanked by two branches of coral.
 * The lighthouse is the one on Founders' Point; the waves are the roads of
 * Port Azania. Everything uses `currentColor`, so it reads equally well in
 * sea indigo on sand and in sand or saffron on sea.
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
      <CrestShapes />
    </svg>
  )
}

/** The crest's drawing: 64 wide, 75 tall. */
export const CREST_BOX = { width: 64, height: 75 } as const

/**
 * The shapes of the crest, in one colour: `currentColor` on the site, or a
 * literal colour where no stylesheet reaches — the link-preview cards
 * (src/components/og), which are drawn off the DOM.
 */
export function CrestShapes({ color = 'currentColor' }: { color?: string }) {
  return (
    <g fill="none">
      {/* Sun in splendour */}
      <circle cx="32" cy="9" r="3.6" fill={color} />
      <path
        d="M32 1.5 V3.8 M32 14.2 V16.5 M24.5 9 H26.8 M37.2 9 H39.5 M26.7 3.7 L28.3 5.3 M35.7 12.7 L37.3 14.3 M37.3 3.7 L35.7 5.3 M28.3 12.7 L26.7 14.3"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Shield */}
      <path
        d="M14 20 H50 V42 C50 53.5 42.5 61 32 67 C21.5 61 14 53.5 14 42 Z"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* The lighthouse on Founders' Point: roof, lantern, tapered tower */}
      <path d="M27.8 27.2 L32 23.2 L36.2 27.2 Z" fill={color} />
      <path d="M28.6 27.2 H35.4 V30.4 H28.6 Z" fill={color} />
      <path d="M29.6 31.6 H34.4 L35.6 45 H28.4 Z" fill={color} />
      {/* The light */}
      <path
        d="M20.5 28.8 H25.2 M38.8 28.8 H43.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* The rock */}
      <path d="M22.5 49 L27 44.8 H37 L41.5 49 Z" fill={color} />
      {/* The sea, barry-wavy */}
      <path
        d="M18.5 53.2 C21 50.8 23.5 50.8 26 53.2 S31 55.6 33.5 53.2 S38.5 50.8 41 53.2 S44.5 55 45.5 53.6"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20.5 57.8 C23 55.4 25.5 55.4 28 57.8 S33 60.2 35.5 57.8 S40.5 55.4 43 57.8"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M24.5 62.2 C26.6 60 28.8 60 31 62.2 S35.4 64.4 37.6 62.2 S39.3 61 39.8 61.4"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Coral branch, dexter */}
      <path
        d="M10 42 C8.5 53 14 64 24.5 70.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9.3 48.5 L5.6 46.2 M9.3 48.5 L6.4 50.8 M10.6 55.5 L6.6 54.6 M10.6 55.5 L7.4 58.2 M13.6 62 L9.8 62.6 M13.6 62 L11.2 65.3 M18.4 67.3 L15.2 68.6 M18.4 67.3 L16.8 70.9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Coral branch, sinister */}
      <path
        d="M54 42 C55.5 53 50 64 39.5 70.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M54.7 48.5 L58.4 46.2 M54.7 48.5 L57.6 50.8 M53.4 55.5 L57.4 54.6 M53.4 55.5 L56.6 58.2 M50.4 62 L54.2 62.6 M50.4 62 L52.8 65.3 M45.6 67.3 L48.8 68.6 M45.6 67.3 L47.2 70.9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  )
}
