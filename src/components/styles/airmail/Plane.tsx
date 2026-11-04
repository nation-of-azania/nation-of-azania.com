/**
 * Airmail's mark: a paper plane climbing away to the upper right, drawn on
 * a 13×13 pixel grid like a block texture and scaled without smoothing, so
 * it stays as crisp as the game's own items. The two wings either side of
 * the fold, and the tail wing beneath, in `currentColor`. Decorative:
 * always paired with text. The path is exported for the link-preview cards
 * (src/components/og), which draw it in a literal colour.
 *
 *   ...........#.
 *   .........###.
 *   ......####.#.
 *   ..#######.##.
 *   .#######.##..
 *   ..#####.###..
 *   ...###.####..
 *   .......###...
 *   ......####...
 *   .......###...
 *   .......###...
 *   ........#....
 *   .............
 */
export const PLANE =
  'M11 0h1v1h-1zM9 1h3v1h-3zM6 2h4v1h-4zM11 2h1v1h-1zM2 3h7v1h-7zM10 3h2v1h-2zM1 4h7v1h-7zM9 4h2v1h-2z' +
  'M2 5h5v1h-5zM8 5h3v1h-3zM3 6h3v1h-3zM7 6h4v1h-4zM7 7h3v1h-3zM6 8h4v1h-4zM7 9h3v1h-3zM7 10h3v1h-3z' +
  'M8 11h1v1h-1z'

/** The plane's grid: 13 pixels square. */
export const PLANE_GRID = 13

export function Plane({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 13 13"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      shapeRendering="crispEdges"
      className={className}
    >
      <path d={PLANE} fill="currentColor" />
    </svg>
  )
}
