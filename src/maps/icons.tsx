import { PLACE_CATEGORIES, type PlaceCategory } from './registry'

/**
 * The icons of Azania Maps' places, one per category (PLACE_CATEGORIES),
 * drawn as a family: every glyph on the same 24-unit grid, in the same
 * 2-unit stroke with round caps, no fills except the few marks that need
 * one. They sit in a pin's disc at 14 px and in the legend at 20 px, so
 * each is one shape a reader can name at a glance — a cup, an anchor, a
 * tree — rather than a picture. `fill` marks a glyph drawn solid.
 */
export const ICONS: Record<PlaceCategory, { d: string; fill?: boolean }> = {
  restaurant: { d: 'M7 3v6a2.5 2.5 0 0 0 5 0V3M9.5 3v18M17 3c-2 2.5-2 7 0 9v9M17 3v9' },
  cafe: { d: 'M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM16 10h2a2 2 0 0 1 0 4h-2M5 21h12' },
  bar: { d: 'M7 3h10l-1 7.5a4 4 0 0 1-8 0zM12 15v6M8 21h8M7.6 7h8.8' },
  bakery: { d: 'M3 14c0-4 4-7 9-7s9 3 9 7v5H3zM9 10.5l-1 2.5M13 10l-1 2.5M17 10.5l-1 2.5' },
  shop: {
    d: 'M3 9l2-5h14l2 5M3 9h18M3 9a3 3 0 0 0 6 0a3 3 0 0 0 6 0a3 3 0 0 0 6 0M5 12v9h14v-9M10 21v-5h4v5',
  },
  market: { d: 'M2 9l3-5h14l3 5zM4 9v12M20 9v12M4 15h16M9 21v-6M15 21v-6' },
  bank: { d: 'M3 10h18M12 3l9 7H3zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18' },
  hotel: { d: 'M3 19V7M3 13h18v6M3 16h18M7 13V9h5v4' },
  townhall: {
    d: 'M4 21V11h16v10M2 21h20M12 11V3M12 3h5l-1.5 2.5L17 8h-5M8 21v-5h8v5M7 14v3M17 14v3',
  },
  government: {
    d: 'M4 21h16M5 21v-8M19 21v-8M3 13h18M12 3v2.5M6.5 13a5.5 5.5 0 0 1 11 0M9 21v-4M15 21v-4',
  },
  embassy: { d: 'M5 21V4M5 4h13l-2.5 4.5L18 13H5' },
  court: { d: 'M12 3v18M8 21h8M4 7h16M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z' },
  post: { d: 'M3 6h18v12H3zM3 6l9 7 9-7' },
  museum: { d: 'M3 4h18v16H3zM3 15l5-5 4 4 3-3 6 6M16.5 8.5h.01' },
  library: {
    d: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  },
  theatre: { d: 'M4 4h16c0 7-3 12-8 14C7 16 4 11 4 4zM9 9h.01M15 9h.01M9 13a4 4 0 0 0 6 0' },
  worship: { d: 'M12 2v4M10 4h4M8 21V10l4-5 4 5v11M4 21h16M10 21v-4h4v4' },
  monument: { d: 'M12 3l3 4v12H9V7zM6 21h12M9 19h6' },
  castle: { d: 'M4 21V7h3v3h3V7h4v3h3V7h3v14M4 21h16M10 21v-5h4v5' },
  school: { d: 'M2 9l10-5 10 5-10 5zM6 11v5c0 2 3 3 6 3s6-1 6-3v-5M22 9v6' },
  hospital: { d: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' },
  station: {
    d: 'M5 3h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM5 10h14M8.5 13.5h.01M15.5 13.5h.01M8 21l2-4M16 21l-2-4M9 6.5h6',
  },
  port: { d: 'M12 22V8M5 12H2a10 10 0 0 0 20 0h-3M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  airfield: { d: 'M12 4c-4 0-9 4-9 10l6-2 3 8 3-8 6 2c0-6-5-10-9-10zM12 4v16' },
  portal: { d: 'M6 3h12v18H6zM9 6h6v12H9z' },
  park: { d: 'M12 3l-5 7h3l-4 6h5v5h2v-5h5l-4-6h3z' },
  viewpoint: { d: 'M3 20l6-9 4 6 2-3 6 6zM17 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z' },
  beach: { d: 'M5 12a8 8 0 0 1 16 0zM13 12l-3 8M3 20c2-2 4-2 6 0s4 2 6 0' },
  farm: {
    d: 'M12 21V9M12 9c-3 0-5-2-5-5 3 0 5 2 5 5zM12 9c3 0 5-2 5-5-3 0-5 2-5 5zM12 14c-3 0-5-2-5-5 3 0 5 2 5 5zM12 14c3 0 5-2 5-5-3 0-5 2-5 5z',
  },
  mine: { d: 'M4 20l9-9M10 8l6 6M5 5c4-1 9 0 12 3s4 8 3 12' },
  workshop: { d: 'M3 21V12l5 3v-3l5 3v-3l5 3V3h3v18z' },
  residence: { d: 'M3 11l9-8 9 8M5 9v12h14V9M10 21v-6h4v6' },
  landmark: {
    d: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    fill: true,
  },
  other: { d: 'M5 12h.01M12 12h.01M19 12h.01' },
}

/**
 * A category's glyph, to set inside another SVG: positioned by the caller
 * via a transform, drawn in `currentColor`. Width 2 on the 24 grid.
 */
export function PlaceGlyph({ category }: { category: PlaceCategory }) {
  const icon = ICONS[category] ?? ICONS.other
  return (
    <path
      d={icon.d}
      fill={icon.fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
  )
}

/** A category's icon on its own, for legends, lists and pickers. */
export function PlaceIcon({
  category,
  className,
  title,
}: {
  category: PlaceCategory
  className?: string
  title?: string
}) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      className={className}
      role={title ? 'img' : undefined}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <PlaceGlyph category={category} />
    </svg>
  )
}

export const isPlaceCategory = (value: unknown): value is PlaceCategory =>
  typeof value === 'string' && value in PLACE_CATEGORIES
