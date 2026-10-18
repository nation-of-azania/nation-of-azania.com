/**
 * GirlieTown's mark: a cherry blossom from the Cherry Grove, drawn on a
 * 13×13 pixel grid like a block texture and scaled without smoothing, so it
 * stays as crisp as the game's own petals. Five petals around a hollow
 * centre, in `currentColor`. Decorative: always paired with text.
 *
 *   .....###.....
 *   ....#####....
 *   ..#.#####.#..
 *   .###########.
 *   #############
 *   ######.######
 *   #####...#####
 *   .#####.#####.
 *   .###########.
 *   ..#########..
 *   ...###.###...
 *   ...###.###...
 *   ....#...#....
 */
const PETALS =
  'M5 0h3v1h-3zM4 1h5v1h-5zM2 2h1v1h-1zM4 2h5v1h-5zM10 2h1v1h-1zM1 3h11v1h-11zM0 4h13v1h-13z' +
  'M0 5h6v1h-6zM7 5h6v1h-6zM0 6h5v1h-5zM8 6h5v1h-5zM1 7h5v1h-5zM7 7h5v1h-5zM1 8h11v1h-11z' +
  'M2 9h9v1h-9zM3 10h3v1h-3zM7 10h3v1h-3zM3 11h3v1h-3zM7 11h3v1h-3zM4 12h1v1h-1zM8 12h1v1h-1z'

export function Blossom({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 13 13"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      shapeRendering="crispEdges"
      className={className}
    >
      <path d={PETALS} fill="currentColor" />
    </svg>
  )
}
