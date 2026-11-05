import { lanesWidth, type RoadLanes } from '@/maps/lanes'

/**
 * The px per block a cross-section strip (./LanesStrip.tsx) is drawn at,
 * from the room it has: never so small a lane can't be told, never so
 * large a street fills the panel. Plain arithmetic, kept apart from the
 * strip so a server-rendered page (the road's) can size it too.
 */
export const stripScale = (lanes: RoadLanes, width: number, { min = 6, max = 26 } = {}): number =>
  Math.max(min, Math.min(max, width / Math.max(1, lanesWidth(lanes))))
