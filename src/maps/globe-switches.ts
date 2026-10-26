/**
 * The globe's switches, apart from its arithmetic (./globe.ts), for the
 * flat map's gestures (src/components/maps/leaflet/canvas.tsx) and the
 * globe itself alike. Its main switch, which turns it off everywhere, its
 * button and all, rides alone with the map's first load, where the shell
 * decides whether to offer the globe at all
 * (src/components/maps/globe/support.ts → ENABLED); the thresholds of the
 * pull that opens it are with the flat map's gestures (./view.ts → PULL).
 */

/**
 * With `curl` off the globe stays, but opens and closes with a fade rather
 * than the flat map rolling up into it. `lingerMs` is how long a globe that
 * has closed stays mounted, hidden and drawing nothing, so that opening it
 * again is instant, before its memory is given back.
 */
export const GLOBE: { curl: boolean; lingerMs: number } = {
  curl: true,
  lingerMs: 60_000,
}
