import type { Point } from '@/maps/geo'
import { BLOCKS_PER_RADIAN, toLonLat, type LonLat } from '@/maps/globe'
import { WORLD_EAST, WORLD_NORTH, WORLD_SOUTH, WORLD_WEST } from '@/maps/source'

/**
 * The reach of Azania's war on the globe: the circle the flat map draws
 * about its capital (src/components/maps/layers/ReachLayer.tsx), as far as
 * a nation may besiege, sampled round in blocks, a circle on the flat map
 * and so on the ground, and handed to the globe's shader (./shaders.ts →
 * REACH_*) to be laid on the ball. Like the flat map's, it ends at the
 * world's edge, which no siege crosses: east and west at the seam, north
 * and south at the poles, where a ring carried on would fold up into a
 * point.
 */

/** A sample of the ring: its spot, and how far round the ring it is, in radians of the globe (for the dashes). */
export type ReachRing = (LonLat & { along: number })[]

/** Samples round the whole ring; a ring cut at the world's edge has fewer. */
const SAMPLES = 128

/** The ring about `capital`, `radius` blocks round, in runs that stay within the world; the longest is drawn (a cut ring is one run, joined round its start). */
export function reachRing(capital: Point, radius: number): ReachRing | null {
  if (!(radius > 0)) return null
  const runs: ReachRing[] = []
  let run: ReachRing = []
  for (let i = 0; i <= SAMPLES; i++) {
    const angle = (2 * Math.PI * i) / SAMPLES
    const x = capital[0] + radius * Math.cos(angle)
    const z = capital[1] + radius * Math.sin(angle)
    if (x < WORLD_WEST || x >= WORLD_EAST || z < WORLD_NORTH || z > WORLD_SOUTH) {
      if (run.length > 1) runs.push(run)
      run = []
      continue
    }
    run.push({ ...toLonLat([x, z]), along: (radius * angle) / BLOCKS_PER_RADIAN })
  }
  if (run.length > 1) runs.push(run)
  if (!runs.length) return null
  // A ring cut by the world's edge in two pieces joins up round the back of its start.
  if (runs.length > 1 && runs[0][0].along === 0 && runs[runs.length - 1].at(-1)?.along === (2 * Math.PI * radius) / BLOCKS_PER_RADIAN) {
    const last = runs.pop()!
    const turn = (2 * Math.PI * radius) / BLOCKS_PER_RADIAN
    runs[0] = [...last.map((sample) => ({ ...sample, along: sample.along - turn })), ...runs[0].slice(1)]
  }
  return runs.reduce((longest, each) => (each.length > longest.length ? each : longest))
}
