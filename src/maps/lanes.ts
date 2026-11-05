import type { Point } from './geo'

/**
 * A road's lanes on Azania Maps: its cross-section, the parts across it
 * from left to right as seen looking along the road the way it was drawn,
 * each as wide as built, in blocks. A road without one is drawn by its
 * class (src/maps/palette.ts → ROAD_STYLES); with one, the map can draw it
 * at its true width once zoomed in far enough for that to show, lanes,
 * lines, strips (medians, verges) and pavements where they are, so the drawing lies on the
 * build seen through it.
 *
 * Which way a lane runs is its own: with the road (the way it was drawn),
 * against it, or both (a town's three-wide street, shared). So the side
 * traffic keeps to is no rule of the map's, only how the presets fill in
 * the directions, and a one-way street or a local oddity is lanes set as
 * they really run. Towns build their streets differently (pavements wide
 * or narrow, on one side, behind a grass verge): each road keeps its own,
 * and the editor offers a town's own ones first (lanesInUse).
 *
 * The drawn line (the road's points, and the nodes it shares at junctions,
 * src/maps/junctions.ts) always runs down the middle of the carriageway:
 * the lanes, the lines between them and any median, the pavements and
 * verges along the edges not counted (lanesAxis). So a part widened grows
 * the road about the line, both ways, and a pavement on one side leaves the
 * lanes where they lie; Hauptallee's line lies on its median. `axis` keeps
 * where that is, in blocks from the left edge, worked out from the parts
 * and never set apart from them.
 *
 * A road's lanes can change along it (`changes`): from so many blocks along
 * its course, over so many, to another cross-section, each part narrowing
 * or widening to meet it (a median tapering away, a turn lane opening).
 */

/** Which way a lane's traffic runs, beside the way the road was drawn. */
export type LaneDirection = 'with' | 'against' | 'both'
export type LineStyle = 'dashed' | 'solid'
export type StripSurface = 'grass' | 'paved'

export type LanePart =
  /** A lane: 3 blocks in most builds. */
  | { kind: 'lane'; width: number; dir: LaneDirection }
  /** A line between lanes: a block of white in most builds, or none wide where it's painted on. */
  | { kind: 'line'; width: number; style: LineStyle }
  /**
   * A strip of grass, or paved and raised: between the carriageways a
   * median, between the road and a pavement a verge (partLabel).
   */
  | { kind: 'strip'; width: number; surface: StripSurface }
  /** A pavement, along the edge. */
  | { kind: 'walk'; width: number }

export type LanePartKind = LanePart['kind']

/**
 * A change in a road's lanes along it: `at` blocks along the road from its
 * start (as drawn, along its course), the cross-section goes over `over`
 * blocks from the one before to `parts`, each part widening or narrowing
 * as it goes (a median tapering away, a turn lane opening). Positions
 * along the course, not points, so a node shared at a junction, or a point
 * put in, moves nothing.
 */
export type LaneChange = { at: number; over: number; parts: LanePart[] }

export type RoadLanes = {
  /** Left to right, looking along the road the way it was drawn: from its start, until the first change. */
  parts: LanePart[]
  /** Where the drawn line lies across them, in blocks from the left edge: the carriageway's middle, always (lanesAxis). */
  axis: number
  /** Where the lanes change along the road, in order, none overlapping; absent for a road the same all along. */
  changes?: LaneChange[]
}

/** How wide each kind of part may be, in blocks, and how wide it starts. */
export const PART_WIDTHS: Record<LanePartKind, { min: number; max: number; usual: number }> = {
  lane: { min: 1, max: 8, usual: 3 },
  line: { min: 0, max: 2, usual: 1 },
  strip: { min: 0.5, max: 32, usual: 2 },
  walk: { min: 1, max: 16, usual: 2 },
}

export const PART_LABELS: Record<LanePartKind, string> = {
  lane: 'Lane',
  line: 'Line',
  strip: 'Strip',
  walk: 'Pavement',
}

/** At most this many parts across a road. */
export const MAX_PARTS = 24
/** At most this many changes along a road. */
export const MAX_CHANGES = 16
/** A change runs over this many blocks unless set otherwise, and over no more than OVER_MAX. */
export const OVER_USUAL = 12
export const OVER_MAX = 400

const DIRECTIONS: LaneDirection[] = ['with', 'against', 'both']
const LINE_STYLES: LineStyle[] = ['dashed', 'solid']
const SURFACES: StripSurface[] = ['grass', 'paved']

/** To the half block, as everything on the map is. */
const half = (value: number) => Math.round(value * 2) / 2

const clampWidth = (kind: LanePartKind, value: unknown): number => {
  const { min, max, usual } = PART_WIDTHS[kind]
  const width = typeof value === 'number' && Number.isFinite(value) ? half(value) : usual
  return Math.min(max, Math.max(min, width))
}

function parsePart(value: unknown): LanePart | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  switch (raw.kind) {
    case 'lane':
      return { kind: 'lane', width: clampWidth('lane', raw.width), dir: DIRECTIONS.includes(raw.dir as LaneDirection) ? (raw.dir as LaneDirection) : 'both' }
    case 'line':
      return { kind: 'line', width: clampWidth('line', raw.width), style: LINE_STYLES.includes(raw.style as LineStyle) ? (raw.style as LineStyle) : 'dashed' }
    case 'strip':
      return { kind: 'strip', width: clampWidth('strip', raw.width), surface: SURFACES.includes(raw.surface as StripSurface) ? (raw.surface as StripSurface) : 'grass' }
    case 'walk':
      return { kind: 'walk', width: clampWidth('walk', raw.width) }
    default:
      return null
  }
}

/** All the parts' widths together: the road's width in blocks, pavements included. */
export const lanesWidth = (lanes: Pick<RoadLanes, 'parts'>): number => lanes.parts.reduce((sum, part) => sum + part.width, 0)

/**
 * Where the drawn line lies across these parts, in blocks from the left
 * edge: the middle of the carriageway, from the first lane or line to the
 * last (a median between them counted, the verges and pavements outside
 * them not), so the road grows about the line both ways as a part of it
 * widens, and a pavement on one side doesn't push the lanes off it.
 */
export function lanesAxis(parts: LanePart[]): number {
  const onRoad = (p: LanePart) => p.kind === 'lane' || p.kind === 'line'
  const first = parts.findIndex(onRoad)
  if (first < 0) return lanesWidth({ parts }) / 2
  const last = parts.length - 1 - [...parts].reverse().findIndex(onRoad)
  const before = parts.slice(0, first).reduce((sum, p) => sum + p.width, 0)
  const across = parts.slice(first, last + 1).reduce((sum, p) => sum + p.width, 0)
  return before + across / 2
}

/** Parts with the drawn line down the middle of their carriageway (lanesAxis). */
const centred = (parts: LanePart[]): RoadLanes => ({ parts, axis: lanesAxis(parts) })

/**
 * A cross-section as kept: parts of the known kinds with their widths held
 * to what's built (half blocks, within PART_WIDTHS), and the drawn line
 * down the middle of their carriageway, whatever axis was sent (lanesAxis);
 * them. Nothing (null) where there's no lane among the parts: a road is
 * driven, walked or sailed along a lane.
 */
export function parseLanes(value: unknown): RoadLanes | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as { parts?: unknown; changes?: unknown }
  const parts = parseParts(raw.parts)
  if (!parts) return null
  const changes = (Array.isArray(raw.changes) ? raw.changes.slice(0, MAX_CHANGES) : [])
    .map(parseChange)
    .filter((change): change is LaneChange => change != null)
    .sort((a, b) => a.at - b.at)
  // None overlapping: each starts once the one before has run its course.
  let free = 0
  for (const change of changes) {
    change.at = Math.max(change.at, free)
    free = change.at + change.over
  }
  return withChanges(centred(parts), changes)
}

/** Parts as kept, a lane among them at least; null where there's none. */
function parseParts(value: unknown): LanePart[] | null {
  if (!Array.isArray(value)) return null
  const parts = value.slice(0, MAX_PARTS).map(parsePart).filter((part): part is LanePart => part != null)
  return parts.some((part) => part.kind === 'lane') ? parts : null
}

function parseChange(value: unknown): LaneChange | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as { at?: unknown; over?: unknown; parts?: unknown }
  const parts = parseParts(raw.parts)
  if (!parts || typeof raw.at !== 'number' || !Number.isFinite(raw.at)) return null
  const over = typeof raw.over === 'number' && Number.isFinite(raw.over) ? raw.over : OVER_USUAL
  return { at: Math.max(0, half(raw.at)), over: Math.min(OVER_MAX, Math.max(0, half(over))), parts }
}

/** Lanes with these changes, or none: a road the same all along has no `changes` at all. */
const withChanges = (lanes: RoadLanes, changes: LaneChange[] | undefined): RoadLanes => {
  const { changes: _, ...rest } = lanes
  return changes?.length ? { ...rest, changes } : rest
}

/** The cross-section shaped (a part widened, put in, taken out), the changes along the road kept. */
const keeping = (lanes: RoadLanes, next: RoadLanes): RoadLanes => withChanges(next, lanes.changes)

/** What's wrong with a cross-section as sent, for the form; null when it's fine. */
export function lanesProblem(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'object' || !Array.isArray((value as { parts?: unknown }).parts)) return 'Lanes are a list of parts across the road.'
  const parts = (value as { parts: unknown[] }).parts
  if (parts.length > MAX_PARTS) return `At most ${MAX_PARTS} parts across a road.`
  if (parts.some((part) => parsePart(part) == null)) return 'Each part is a lane, a line, a strip or a pavement.'
  if (!parts.some((part) => (part as { kind?: unknown }).kind === 'lane')) return 'A road with lanes has one lane at least.'
  return null
}

/** One part where it lies: from and to, signed blocks from the drawn line, right of it positive. */
export type PlacedPart = { part: LanePart; index: number; from: number; to: number; centre: number }

/**
 * The parts placed across the road beside the drawn line: negative to its
 * left, positive to its right, looking along it the way it was drawn.
 */
export function placedParts(lanes: RoadLanes): PlacedPart[] {
  let at = -lanes.axis
  return lanes.parts.map((part, index) => {
    const from = at
    at += part.width
    return { part, index, from, to: at, centre: (from + at) / 2 }
  })
}

/** How far the road reaches each side of the drawn line, in blocks: left (as a positive number) and right. */
export function reachOf(lanes: RoadLanes): { left: number; right: number } {
  const width = lanesWidth(lanes)
  return { left: lanes.axis, right: width - lanes.axis }
}

/**
 * The traffic side the lanes keep to, where they say: on the right when
 * every lane running with the road lies right of every lane running
 * against it, on the left when the other way round; null for a road all
 * one way or shared.
 */
export function drivingSide(lanes: RoadLanes): 'right' | 'left' | null {
  const placed = placedParts(lanes).filter((p): p is PlacedPart & { part: Extract<LanePart, { kind: 'lane' }> } => p.part.kind === 'lane')
  const withs = placed.filter((p) => p.part.dir === 'with').map((p) => p.centre)
  const againsts = placed.filter((p) => p.part.dir === 'against').map((p) => p.centre)
  if (!withs.length || !againsts.length) return null
  if (Math.min(...withs) > Math.max(...againsts)) return 'right'
  if (Math.max(...withs) < Math.min(...againsts)) return 'left'
  return null
}

/** Does a strip lie between lanes, a median, rather than between the road and its edge, a verge? */
export const isMedian = (lanes: RoadLanes, index: number): boolean =>
  lanes.parts.slice(0, index).some((p) => p.kind === 'lane') && lanes.parts.slice(index + 1).some((p) => p.kind === 'lane')

/** What a part is called where it lies: a strip between lanes is a median, at the side a verge. */
export function partLabel(lanes: RoadLanes, index: number): string {
  const part = lanes.parts[index]
  if (part?.kind !== 'strip') return part ? PART_LABELS[part.kind] : ''
  return isMedian(lanes, index) ? 'Median' : 'Verge'
}

/** Is it a divided road: two carriageways with a median between them? */
export const isDivided = (lanes: RoadLanes): boolean => lanes.parts.some((part, i) => part.kind === 'strip' && isMedian(lanes, i))

/** Is the road one-way: every lane running the same way, and that not shared? */
export function oneWay(lanes: RoadLanes): LaneDirection | null {
  const dirs = new Set(lanes.parts.flatMap((part) => (part.kind === 'lane' ? [part.dir] : [])))
  if (dirs.size !== 1) return null
  const [dir] = dirs
  return dir === 'both' ? null : dir
}

const flip = (dir: LaneDirection): LaneDirection => (dir === 'with' ? 'against' : dir === 'against' ? 'with' : 'both')

/** The lanes with traffic on the other side: every lane's direction turned about. */
export const otherSide = (lanes: RoadLanes): RoadLanes => {
  const turned = (parts: LanePart[]) => parts.map((part) => (part.kind === 'lane' ? { ...part, dir: flip(part.dir) } : part))
  return withChanges({ ...lanes, parts: turned(lanes.parts) }, lanes.changes?.map((change) => ({ ...change, parts: turned(change.parts) })))
}

/**
 * The lanes of the same road drawn the other way (as the editor turns a
 * road about to carry on from its start): the parts in the opposite order,
 * each lane's direction turned, and the changes along it from the other
 * end (which takes the road's `length` along its course). The road's
 * traffic is as it was.
 */
export function reversedLanes(lanes: RoadLanes, length = 0): RoadLanes {
  const turned = (parts: LanePart[]) => [...parts].reverse().map((part) => (part.kind === 'lane' ? { ...part, dir: flip(part.dir) } : part))
  const changes = lanes.changes ?? []
  if (!changes.length) return centred(turned(lanes.parts))
  const profiles = profilesOf(lanes)
  // From the far end: the last cross-section first, each change running back to the one before it.
  const back: LaneChange[] = changes
    .map((change, k) => ({ at: Math.max(0, half(length - change.at - change.over)), over: change.over, parts: turned(profiles[k]) }))
    .reverse()
  return withChanges(centred(turned(profiles[profiles.length - 1])), back)
}

/** The kinds of road a cross-section's lanes are offered for: roads that are driven or walked, not railways or waterways. */
export const HAS_LANES = new Set(['highway', 'main', 'street', 'path'])

export type LanePresetId = 'shared' | 'two-way' | 'divided' | 'one-way'

export const LANE_PRESETS: { id: LanePresetId; label: string }[] = [
  { id: 'shared', label: 'One shared lane' },
  { id: 'two-way', label: 'A lane each way' },
  { id: 'divided', label: 'Two each way, divided' },
  { id: 'one-way', label: 'One-way' },
]

/**
 * A cross-section to start from, with traffic on `side`: a town's
 * three-wide street; a lane each way with a line between; two lanes each
 * way either side of a median (as Hauptallee); one lane, one way. The drawn
 * line lies at the middle, on the median where there is one.
 */
export function lanePreset(id: LanePresetId, side: 'right' | 'left' = 'right'): RoadLanes {
  // On the right, the lanes left of the line run against the road, those right of it with it.
  const left: LaneDirection = side === 'right' ? 'against' : 'with'
  const right: LaneDirection = side === 'right' ? 'with' : 'against'
  const lane = (dir: LaneDirection): LanePart => ({ kind: 'lane', width: 3, dir })
  const dashed: LanePart = { kind: 'line', width: 1, style: 'dashed' }
  const parts: LanePart[] =
    id === 'shared'
      ? [lane('both')]
      : id === 'two-way'
        ? [lane(left), dashed, lane(right)]
        : id === 'divided'
          ? [lane(left), dashed, lane(left), { kind: 'strip', width: 2, surface: 'grass' }, lane(right), dashed, lane(right)]
          : [lane('with')]
  return centred(parts)
}

/**
 * The lanes with a pavement of `width` blocks along each edge, or along
 * one, and a grass verge of `verge` blocks between it and the road where
 * the town builds one; the lanes stay about the drawn line.
 */
export function withPavements(lanes: RoadLanes, width: number, sides: 'both' | 'left' | 'right' = 'both', verge = 0): RoadLanes {
  const walk: LanePart = { kind: 'walk', width: clampWidth('walk', width) }
  const side: LanePart[] = verge > 0 ? [walk, { kind: 'strip', width: clampWidth('strip', verge), surface: 'grass' }] : [walk]
  const addLeft = sides !== 'right'
  const addRight = sides !== 'left'
  return keeping(lanes, centred([...(addLeft ? side : []), ...lanes.parts, ...(addRight ? [...side].reverse() : [])]))
}

/** Two cross-sections alike: the same parts, as wide, the line where it lies. */
export const sameLanes = (a: RoadLanes, b: RoadLanes): boolean => JSON.stringify(a) === JSON.stringify(b)

/** A part of `kind` as it starts out, at its usual width. */
export function newPart(kind: LanePartKind): LanePart {
  const width = PART_WIDTHS[kind].usual
  switch (kind) {
    case 'lane':
      return { kind, width, dir: 'both' }
    case 'line':
      return { kind, width, style: 'dashed' }
    case 'strip':
      return { kind, width, surface: 'grass' }
    case 'walk':
      return { kind, width }
  }
}

/** The lanes with the part at `index` set `width` blocks wide (to the half block, within PART_WIDTHS), growing about the drawn line. */
export function withWidth(lanes: RoadLanes, index: number, width: number): RoadLanes {
  const part = lanes.parts[index]
  if (!part) return lanes
  const next = clampWidth(part.kind, width)
  return keeping(lanes, centred(lanes.parts.map((p, i) => (i === index ? { ...p, width: next } : p))))
}

/** The lanes with `part` put in at `index` (before the part there now; at the end for `parts.length`). */
export function withPartAt(lanes: RoadLanes, index: number, part: LanePart): RoadLanes {
  if (lanes.parts.length >= MAX_PARTS) return lanes
  const at = Math.max(0, Math.min(lanes.parts.length, index))
  return keeping(lanes, centred([...lanes.parts.slice(0, at), part, ...lanes.parts.slice(at)]))
}

/** The lanes without the part at `index`; the last lane can't go (null). */
export function withoutPart(lanes: RoadLanes, index: number): RoadLanes | null {
  if (!lanes.parts[index]) return lanes
  const parts = lanes.parts.filter((_, i) => i !== index)
  if (!parts.some((p) => p.kind === 'lane')) return null
  return keeping(lanes, centred(parts))
}

/** The lanes with a part's own setting changed: a lane's direction, a line's style, a strip's surface. */
export function withPart(lanes: RoadLanes, index: number, change: Partial<LanePart>): RoadLanes {
  return { ...lanes, parts: lanes.parts.map((p, i) => (i === index ? (parsePart({ ...p, ...change }) ?? p) : p)) }
}

/*
 * Changes along the road: the cross-sections a road goes through, the
 * first from its start, each next from a change on.
 */

/** Every cross-section a road has, from its start: its own parts, then each change's. */
export const profilesOf = (lanes: RoadLanes): LanePart[][] => [lanes.parts, ...(lanes.changes ?? []).map((change) => change.parts)]

/** The k-th cross-section (0 from the start, k from the k-th change on), as lanes to shape with the helpers above. */
export const profileOf = (lanes: RoadLanes, k: number): RoadLanes => centred(profilesOf(lanes)[k] ?? lanes.parts)

/** The lanes with their k-th cross-section (as profileOf) shaped; the rest as they were. */
export function withProfile(lanes: RoadLanes, k: number, profile: RoadLanes): RoadLanes {
  if (k <= 0) return keeping(lanes, centred(profile.parts))
  return withChanges(
    centred(lanes.parts),
    (lanes.changes ?? []).map((change, i) => (i === k - 1 ? { ...change, parts: profile.parts } : change)),
  )
}

/** Which cross-section holds `s` blocks along the road, as profileOf takes it: that of the last change begun by then. */
export const profileIndexAt = (lanes: RoadLanes, s: number): number => (lanes.changes ?? []).filter((change) => change.at <= s).length

/**
 * The lanes with a change put in `at` blocks along the road, running over
 * `over` blocks, to the cross-section holding there (for the drawer to
 * shape), and its index as profileOf takes it; null where the road has as
 * many changes as it may. Held between its neighbours (withChangeMoved).
 */
export function withChangeAt(lanes: RoadLanes, at: number, over = OVER_USUAL): { lanes: RoadLanes; k: number } | null {
  const changes = lanes.changes ?? []
  if (changes.length >= MAX_CHANGES) return null
  const before = profileIndexAt(lanes, at)
  const parts = profilesOf(lanes)[before].map((part) => ({ ...part }))
  const added = withChanges(centred(lanes.parts), [...changes.slice(0, before), { at, over, parts }, ...changes.slice(before)])
  return { lanes: withChangeMoved(added, before + 1, at, over), k: before + 1 }
}

/**
 * The k-th change (as profileOf) moved to begin `at` blocks along the road
 * and run over `over`, held between its neighbours: beginning no sooner
 * than the one before has run, and done by where the next begins.
 */
export function withChangeMoved(lanes: RoadLanes, k: number, at: number, over: number): RoadLanes {
  const changes = [...(lanes.changes ?? [])]
  const i = k - 1
  if (!changes[i]) return lanes
  const earliest = i > 0 ? changes[i - 1].at + changes[i - 1].over : 0
  const latest = changes[i + 1]?.at ?? Infinity
  const begins = Math.min(latest, Math.max(earliest, half(at)))
  const runs = Math.max(0, Math.min(OVER_MAX, half(over), latest - begins))
  changes[i] = { ...changes[i], at: begins, over: runs }
  return withChanges(centred(lanes.parts), changes)
}

/** The lanes without their k-th change (as profileOf): the cross-section before it holds on. */
export const withoutChange = (lanes: RoadLanes, k: number): RoadLanes =>
  withChanges(centred(lanes.parts), (lanes.changes ?? []).filter((_, i) => i !== k - 1))

/** A part followed along a road whose lanes change: the same lane, line, strip or pavement in each cross-section, null where it isn't there. */
export type LaneTrack = { kind: LanePartKind; parts: (LanePart | null)[] }

/**
 * A road's parts followed along it, through every change: each part of a
 * cross-section is the same as one of the next where the two can be put
 * side by side (align); one that has none there narrows away over the
 * change, and one new to the next opens from nothing. So Hauptallee's
 * median tapers out while a centre line comes in, and a turn lane opens
 * beside the lanes it leaves.
 */
export function tracksOf(lanes: RoadLanes): LaneTrack[] {
  const profiles = profilesOf(lanes)
  let tracks: LaneTrack[] = profiles[0].map((part) => ({ kind: part.kind, parts: [part] }))
  for (let k = 1; k < profiles.length; k++) {
    const next = profiles[k]
    // The tracks there before, in order, are the cross-section before, part for part.
    const present = tracks.flatMap((track, i) => (track.parts[k - 1] ? [i] : []))
    const matched = new Map(align(profiles[k - 1], next).map(([i, j]) => [present[i], j]))
    const merged: LaneTrack[] = []
    let j = 0
    const opening = (upTo: number) => {
      for (; j < upTo; j++) merged.push({ kind: next[j].kind, parts: [...new Array<LanePart | null>(k).fill(null), next[j]] })
    }
    tracks.forEach((track, i) => {
      const m = matched.get(i)
      if (m == null) {
        merged.push({ ...track, parts: [...track.parts, null] })
        return
      }
      opening(m)
      merged.push({ ...track, parts: [...track.parts, next[m]] })
      j = m + 1
    })
    opening(next.length)
    tracks = merged
  }
  return tracks
}

/**
 * Which parts of one cross-section are the same as which of the next: as
 * many as can be, kind for kind and in order (a longest common
 * subsequence), and of those the pairing lying nearest where they were
 * across the road, so a lane added on the right leaves the others matched
 * as they lie.
 */
function align(a: LanePart[], b: LanePart[]): [number, number][] {
  const ca = placedParts(centred(a)).map((p) => p.centre)
  const cb = placedParts(centred(b)).map((p) => p.centre)
  const pair = (i: number, j: number) => 1e6 - Math.abs(ca[i] - cb[j])
  const score = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const skip = Math.max(score[i - 1][j], score[i][j - 1])
      score[i][j] = a[i - 1].kind === b[j - 1].kind ? Math.max(skip, score[i - 1][j - 1] + pair(i - 1, j - 1)) : skip
    }
  const pairs: [number, number][] = []
  for (let i = a.length, j = b.length; i > 0 && j > 0; ) {
    if (a[i - 1].kind === b[j - 1].kind && score[i][j] === score[i - 1][j - 1] + pair(i - 1, j - 1)) {
      pairs.unshift([i - 1, j - 1])
      i--
      j--
    } else if (score[i][j] === score[i - 1][j]) i--
    else j--
  }
  return pairs
}

/** Where along its changes a road stands `s` blocks along it: between cross-sections `from` and `to`, `t` of the way (0 or 1 outside a change). */
function stageAt(changes: LaneChange[], s: number): { from: number; to: number; t: number } {
  const k = changes.filter((change) => change.at <= s).length
  if (!k) return { from: 0, to: 0, t: 0 }
  const change = changes[k - 1]
  if (change.over > 0 && s < change.at + change.over) return { from: k - 1, to: k, t: (s - change.at) / change.over }
  return { from: k, to: k, t: 0 }
}

/** The way a road's widths run along it: each track's width, and where the drawn line lies across them, `s` blocks along. */
function widthsAlong(lanes: RoadLanes) {
  const changes = lanes.changes ?? []
  const axes = profilesOf(lanes).map(lanesAxis)
  const widthOf = (track: LaneTrack, k: number) => track.parts[k]?.width ?? 0
  return {
    width: (track: LaneTrack, s: number) => {
      const { from, to, t } = stageAt(changes, s)
      return widthOf(track, from) * (1 - t) + widthOf(track, to) * t
    },
    axis: (s: number) => {
      const { from, to, t } = stageAt(changes, s)
      return axes[from] * (1 - t) + axes[to] * t
    },
    /** The part a track is drawn as `s` blocks along: the one before a change until halfway through it, the one after from there. */
    part: (track: LaneTrack, s: number): LanePart | null => {
      const { from, to, t } = stageAt(changes, s)
      return (t < 0.5 ? track.parts[from] ?? track.parts[to] : track.parts[to] ?? track.parts[from]) ?? null
    },
  }
}

/**
 * The cross-section `s` blocks along the road, as it stands there: each
 * part as wide as it is at that spot (a median half tapered away halfway
 * through its change), those no blocks wide left out, the drawn line
 * where it lies.
 */
export function lanesAt(lanes: RoadLanes, s: number): RoadLanes {
  if (!lanes.changes?.length) return withChanges(lanes, undefined)
  const tracks = tracksOf(lanes)
  const along = widthsAlong(lanes)
  const parts = tracks.flatMap((track) => {
    const width = along.width(track, s)
    const part = along.part(track, s)
    return width > EPSILON && part ? [{ ...part, width }] : []
  })
  return { parts, axis: along.axis(s) }
}

/** How far a road's carriageway (lanesAxis) reaches each side of the drawn line, kerb to kerb: where its pavements and verges begin. */
export function carriagewayReach(lanes: RoadLanes): { left: number; right: number } {
  const onRoad = (p: LanePart) => p.kind === 'lane' || p.kind === 'line'
  const first = lanes.parts.findIndex(onRoad)
  const last = lanes.parts.length - 1 - [...lanes.parts].reverse().findIndex(onRoad)
  if (first < 0) return reachOf(lanes)
  const before = lanes.parts.slice(0, first).reduce((sum, p) => sum + p.width, 0)
  const across = lanes.parts.slice(first, last + 1).reduce((sum, p) => sum + p.width, 0)
  return { left: lanes.axis - before, right: before + across - lanes.axis }
}

/** Which sides have a pavement: at the left edge, the right, both or neither, by the outermost parts. */
export function pavementSides(lanes: RoadLanes): { left: boolean; right: boolean } {
  const outer = (parts: LanePart[]) => parts.find((p) => p.kind !== 'strip')
  return { left: outer(lanes.parts)?.kind === 'walk', right: outer([...lanes.parts].reverse())?.kind === 'walk' }
}

/**
 * The cross-section in a few words, for the road's page: "2 + 2 lanes,
 * divided", "1 + 1 lanes", "One shared lane", "One-way, 2 lanes"; then the
 * pavements, where there are any.
 */
export function describeLanes(lanes: RoadLanes): string {
  const lanesOf = (dir: LaneDirection) => lanes.parts.filter((p) => p.kind === 'lane' && p.dir === dir).length
  const withs = lanesOf('with')
  const againsts = lanesOf('against')
  const boths = lanesOf('both')
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  let words: string
  if (oneWay(lanes)) words = `One-way, ${plural(withs + againsts, 'lane')}`
  else if (!withs && !againsts) words = boths === 1 ? 'One shared lane' : `${boths} shared lanes`
  else {
    const [a, b] = drivingSide(lanes) === 'left' ? [withs, againsts] : [againsts, withs]
    words = `${a} + ${b} lanes${boths ? `, ${plural(boths, 'shared lane')}` : ''}${isDivided(lanes) ? ', divided' : ''}`
  }
  const { left, right } = pavementSides(lanes)
  const pavements = left && right ? 'pavements both sides' : left ? 'pavement on the left' : right ? 'pavement on the right' : ''
  return pavements ? `${words} · ${pavements}` : words
}

/** A change along the road in a few words, for the road's page: where it begins, how long it runs, and what it comes to. */
export type ChangeWords = { at: number; over: number; words: string }

/**
 * Each change along the road in a few words: "narrows to 1 + 1 lanes" where
 * the road comes out narrower kerb to kerb, "widens to…" where wider, else
 * "changes to…"; the cross-section after it as describeLanes gives it.
 */
export function describeChanges(lanes: RoadLanes): ChangeWords[] {
  const profiles = profilesOf(lanes).map(centred)
  return (lanes.changes ?? []).map((change, i) => {
    const before = lanesWidth(profiles[i])
    const after = lanesWidth(profiles[i + 1])
    const verb = after < before ? 'narrows' : after > before ? 'widens' : 'changes'
    return { at: change.at, over: change.over, words: `${verb} to ${describeLanes(profiles[i + 1]).replace(/^One/, 'one')}` }
  })
}

/**
 * The cross-sections a town's roads have already, most used first, each
 * once with the roads that have it: what the editor offers first for a
 * road drawn in that town, so a town's way of building its streets (its
 * pavements, verges, lanes) is kept by example, not by a rule written
 * down somewhere. Roads drawn the other way count as the same.
 */
export function lanesInUse<R extends { lanes: RoadLanes | null; name?: string | null }>(roads: R[]): { lanes: RoadLanes; roads: R[] }[] {
  const found: { lanes: RoadLanes; roads: R[] }[] = []
  for (const road of roads) {
    if (!road.lanes) continue
    // As a road starts out: where its lanes change along it, the editor offers its start.
    const lanes = centred(road.lanes.parts)
    const same = found.find((entry) => sameLanes(entry.lanes, lanes) || sameLanes(entry.lanes, reversedLanes(lanes)))
    if (same) same.roads.push(road)
    else found.push({ lanes, roads: [road] })
  }
  return found.sort((a, b) => b.roads.length - a.roads.length)
}

/*
 * Geometry: the line a part runs along, beside the road's course.
 */

const EPSILON = 1e-9
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]]
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]]
const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k]
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0]
const length = (a: Point) => Math.hypot(a[0], a[1])

/** Where lines a→b and c→d meet, as far along each as they must go; null when they run alongside. */
function meet(a: Point, b: Point, c: Point, d: Point): { point: Point; t: number; u: number } | null {
  const r = sub(b, a)
  const s = sub(d, c)
  const denominator = cross(r, s)
  if (Math.abs(denominator) < EPSILON) return null
  const t = cross(sub(c, a), s) / denominator
  const u = cross(sub(c, a), r) / denominator
  return { point: add(a, scale(r, t)), t, u }
}

/** A miter longer than this many times the offset is cut square (beveled). */
const MITER_LIMIT = 2.5

type Piece = { a: Point; b: Point; along: Point }

/**
 * Where two pieces of an offset line, one after the other, join: on the
 * inside of a bend where they cross, round its outside at their mitre, or
 * cut square where the mitre would reach too far (and where they run on
 * alongside, or straight back, from the one's end to the other's start).
 */
function joinOf(here: Piece, next: Piece, offset: number): Point[] {
  const found = meet(here.a, here.b, next.a, next.b)
  if (!found) return [here.b, next.a]
  // Turning toward the offset's side (right, with z south), the bend's inside.
  if (cross(here.along, next.along) * offset > 0) return [found.point]
  const corner = scale(add(here.b, next.a), 0.5)
  return length(sub(found.point, corner)) <= Math.abs(offset) * MITER_LIMIT ? [found.point] : [here.b, next.a]
}

/**
 * The line `offset` blocks beside a course (right of it positive, looking
 * along it): the course of a lane, a line or a strip's edge across a road.
 * Each piece is moved aside along its own normal, and the pieces joined
 * (joinOf). Where a bend is tighter than the offset (the inside of a
 * hairpin, for a wide road), a piece between two joins would run
 * backwards: it's dropped and its neighbours joined instead, until none
 * does, so the line cuts across the inside of the bend as a kerb would.
 * Loops it still ties in itself are cut out after (withoutLoops).
 *
 * `offset` is one distance all along, or one for each point of the course
 * (a road narrowing over a change): each piece then runs from the one
 * point's to the next's.
 */
export function offsetCourse(course: Point[], offset: number | number[]): Point[] {
  const kept = course.flatMap((point, i) =>
    i === 0 || length(sub(point, course[i - 1])) > EPSILON ? [{ point, offset: typeof offset === 'number' ? offset : (offset[i] ?? 0) }] : [],
  )
  const points = kept.map((entry) => entry.point)
  const offsets = kept.map((entry) => entry.offset)
  const widest = Math.max(0, ...offsets.map(Math.abs))
  if (points.length < 2 || widest < EPSILON) return points.slice()
  let pieces: (Piece & { at: number })[] = points.slice(1).map((b, i) => {
    const a = points[i]
    const along = scale(sub(b, a), 1 / length(sub(b, a)))
    const normal: Point = [-along[1], along[0]]
    return { a: add(a, scale(normal, offsets[i])), b: add(b, scale(normal, offsets[i + 1])), along, at: i + 1 }
  })
  let joins: Point[][] = []
  for (let guard = 0; guard <= points.length; guard++) {
    joins = pieces.slice(0, -1).map((piece, i) => joinOf(piece, pieces[i + 1], offsets[piece.at]))
    const backwards = pieces.findIndex((piece, i) => {
      const start = i === 0 ? piece.a : joins[i - 1][joins[i - 1].length - 1]
      const end = i === pieces.length - 1 ? piece.b : joins[i][0]
      const ahead = sub(end, start)
      return ahead[0] * piece.along[0] + ahead[1] * piece.along[1] < -EPSILON
    })
    if (backwards < 0 || pieces.length <= 1) break
    pieces = pieces.filter((_, i) => i !== backwards)
  }
  const out = [pieces[0].a, ...joins.flat(), pieces[pieces.length - 1].b].filter(
    (point, i, all) => i === 0 || length(sub(point, all[i - 1])) > EPSILON,
  )
  return withoutLoops(out, widest)
}

/** How far along a course each of its points lies, in blocks. */
function distancesOf(points: Point[]): number[] {
  const along = [0]
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + length(sub(points[i], points[i - 1])))
  return along
}

/** The point `s` blocks along a course with its distances; the ends where `s` is beyond them. */
function pointAlong(points: Point[], along: number[], s: number): Point {
  if (s <= 0 || points.length < 2) return points[0]
  for (let i = 1; i < points.length; i++) {
    if (along[i] >= s) {
      const t = (s - along[i - 1]) / Math.max(EPSILON, along[i] - along[i - 1])
      return add(points[i - 1], scale(sub(points[i], points[i - 1]), t))
    }
  }
  return points[points.length - 1]
}

/** A course with a point put in at each of `stations` (blocks along it) inside it, and each point's distance along. */
function stationed(course: Point[], stations: number[]): { points: Point[]; along: number[] } {
  const points = course.filter((point, i) => i === 0 || length(sub(point, course[i - 1])) > EPSILON)
  const along = distancesOf(points)
  const total = along[along.length - 1] ?? 0
  const inside = [...new Set(stations.filter((s) => s > EPSILON && s < total - EPSILON))].sort((a, b) => a - b)
  if (!inside.length) return { points, along }
  const outPoints: Point[] = [points[0]]
  const outAlong: number[] = [0]
  let next = 0
  for (let i = 1; i < points.length; i++) {
    while (next < inside.length && inside[next] < along[i] - EPSILON) {
      if (inside[next] > along[i - 1] + EPSILON) {
        outPoints.push(pointAlong(points, along, inside[next]))
        outAlong.push(inside[next])
      }
      next++
    }
    outPoints.push(points[i])
    outAlong.push(along[i])
  }
  return { points: outPoints, along: outAlong }
}

/** The piece of a stationed course from `from` to `to` blocks along it, its ends put in where they fall between points. */
function sliceAlong(points: Point[], along: number[], from: number, to: number): { points: Point[]; along: number[] } {
  const outPoints: Point[] = [pointAlong(points, along, from)]
  const outAlong: number[] = [from]
  for (let i = 0; i < points.length; i++) {
    if (along[i] > from + EPSILON && along[i] < to - EPSILON) {
      outPoints.push(points[i])
      outAlong.push(along[i])
    }
  }
  outPoints.push(pointAlong(points, along, to))
  outAlong.push(to)
  return { points: outPoints, along: outAlong }
}

/** How far along a course the spot on it nearest `point` lies, in blocks: where along the road a change is put in. */
export function distanceAlong(course: Point[], point: Point): number {
  let best = { distance: Infinity, s: 0 }
  let walked = 0
  for (let i = 1; i < course.length; i++) {
    const a = course[i - 1]
    const ab = sub(course[i], a)
    const span = length(ab)
    const t = span < EPSILON ? 0 : Math.max(0, Math.min(1, ((point[0] - a[0]) * ab[0] + (point[1] - a[1]) * ab[1]) / (span * span)))
    const distance = length(sub(point, add(a, scale(ab, t))))
    if (distance < best.distance) best = { distance, s: walked + t * span }
    walked += span
  }
  return best.s
}

/**
 * The line across a course `s` blocks along it, from `left` blocks left of
 * it to `right` blocks right of it (looking along the course): the ends of
 * a mark drawn across the road there, as the editor marks where its lanes
 * change. Null for a course of fewer than two points.
 */
export function acrossCourse(course: Point[], s: number, left: number, right: number): [Point, Point] | null {
  const { points, along } = stationed(course, [])
  if (points.length < 2) return null
  const total = along[along.length - 1]
  const at = pointAlong(points, along, s)
  const ahead = sub(pointAlong(points, along, Math.min(total, s + 0.5)), pointAlong(points, along, Math.max(0, s - 0.5)))
  const span = Math.max(EPSILON, length(ahead))
  const normal: Point = [-ahead[1] / span, ahead[0] / span]
  return [add(at, scale(normal, -left)), add(at, scale(normal, right))]
}

/**
 * A line with the small loops it ties in itself cut out: where a piece
 * crosses one a little further on (within about the loop an offset of
 * `reach` can tie), the line runs straight from the one to the other.
 */
function withoutLoops(line: Point[], reach: number): Point[] {
  const window = 8 * reach + 4
  let out = line.slice()
  for (let i = 0; i < out.length - 3; i++) {
    let walked = 0
    for (let j = i + 2; j < out.length - 1; j++) {
      walked += length(sub(out[j], out[j - 1]))
      if (walked > window) break
      const found = meet(out[i], out[i + 1], out[j], out[j + 1])
      if (found && found.t > EPSILON && found.t < 1 - EPSILON && found.u > EPSILON && found.u < 1 - EPSILON) {
        out = [...out.slice(0, i + 1), found.point, ...out.slice(j + 1)]
        break
      }
    }
  }
  return out
}

/** One part of a road's cross-section along its course: where it runs, in blocks. */
export type PartCourse = PlacedPart & {
  /** The line along its middle: a lane's arrows, a line's dashes, a strip's or a pavement's stroke. */
  middle: Point[]
}

/**
 * Every part of a road's cross-section laid along its course (the course
 * as src/maps/geo.ts → roadCourse gives it): what the map strokes, each
 * part as wide as it is, along the line through its middle.
 */
export function partCourses(course: Point[], lanes: RoadLanes): PartCourse[] {
  return placedParts(lanes).map((placed) => ({ ...placed, middle: offsetCourse(course, placed.centre) }))
}

/** The road's two edges along its course, left and right: where a casing would run. */
export function edgeCourses(course: Point[], lanes: RoadLanes): { left: Point[]; right: Point[] } {
  const { left, right } = reachOf(lanes)
  return { left: offsetCourse(course, -left), right: offsetCourse(course, right) }
}

/**
 * The carriageway: from the first lane to the last, lines and medians
 * between them included, verges and pavements outside them not. What the
 * map weighs against a road's class to decide when its true width shows.
 */
export function carriagewayWidth(lanes: RoadLanes): number {
  const first = lanes.parts.findIndex((p) => p.kind === 'lane')
  const last = lanes.parts.length - 1 - [...lanes.parts].reverse().findIndex((p) => p.kind === 'lane')
  return first < 0 ? 0 : lanes.parts.slice(first, last + 1).reduce((sum, p) => sum + p.width, 0)
}

/** One part of a road laid along its course as an area: the ring round it, in blocks, and the line along its middle. */
export type LaneArea = PlacedPart & {
  /** The ring round the part: its left edge forward, its right edge back; null for a part no blocks wide anywhere. */
  ring: Point[] | null
  /** The line along its middle, the first stretch where it's there (runs): for a line's dashes, a lane's marks. */
  middle: Point[]
  /**
   * Each stretch along the road where the part is there and drawn as one
   * part (a lane's direction, a line's style, a strip's surface can change
   * halfway through a change): its line along the middle. A road the same
   * all along has one, the whole way, for a lane or a line, and none for
   * strips and pavements, which are only filled.
   */
  runs: { part: LanePart; middle: Point[] }[]
}

/** A road's cross-section laid along its course, ready to draw (laneAreas). */
export type RoadAreas = {
  /** Each part, or along a road whose lanes change each part followed through the changes (tracksOf), left to right. */
  parts: LaneArea[]
  /** The road's two edges, left and right, open at the ends: where the kerb lines run. */
  edges: { left: Point[]; right: Point[] }
  /** The ring round the whole road. */
  outline: Point[]
  /** The line down the middle of the road, kerb to kerb, which may lie off the drawn line. */
  middle: Point[]
  /** Each boundary between two parts, in order, as a line along the course: index i lies between parts i−1 and i. */
  boundaries: Point[][]
  /** The kerbs: where the road (its lanes and lines) meets a strip or a pavement beside it, only where the two are there. */
  kerbs: Point[][]
  /** The widest the road is anywhere, pavements included, and its carriageway, in blocks. */
  width: number
  carriageway: number
}

const onTheRoad = (kind: LanePartKind) => kind === 'lane' || kind === 'line'

/**
 * Every part of a road's cross-section laid along its course as an area to
 * fill: the line beside the course at each boundary between two parts is
 * worked out once (offsetCourse), and each part's ring is its left
 * boundary forward and its right boundary back, so parts side by side meet
 * exactly, round a bend as on the straight. What the map draws once the
 * road is close enough to show at its true width.
 *
 * Where the lanes change along the road, every part is followed through
 * the changes (tracksOf) and its width runs from one cross-section's to
 * the next's over each change, so its boundaries narrow and widen along
 * the course; a part gone, or not yet there, is no blocks wide, and its
 * lines (runs) and kerbs are drawn only where it is. `start` is how far
 * along the road the course given begins (a bridge's deck: a piece of it).
 */
export function laneAreas(course: Point[], lanes: RoadLanes, start = 0): RoadAreas {
  const changes = lanes.changes ?? []
  const tracks = tracksOf(lanes)
  const along = widthsAlong(lanes)
  const profiles = profilesOf(lanes)
  // Points put in where the widths turn: where each change begins, where its parts switch, and where it's run.
  const stations = changes.flatMap((change) => [change.at, change.at + change.over / 2, change.at + change.over].map((x) => x - start))
  const { points, along: distances } = stationed(course, stations)
  const total = distances[distances.length - 1] ?? 0
  const widthAt = (t: number, s: number) => along.width(tracks[t], start + s)
  const boundaryAt = (b: number, s: number) => {
    let offset = -along.axis(start + s)
    for (let t = 0; t < b; t++) offset += widthAt(t, s)
    return offset
  }
  const offsetsOf = (at: number[], b: number, shift = 0) => at.map((s) => boundaryAt(b, s) + (shift ? shift * widthAt(b, s) : 0))
  const boundaries = tracks.map((_, b) => b).concat(tracks.length).map((b) => offsetCourse(points, offsetsOf(distances, b)))

  // The course cut where the widths turn: within each piece every part is there or not, and drawn as one part.
  const cuts = [...new Set([0, ...stations.filter((x) => x > EPSILON && x < total - EPSILON), total])].sort((a, b) => a - b)
  const pieces = cuts.slice(1).map((to, i) => ({ from: cuts[i], to, middle: (cuts[i] + to) / 2 }))
  const there = (t: number, piece: (typeof pieces)[number]) => widthAt(t, piece.from) > EPSILON || widthAt(t, piece.to) > EPSILON
  /** A stretch of the course, its own points: the line `b`'s boundary (or, with `shift` ½, the middle of part b) runs along it. */
  const alongStretch = (from: number, to: number, b: number, shift = 0) => {
    if (from <= EPSILON && to >= total - EPSILON && shift === 0) return boundaries[b]
    const piece = sliceAlong(points, distances, from, to)
    return offsetCourse(piece.points, offsetsOf(piece.along, b, shift))
  }
  /** Consecutive pieces joined where `key` gives the same (not null). */
  const stretches = <K,>(key: (piece: (typeof pieces)[number]) => K | null) => {
    const found: { from: number; to: number; key: K }[] = []
    for (const piece of pieces) {
      const k = key(piece)
      const last = found[found.length - 1]
      if (k == null) continue
      if (last && last.key === k && Math.abs(last.to - piece.from) < EPSILON) last.to = piece.to
      else found.push({ from: piece.from, to: piece.to, key: k })
    }
    return found
  }

  const first = placedParts(centred(profiles[0]))
  const parts: LaneArea[] = tracks.map((track, t) => {
    const part = track.parts.find((p) => p != null)!
    // Where it lies at the start, for a part there from the start: it's that many parts into the first cross-section.
    const placed = track.parts[0] ? first[tracks.slice(0, t).filter((other) => other.parts[0] != null).length] : null
    const wide = pieces.some((piece) => there(t, piece))
    const runs = onTheRoad(track.kind)
      ? stretches((piece) => (there(t, piece) ? along.part(track, start + piece.middle) : null)).map((run) => ({
          part: run.key,
          middle: alongStretch(run.from, run.to, t, 0.5),
        }))
      : []
    return {
      part,
      index: t,
      from: placed?.from ?? 0,
      to: placed?.to ?? 0,
      centre: placed?.centre ?? 0,
      ring: wide ? [...boundaries[t], ...boundaries[t + 1].slice().reverse()] : null,
      middle: runs[0]?.middle ?? [],
      runs,
    }
  })

  // A kerb runs between the road and a strip or pavement beside it: at the boundary just right of a part there, where the
  // next part there to its right is of the other sort.
  const kerbs = tracks.slice(1).flatMap((_, i) => {
    const b = i + 1
    return stretches((piece) => {
      if (!there(b - 1, piece)) return null
      const right = tracks.findIndex((_, t) => t >= b && there(t, piece))
      return right >= 0 && onTheRoad(tracks[b - 1].kind) !== onTheRoad(tracks[right].kind) ? true : null
    }).map((run) => alongStretch(run.from, run.to, b))
  })

  const left = boundaries[0]
  const right = boundaries[boundaries.length - 1]
  const middle = offsetCourse(
    points,
    distances.map((s) => (boundaryAt(0, s) + boundaryAt(tracks.length, s)) / 2),
  )
  return {
    parts,
    edges: { left, right },
    outline: [...left, ...right.slice().reverse()],
    middle,
    boundaries,
    kerbs,
    width: Math.max(...profiles.map((parts) => lanesWidth({ parts }))),
    carriageway: Math.max(...profiles.map((parts) => carriagewayWidth(centred(parts)))),
  }
}

/** A mark along a lane: where it sits and which way the lane runs there, in radians on the plane (x east, z south). */
export type LaneMark = { at: Point; heading: number }

/**
 * Marks every `every` blocks along a line, from half that in, each with the
 * line's heading there: where a lane's direction is drawn. Turned about for
 * a lane running against the road.
 */
export function marksAlong(line: Point[], every: number, against = false): LaneMark[] {
  const marks: LaneMark[] = []
  let next = every / 2
  let walked = 0
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1]
    const [bx, bz] = line[i]
    const step = Math.hypot(bx - ax, bz - az)
    const heading = against ? Math.atan2(az - bz, ax - bx) : Math.atan2(bz - az, bx - ax)
    while (next <= walked + step && step > 0) {
      const t = (next - walked) / step
      marks.push({ at: [ax + (bx - ax) * t, az + (bz - az) * t], heading })
      next += every
    }
    walked += step
  }
  return marks
}

/*
 * T-junctions: a road ending on another, not at that one's end. Drawn at
 * its true width, the road ending there stops at the edge of the one it
 * meets, along that road's own curve, instead of reaching across and
 * beyond it with its square-cut end.
 */

/** A road (`stem`) ending, at its `end`, on a node in the middle of another (`through`): a T. */
export type Tee<Id> = { stem: Id; through: Id; at: Point; end: 'start' | 'end' }

const samePoint = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1]

/** Every T among the roads: each end of a road that's a node another road has between its own ends (src/maps/junctions.ts). */
export function teesOf<Id>(roads: { id: Id; line: Point[] }[]): Tee<Id>[] {
  const found: Tee<Id>[] = []
  for (const stem of roads) {
    if (stem.line.length < 2) continue
    const ends: [Point, 'start' | 'end'][] = [
      [stem.line[0], 'start'],
      [stem.line[stem.line.length - 1], 'end'],
    ]
    for (const [at, end] of ends)
      for (const through of roads) {
        if (through.id === stem.id) continue
        const index = through.line.findIndex((point) => samePoint(point, at))
        if (index > 0 && index < through.line.length - 1) found.push({ stem: stem.id, through: through.id, at, end })
      }
  }
  return found
}

/**
 * Which side of the through road the stem lies on, looking along the
 * through road the way it was drawn: 1 right, −1 left. Judged a few
 * blocks back up the stem from where it ends, on both roads' courses.
 */
export function teeSide(stem: Point[], end: 'start' | 'end', through: Point[], at: Point): 1 | -1 {
  const line = end === 'start' ? stem : [...stem].reverse()
  const back = pointAlong(line, distancesOf(line), Math.min(4, distancesOf(line).at(-1) ?? 0))
  const s = distanceAlong(through, at)
  const along = distancesOf(through)
  const ahead = sub(pointAlong(through, along, s + 0.5), pointAlong(through, along, s - 0.5))
  return cross(ahead, sub(back, at)) >= 0 ? 1 : -1
}

/**
 * The ground beyond the through road's near edge, as seen from the stem:
 * a band from the line `offset` blocks off the through road's course on
 * the stem's `side` (its kerb, or the edge it's drawn to), along `reach`
 * blocks of it each way from `at`, to the line `reach` blocks further
 * from the stem, both following the road's curve (so a tight bend is
 * covered as a straight is; corners struck out from the ends' normals
 * would fall short of it). What a T's stem is masked by, so it ends on
 * the through road's edge as that road bends.
 */
export function beyondEdge(through: Point[], at: Point, side: 1 | -1, offset: number, reach: number): Point[] {
  const { points, along } = stationed(through, [])
  const s = distanceAlong(points, at)
  const piece = sliceAlong(points, along, Math.max(0, s - reach), Math.min(along.at(-1) ?? 0, s + reach)).points
  if (piece.length < 2) return []
  const near = offsetCourse(piece, side * offset)
  const far = offsetCourse(piece, side * (offset - reach))
  return [...near, ...far.reverse()]
}
