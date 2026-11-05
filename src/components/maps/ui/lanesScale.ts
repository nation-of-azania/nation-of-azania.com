import { reachOf, type RoadLanes } from '@/maps/lanes'

/**
 * A cross-section strip (./LanesStrip.tsx) is laid out about the drawn
 * line, which stays at the middle of its frame: the frame spans as far
 * each side as the road reaches on its further side, so the road grows
 * from the line both ways and a pavement on one side leaves ground bare on
 * the other. Plain arithmetic, kept apart from the strip so a
 * server-rendered page (the road's) can size it too.
 */

/** How many blocks the frame spans: twice the road's further reach from the drawn line. */
export function stripSpan(lanes: RoadLanes): number {
  const { left, right } = reachOf(lanes)
  return 2 * Math.max(left, right)
}

/**
 * The px per block a strip is drawn at, from the room it has: never so
 * small a lane can't be told, never so large a street fills the panel.
 */
export const stripScale = (lanes: RoadLanes, width: number, { min = 6, max = 26 } = {}): number =>
  Math.max(min, Math.min(max, width / Math.max(1, stripSpan(lanes))))
