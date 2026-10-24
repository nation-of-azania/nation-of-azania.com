import type { SVGProps } from 'react'

/**
 * The small marks of the map's own chrome: search, layers, zoom, close, a
 * pencil. Same grid and stroke as the place icons (src/maps/icons.tsx), so
 * a button and a pin are plainly of one hand.
 */
const PATHS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  pencil: 'M4 20l4-1 11-11-3-3L5 16zM14 7l3 3',
  pin: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 10h.01',
  road: 'M5 20L9 4M19 20L15 4M12 6v2M12 11v2M12 16v2',
  flag: 'M6 21V4M6 4h11l-2 4 2 4H6',
  frame: 'M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M8 8h8v8H8z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'M5 12l4 4L19 6',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  undo: 'M9 14L4 9l5-5M4 9h9a6 6 0 0 1 0 12h-2',
  redo: 'M15 14l5-5-5-5M20 9h-9a6 6 0 0 0 0 12h2',
  move: 'M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4',
  pen: 'M4 20c4-1 6-3 7-6l7-7-2-2-7 7c-3 1-5 3-5 8zM14 7l3 3',
  line: 'M4 20L20 4M4 20h.01M20 4h.01',
  area: 'M5 8l7-4 7 4v8l-7 4-7-4zM5 8l7 4 7-4M12 12v8',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  arrow: 'M4 12h14M13 6l6 6-6 6',
  cursor: 'M5 3l14 8-6 2-3 6z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  external: 'M14 4h6v6M20 4l-9 9M19 14v6H4V5h6',
  chevron: 'M6 9l6 6 6-6',
  crosshair: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  article: 'M6 3h9l5 5v13H6zM14 3v6h6M9 13h6M9 17h6',
  town: 'M12 3l7 6v12H5V9zM10 21v-5h4v5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  corner: 'M4 20V9a5 5 0 0 1 5-5h11M15 20l5-5-5-5',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  offline: 'M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M2 8.5a15 15 0 0 1 20 0M12 19h.01M3 3l18 18',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
