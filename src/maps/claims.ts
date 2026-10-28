import { boundsOf, inRing, isPoint, outlineToRing, ringArea, type Bounds, type Outline, type Point } from './geo'

/**
 * A town's claims, told apart as Towny's rules see them. A town is one
 * piece of connected chunks about its home block, with, usually, one
 * outpost: claims anywhere, even far across the world, with a spawn of
 * their own (`/t outpost`) for the town's residents. Every claim of a
 * town belongs to one of the two, and when one belongs to neither (an
 * island the town crossed water to, a claim left over when the chunks
 * joining it were given up, one the server's staff haven't seen to yet),
 * the map shows it as detached, and leaves why to the town.
 *
 * The Rulercraft map draws each connected piece as a claim of its own,
 * marks the home block, and marks each outpost's spawn; this works out
 * the rest:
 *
 *   main       the claim holding the home block, and every claim within
 *              CLAIM_REACH of it or of another main claim. An outpost's
 *              spawn standing in the town itself changes nothing: the
 *              home outranks it.
 *   outpost    the claim holding an outpost's spawn, and every claim
 *              within reach of it, as the town's are;
 *   detached   whatever reaches neither, a part for each group of them
 *              within reach of one another.
 *
 * A site the server runs (a quarry, a wasteland, a treasure ship, …) is
 * no players' town, and Towny's rule isn't its: its claims stand as the
 * server laid them out. What reaches neither its home nor an outpost is
 * more of the site itself, never detached: a main piece of its own, after
 * the one holding the site's mark.
 *
 * Where a claim is in reach of two, the nearer takes it. Pure, and cheap
 * enough to run in the browser over the whole world: only claims of one
 * town are ever measured against one another, and only when their boxes
 * come within reach.
 */

/** An outpost's spawn as the Rulercraft map marks it: where it stands, and its name, when the town gave it one. */
export type OutpostSpawn = { at: Point; name: string | null }

/** Outposts' spawns out of a stored town's JSON, whatever else it holds. */
export const spawnsFrom = (value: unknown): OutpostSpawn[] =>
  Array.isArray(value)
    ? value
        .filter((spawn): spawn is OutpostSpawn => Boolean(spawn) && isPoint((spawn as OutpostSpawn).at))
        .map((spawn) => ({ at: spawn.at, name: typeof spawn.name === 'string' && spawn.name ? spawn.name : null }))
    : []

export type PartRole = 'main' | 'outpost' | 'detached'

export type ClaimPart = {
  /** What it is; a site's pieces are all 'main', the first holding its mark. */
  role: PartRole
  /** The town's claims in it, by their index among the town's claims. */
  claims: number[]
  bounds: Bounds
  chunks: number
  /**
   * Where it stands, for a mark, a name or a look: the main part's home
   * block, an outpost's (first) spawn, the middle of a detached part.
   */
  centre: Point
  /**
   * An outpost's spawns, the first leading (two outposts a stone's throw
   * apart share a part); for the main part, any outposts' spawns standing
   * in the town itself; none for a detached part.
   */
  spawns: OutpostSpawn[]
}

/**
 * How far apart, in blocks, two claims may lie and still be one piece of a
 * town: a region's width (32 chunks). Islands a town has settled lie a few
 * chunks off its shore, the furthest seen some seventeen; the nearest claim
 * that is truly apart lay over a hundred away.
 */
export const CLAIM_REACH = 512

const boxGap = (a: Bounds, b: Bounds): number =>
  Math.hypot(Math.max(0, a.minX - b.maxX, b.minX - a.maxX), Math.max(0, a.minZ - b.maxZ, b.minZ - a.maxZ))

/** The distance from a point to a segment. */
function toSegment([px, pz]: Point, [ax, az]: Point, [bx, bz]: Point): number {
  const dx = bx - ax
  const dz = bz - az
  const length = dx * dx + dz * dz
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / length)) : 0
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

/** How far apart two claims lie, in blocks: none when one reaches into the other. Edges further apart than the nearest pair so far aren't measured. */
function gapBetween(a: Point[], b: Point[], boxA: Bounds, boxB: Bounds): number {
  const overlap = boxGap(boxA, boxB) === 0
  if (overlap && (a.some((point) => inRing(point, b)) || b.some((point) => inRing(point, a)))) return 0
  let best = Infinity
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const [ax0, az0, ax1, az1] = [Math.min(a[i][0], a[j][0]), Math.min(a[i][1], a[j][1]), Math.max(a[i][0], a[j][0]), Math.max(a[i][1], a[j][1])]
    for (let k = 0, l = b.length - 1; k < b.length; l = k++) {
      const dx = Math.max(0, ax0 - Math.max(b[k][0], b[l][0]), Math.min(b[k][0], b[l][0]) - ax1)
      const dz = Math.max(0, az0 - Math.max(b[k][1], b[l][1]), Math.min(b[k][1], b[l][1]) - az1)
      if (dx >= best || dz >= best) continue
      best = Math.min(best, toSegment(a[i], b[k], b[l]), toSegment(a[j], b[k], b[l]), toSegment(b[k], a[i], a[j]), toSegment(b[l], a[i], a[j]))
    }
  }
  return best
}

/** The middle of the block at a point: a marker stands on a block, and its edge is a claim's. */
const blockMiddle = ([x, z]: Point): Point => [x + 0.5, z + 0.5]

/**
 * A town's claims in their parts: the main part first, then its outposts
 * in Towny's order, then what's detached, the biggest first. For a site
 * (`site`), what would be detached is more of the site: main pieces after
 * the first, the biggest first, before its outposts.
 */
export function claimParts(
  claims: Outline[],
  home: Point | null,
  outposts: OutpostSpawn[],
  { site = false }: { site?: boolean } = {},
): ClaimPart[] {
  const rings = claims.map(outlineToRing)
  const boxes = rings.map(boundsOf)
  const chunks = rings.map((ring) => ringArea(ring) / 256)
  const n = claims.length
  if (n === 0) return []
  const holding = (point: Point): number => {
    const middle = blockMiddle(point)
    return rings.findIndex((ring, i) => boxes[i] !== null && inRing(middle, ring))
  }

  // Each claim's part, by a key: 'main', or the first spawn's index of an outpost's.
  const owner: (string | null)[] = new Array(n).fill(null)
  const held = home ? holding(home) : -1
  // Without a home on the map, the biggest claim stands for the town.
  const seed = held >= 0 ? held : chunks.indexOf(Math.max(...chunks))
  owner[seed] = 'main'
  const spawnsOf = new Map<string, OutpostSpawn[]>([['main', []]])
  outposts.forEach((spawn, i) => {
    const at = holding(spawn.at)
    if (at < 0) return
    const key = owner[at] ?? `outpost:${i}`
    owner[at] = key
    spawnsOf.set(key, [...(spawnsOf.get(key) ?? []), spawn])
  })

  // The gaps worth measuring: only between claims whose boxes come within reach.
  const gaps = new Map<number, number>()
  const gap = (i: number, j: number): number => {
    const key = i < j ? i * n + j : j * n + i
    let known = gaps.get(key)
    if (known === undefined) {
      const a = boxes[i]
      const b = boxes[j]
      known = a && b && boxGap(a, b) <= CLAIM_REACH ? gapBetween(rings[i], rings[j], a, b) : Infinity
      gaps.set(key, known)
    }
    return known
  }
  // Out from the town and its outposts, the nearest claim in reach first, each joining the part it's nearest.
  const grow = (from: (i: number) => boolean, key: (j: number) => string) => {
    for (;;) {
      let best: { claim: number; to: number; gap: number } | null = null
      for (let i = 0; i < n; i++) {
        if (owner[i] !== null) continue
        for (let j = 0; j < n; j++) {
          if (!from(j)) continue
          const between = gap(i, j)
          if (between <= CLAIM_REACH && (!best || between < best.gap)) best = { claim: i, to: j, gap: between }
        }
      }
      if (!best) return
      owner[best.claim] = key(best.to)
    }
  }
  grow((j) => owner[j] !== null, (j) => owner[j]!)
  // What's left is detached, or for a site more of it: in parts of claims within reach of one another.
  let detached = 0
  for (let i = 0; i < n; i++) {
    if (owner[i] !== null) continue
    owner[i] = `${site ? 'piece' : 'detached'}:${detached++}`
    const key = owner[i]!
    grow((j) => owner[j] === key, () => key)
  }

  const partOf = (key: string, role: PartRole): ClaimPart | null => {
    const members = owner.flatMap((each, i) => (each === key ? [i] : []))
    const bounds = boundsOf(members.flatMap((i) => rings[i]))
    if (!members.length || !bounds) return null
    const spawns = spawnsOf.get(key) ?? []
    const middle: Point = [(bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2]
    return {
      role,
      claims: members,
      bounds,
      chunks: Math.round(members.reduce((sum, i) => sum + chunks[i], 0)),
      centre: key === 'main' ? (home && held >= 0 ? home : middle) : role === 'outpost' ? spawns[0].at : middle,
      spawns,
    }
  }
  const keys = [...new Set(owner)] as string[]
  const outpostParts = keys
    .filter((key) => key.startsWith('outpost:'))
    .sort((a, b) => Number(a.slice(8)) - Number(b.slice(8)))
    .map((key) => partOf(key, 'outpost'))
  const apart = (prefix: string, role: PartRole) =>
    keys
      .filter((key) => key.startsWith(prefix))
      .map((key) => partOf(key, role))
      .sort((a, b) => (b?.chunks ?? 0) - (a?.chunks ?? 0))
  return [partOf('main', 'main'), ...apart('piece:', 'main'), ...outpostParts, ...apart('detached:', 'detached')].filter(
    (part): part is ClaimPart => part !== null,
  )
}

/** The town itself, as against its outposts and what's detached: its main part's bounds; for a site, the piece holding its mark. */
export const mainBounds = (parts: ClaimPart[]): Bounds | null => parts.find((part) => part.role === 'main')?.bounds ?? null

/**
 * Where a click on one of a town's parts looks, when it isn't the town
 * itself (the first part): an outpost, detached claims, a site's piece
 * apart from its mark; nothing for the town, which is looked at as ever.
 */
export const partFocus = (parts: ClaimPart[], index: number | null | undefined): Bounds | undefined =>
  index != null && index > 0 ? parts[index]?.bounds : undefined

/** The part of a town holding a block, by its claims; null when none does. */
export function partAt(parts: ClaimPart[], claims: Outline[], block: Point): ClaimPart | null {
  const middle = blockMiddle(block)
  return parts.find((part) => part.claims.some((i) => claims[i] && inRing(middle, outlineToRing(claims[i])))) ?? null
}

/** The part a claim belongs to, by the claim's index; null for none (a claim too broken to draw). */
export const partOfClaim = (parts: ClaimPart[], claim: number): ClaimPart | null =>
  parts.find((part) => part.claims.includes(claim)) ?? null
