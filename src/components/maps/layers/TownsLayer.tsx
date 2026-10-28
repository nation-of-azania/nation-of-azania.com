import type { ReactNode } from 'react'

import type { ClaimPart, PartRole } from '@/maps/claims'
import { homeClaimBounds, isSite, spoken, type MapTown } from '@/maps/data'
import { outlineToRing, type Bounds, type Point } from '@/maps/geo'
import { GROUND } from '@/maps/palette'
import { siteFacts, siteLine } from '@/maps/sites'

import {
  boundsTouch,
  halo,
  inBounds,
  kept,
  LabelPlacer,
  LIVE_CLOSE_IN,
  liveOf,
  livePlan,
  named,
  pathOf,
  steadyHatch,
  textWidth,
  upright,
  type Live,
  type Projection,
  type Rect,
} from './projection'
import { SITE_R, SiteMark, siteMarkRect } from './SiteMark'

/** Where a town's name was found room (its box), for TownLabels to draw. */
export type TownLabel = Rect & {
  fontSize: number
  tracking: number
  /** Faded, once the reader is inside the town. */
  opacity: number
  /** At the home block, with its lozenge; or along the claim's edge, from inside. */
  at: 'home' | 'edge'
  /** A held site's second line, under the name: "diamonds · $333 a day". None for a town, or far out. */
  sub: string | null
  /** How it may move mid-gesture, on the live map's own canvas (./projection.ts → Live). */
  live?: Live
}

/** An outpost's name, where the plan found it room: as a town's, with the words to set ("CALAIS", "TURKEYVILL OUTPOST"). */
export type OutpostLabel = TownLabel & { text: string }

/** The nation's names as the plan places them: the towns' own by id, and their outposts' by town and part (`${id}/${part}`). */
export type TownNames = { towns: Map<number, TownLabel>; outposts: Map<string, OutpostLabel> }

type Props = {
  projection: Projection
  towns: MapTown[]
  selected?: number | null
  /** Towns to set apart, in gold: a mayor's own, while they draw. Everything else fades. */
  emphasised?: number[]
  /** A town clicked; `focus`, the bounds of the part of it clicked when that's an outpost or detached, to look at instead of the town. */
  onSelect?: (town: MapTown, focus?: Bounds) => void
}

/** A town's parts as drawn (src/maps/claims.ts): all of its claims as one, for a town whose parts aren't known. */
const partsOf = (town: MapTown): Pick<ClaimPart, 'role' | 'claims'>[] =>
  town.parts.length ? town.parts : [{ role: 'main', claims: town.claims.map((_, i) => i) }]

/**
 * The part of a town a click fell on, by the `data-part` of the path under
 * it: its bounds when it's an outpost or detached, which the map looks at
 * rather than the town; nothing for the town itself.
 */
export function clickedPart(event: { target: EventTarget | null }, parts: ClaimPart[]): Bounds | undefined {
  const index = Number((event.target as Element | null)?.closest?.('[data-part]')?.getAttribute('data-part'))
  const part = Number.isInteger(index) ? parts[index] : undefined
  return part && part.role !== 'main' ? part.bounds : undefined
}

const far = (zoom: number) => zoom <= -3

/** The zoom from which a town fills the view: its name leaves the home block for the claim's edge. */
const INSIDE = 0.5
/** Closer than this, the reader is plainly in town and the name is left off. */
const TOO_CLOSE = 2
/** From this zoom a site's name carries what it gives and pays beneath it, and a named outpost whose it is; further out, the name alone. */
const SUB_FROM = -2.5
const SUB_SIZE = 10
const SUB_HEIGHT = 12
/**
 * From this zoom a town's outposts are marked at their spawns and named:
 * where the world's nations part into towns (./AbroadLayer.tsx →
 * NATIONS_BELOW). Further out the nation is the unit, and an outpost is
 * simply ground of Azania's.
 */
const OUTPOSTS_FROM = -4.5

/** The label's type at a zoom: size, tracking and how far above the home it sits (clear of a pin there, close in). */
const labelType = (zoom: number) => {
  const fontSize = zoom >= 0 ? 13 : zoom >= -2 ? 12 : 11
  return { fontSize, tracking: fontSize * 0.14, lift: zoom >= -0.5 ? 22 : 14 }
}

/** An outpost's name is set a size under its town's, and tracked a little tighter: the town's own name comes first. */
const outpostType = (zoom: number) => {
  const fontSize = labelType(zoom).fontSize - 1
  return { fontSize, tracking: fontSize * 0.12, lift: labelType(zoom).lift }
}

/** A site's mark shrinks a little at the scale of the nation, as the pins do, and more at the scale of the world. */
const markScale = (zoom: number) => (zoom <= -6 ? 0.6 : far(zoom) ? 0.75 : 1)

/** A town's lozenge, half its width: smaller at the scale of the world, where towns crowd. */
const lozenge = (zoom: number) => (zoom <= -5 ? 3.5 : 5)

/** The lozenge as a path about (x, y), `r` from its middle to a point. */
const lozengePath = (x: number, y: number, r: number) => `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`

/** The dash of a held site's edge, and of an outpost's over its casing: shorter far out, where the lines are hairlines. */
const dashAt = (zoom: number) => (far(zoom) ? '3 2' : '5 3')

/**
 * What an outpost is called on the map and in the panels: the name its
 * town gave it ("Calais"), else the town's name and the word, so a reader
 * coming on a claim far from anywhere knows whose it is at once.
 */
export const outpostName = (town: string, given: string | null): string =>
  given ? spoken(given) : `${spoken(town)} outpost`

/** Whose a named outpost is, in the line beneath its name, as the search says it. */
export const outpostOf = (town: string): string => `Outpost of ${spoken(town)}`

/** Towns by weight: the biggest keep their names when space is short; the held sites come after every town, the richest first. */
const byWeight = (towns: MapTown[]) =>
  [...towns].sort(
    (a, b) =>
      Number(isSite(a)) - Number(isSite(b)) ||
      b.residents - a.residents ||
      (b.site?.income ?? 0) - (a.site?.income ?? 0),
  )

const onPage = (projection: Projection, town: MapTown) =>
  !town.bounds || boundsTouch(town.bounds, projection.bounds)

/** A town's outposts on the page, each with its index among the town's parts (its key in the plan). */
const outpostsOn = (projection: Projection, town: MapTown): { part: ClaimPart; index: number }[] =>
  projection.zoom >= OUTPOSTS_FROM && onPage(projection, town)
    ? town.parts.flatMap((part, index) =>
        part.role === 'outpost' && inBounds(projection.bounds, part.centre) ? [{ part, index }] : [],
      )
    : []

/**
 * What a name asks of the plan: the point it belongs to and the ground it
 * may run along the top edge of once the reader is inside, its words and
 * their type, and what stands at the point, to keep clear of.
 */
type NameAsk = {
  at: Point
  within: Bounds | null
  text: string
  sub: string | null
  fontSize: number
  tracking: number
  /** The half-width of what's marked at the point. */
  clear: number
  /** How far above the point the name sits. */
  lift: number
}

/**
 * Where a name may go, best first. Out at the scale of the nation, above
 * its point, else below, else to either side. Once the reader is inside
 * the ground it names, the name moves to the ground's top edge, like a
 * district's name on a street map, and is left off when they are closer
 * still: the panel names the town, and the roads and places want the
 * room.
 */
function candidatesFor(projection: Projection, ask: NameAsk): TownLabel[] {
  const { zoom } = projection
  const { fontSize, tracking, sub } = ask
  const subHeight = sub ? SUB_HEIGHT : 0
  const width = Math.max(textWidth(ask.text, fontSize, tracking), sub ? textWidth(sub, SUB_SIZE) : 0) + 8
  const height = fontSize + 8 + subHeight
  /** The box around a name centred on `cx` with its baseline at `baseline`, the sub-line beneath. */
  const box = (cx: number, baseline: number, at: TownLabel['at'], opacity: number): TownLabel => ({
    x: cx - width / 2,
    y: baseline - fontSize - 4,
    width,
    height,
    fontSize,
    tracking,
    opacity,
    at,
    sub,
  })
  if (zoom < INSIDE) {
    const [x, y] = projection.project(ask.at)
    const beside = ask.clear + 4 + width / 2
    return [
      box(x, y - ask.lift - subHeight, 'home', 1),
      box(x, y + ask.lift + fontSize - 2, 'home', 1),
      box(x + beside, y + fontSize / 2 - 2 - subHeight / 2, 'home', 1),
      box(x - beside, y + fontSize / 2 - 2 - subHeight / 2, 'home', 1),
    ]
  }
  if (zoom >= TOO_CLOSE || !ask.within) return []
  const claim = ask.within
  const view = projection.view ?? projection.bounds
  // Along the top edge of the claim, centred on what of it is on the page;
  // when that edge is above the page, along the page's top instead.
  const left = Math.max(claim.minX, view.minX)
  const right = Math.min(claim.maxX, view.maxX)
  if (right - left <= 0 || claim.maxZ < view.minZ || claim.minZ > view.maxZ) return []
  const [x, top] = projection.project([(left + right) / 2, Math.max(claim.minZ, view.minZ)])
  const opacity = 0.9 - ((zoom - INSIDE) / (TOO_CLOSE - INSIDE)) * 0.4
  return [box(x, top + fontSize + 10, 'edge', opacity)]
}

/**
 * Where a town's name may go: about its home block (its lozenge), then
 * along the top edge of the claim holding the home. A held site's name
 * keeps clear of its mark, which is bigger than a lozenge, and carries a
 * line beneath it saying what it gives and pays.
 */
function nameCandidates(projection: Projection, town: MapTown): TownLabel[] {
  if (!town.home) return []
  const { zoom } = projection
  const type = labelType(zoom)
  const site = siteFacts(town)
  // Clear of what stands at the home: a site's mark, or a pin (12 px) that may sit on a town's lozenge.
  const r = site ? SITE_R : 12
  return candidatesFor(projection, {
    at: town.home,
    within: homeClaimBounds(town),
    text: spoken(town.name).toUpperCase(),
    sub: site && zoom >= SUB_FROM ? siteLine(site) : null,
    fontSize: type.fontSize,
    tracking: type.tracking,
    clear: r,
    lift: site ? Math.max(type.lift, r + 8) : type.lift,
  })
}

/**
 * Where an outpost's name may go: about its spawn, where its hollow
 * lozenge stands, then along the top edge of the outpost. Named as the
 * town named it, with whose it is beneath from close-ish in, or by the
 * town's name and "outpost", which says it all.
 */
function outpostCandidates(projection: Projection, town: MapTown, part: ClaimPart): OutpostLabel[] {
  const { zoom } = projection
  const type = outpostType(zoom)
  const given = part.spawns[0]?.name ?? null
  const text = outpostName(town.name, given).toUpperCase()
  const candidates = candidatesFor(projection, {
    at: part.centre,
    within: part.bounds,
    text,
    sub: given && zoom >= SUB_FROM ? outpostOf(town.name) : null,
    fontSize: type.fontSize,
    tracking: type.tracking,
    clear: 12,
    lift: type.lift,
  })
  return candidates.map((candidate) => ({ ...candidate, text }))
}

/**
 * Finds each town's name a spot, the biggest towns first, and then each
 * outpost's, after every town's, since a town's own name comes first; part
 * of the label plan (./labels.ts). The sites' marks take their room before
 * any name is placed, as the pins do, so no name lands on a gem. On the
 * live map's own canvas each name says how it may move mid-gesture, and a
 * name at its point that lost is kept in reserve (`reserve`), hidden, for
 * the map to bring in when a zoom makes room.
 */
export function placeTownNames(
  projection: Projection,
  towns: MapTown[],
  placer: LabelPlacer,
  reserve = false,
): TownNames {
  const placed = new Map<number, TownLabel>()
  const outposts = new Map<string, OutpostLabel>()
  const live = livePlan(projection)
  for (const town of towns) {
    if (!town.home || !isSite(town) || !onPage(projection, town)) continue
    const [x, y] = projection.project(town.home)
    placer.claim(siteMarkRect(x, y, markScale(projection.zoom)))
  }
  /** Tries the candidates, and says how the name may move: at its point, Azania's own (class 1) until the reader is inside; along the edge it has the one spot, and only fades. */
  const place = <T extends TownLabel>(candidates: T[], from: number): T | null => {
    if (candidates.length === 0) return null
    const rank = placer.rank()
    const spot = placer.tryPlace(candidates)
    const home = candidates[0].at === 'home'
    const zooms: [number, number] = home ? [from, INSIDE] : [INSIDE, TOO_CLOSE]
    if (spot) return live && (home || LIVE_CLOSE_IN) ? { ...spot, live: liveOf(candidates, candidates.indexOf(spot), rank, zooms, 1) } : spot
    if (reserve && home) return { ...candidates[0], live: liveOf(candidates, 0, rank, zooms, 1, { reserve: true }) }
    return null
  }
  const weighed = byWeight(towns)
  for (const town of weighed) {
    if (!onPage(projection, town)) continue
    const spot = place(nameCandidates(projection, town), -99)
    if (spot) placed.set(town.id, spot)
  }
  for (const town of weighed) {
    for (const { part, index } of outpostsOn(projection, town)) {
      const spot = place(outpostCandidates(projection, town, part), OUTPOSTS_FROM)
      if (spot) outposts.set(`${town.id}/${index}`, spot)
    }
  }
  return { towns: placed, outposts }
}

/**
 * How a part of a town is edged, as against the town itself. The town
 * keeps the strong, whole edge. An outpost's is striped: its dash drawn
 * over a casing of whitewash, so the line stays whole, in the town's own
 * colour, and still plainly isn't the town's own edge; a dashed edge
 * alone is a town of no nation's. Detached claims are edged quietly, in
 * the same colour, the line thinner than the town's (never under a
 * hairline, or a lone chunk would vanish) and fainter: the town's, on
 * their own, and nothing more said of them.
 */
function partEdge(role: PartRole, width: number, opacity: number, dash: string | undefined, zoom: number) {
  switch (role) {
    case 'outpost':
      return { width, opacity, dash: dash ?? dashAt(zoom), casing: true }
    case 'detached':
      return { width: Math.max(1, width * 0.75), opacity: opacity * 0.65, dash, casing: false }
    default:
      return { width, opacity, dash, casing: false }
  }
}

/**
 * Azania's towns: Towny's claims as a tinted outline in the deep sea of the
 * brand. Far out, the claims thin to a hairline. A held site's claims are
 * drawn in the treasury's gold instead, hatched and with a dashed edge, so
 * they read as ground the nation holds rather than a town it built. A
 * town's outposts and any claims detached from it (src/maps/claims.ts)
 * are drawn part by part, each edged for what it is (partEdge) and each
 * path saying which part, so a click on an outpost can say it was one.
 * The names are drawn by TownLabels, last of all, so a name is never under
 * a road.
 */
export function TownsLayer({ projection, towns, selected, emphasised, onSelect }: Props) {
  const { zoom } = projection
  const strokeWidth = far(zoom) ? 1 : zoom >= 0 ? 2 : 1.5
  const interactive = Boolean(onSelect)
  const emphasis = emphasised && emphasised.length > 0 ? new Set(emphasised) : null
  const visible = byWeight(towns).filter((town) => onPage(projection, town))
  // The hatching is in the page's own pixels, so it reads the same at every zoom; one pattern per SVG.
  const hatch = `${projection.id}-site-hatch`
  const anySite = visible.some(isSite)

  return (
    <g className="az-towns">
      {anySite ? (
        <defs>
          <pattern
            height={6}
            id={hatch}
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
            width={6}
            {...steadyHatch(45)}
          >
            <line stroke={GROUND.saffronDeep} strokeOpacity={0.55} strokeWidth={1.2} x1={0} x2={0} y1={0} y2={6} />
          </pattern>
        </defs>
      ) : null}
      {visible.map((town) => {
        const isSelected = selected === town.id
        const dimmed = emphasis ? !emphasis.has(town.id) : false
        const highlighted = emphasis ? emphasis.has(town.id) : false
        const site = isSite(town)
        const strong = isSelected || highlighted
        const width = strong ? strokeWidth + 1 : strokeWidth
        const ink = site || highlighted ? GROUND.saffronDeep : GROUND.sea700
        // Part by part, each path saying which (data-part), so a click on an outpost can say it was one.
        const parts = partsOf(town).map((part, index) => ({
          index,
          role: part.role,
          d: part.claims.map((claim) => pathOf(projection, outlineToRing(town.claims[claim]), true)).join(''),
        }))
        return (
          <g
            key={town.id}
            className={interactive ? 'az-hit' : undefined}
            data-town={town.id}
            onClick={onSelect ? (event) => onSelect(town, clickedPart(event, town.parts)) : undefined}
            opacity={dimmed ? 0.35 : 1}
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            {parts.map(({ index, role, d }) => {
              const edge = partEdge(role, width, site ? (isSelected ? 1 : 0.85) : strong ? 1 : 0.8, site ? dashAt(zoom) : undefined, zoom)
              const line = {
                d,
                fill: site ? `url(#${hatch})` : highlighted ? GROUND.saffron : GROUND.sea700,
                fillOpacity: site ? undefined : isSelected ? 0.2 : highlighted ? 0.16 : 0.09,
                stroke: ink,
                strokeDasharray: edge.dash,
                strokeLinejoin: 'round' as const,
                strokeOpacity: edge.opacity,
                strokeWidth: edge.width,
              }
              if (!site && !edge.casing) return <path data-part={index} data-role={role} key={index} {...line} />
              return (
                <g data-part={index} data-role={role} key={index}>
                  {/* A wash under a site's hatching, deeper once the site is open in the panel. */}
                  {site ? <path d={d} fill={GROUND.saffron} fillOpacity={isSelected ? 0.16 : 0.06} stroke="none" /> : null}
                  {edge.casing ? (
                    <path d={d} fill="none" stroke={GROUND.whitewash} strokeLinejoin="round" strokeOpacity={0.9} strokeWidth={edge.width} />
                  ) : null}
                  <path {...line} />
                </g>
              )
            })}
          </g>
        )
      })}
    </g>
  )
}

/**
 * The mark at an outpost's spawn: the town's lozenge turned inside out, a
 * whitewash lozenge edged in the ink, a little smaller. Kin to the home's
 * mark, and plainly the lesser. The legend and a town's panel draw it too.
 */
export function OutpostMark({ x, y, r, ink = GROUND.sea800, children }: { x: number; y: number; r: number; ink?: string; children?: ReactNode }) {
  return (
    <path d={lozengePath(x, y, r)} fill={GROUND.whitewash} stroke={ink} strokeLinejoin="round" strokeWidth={1.5}>
      {children}
    </path>
  )
}

/**
 * A part's look in a line, for the legend and a town's panel: an outpost's
 * striped edge with the hollow lozenge at its spawn, or detached claims'
 * faint edge. On a 48 × 20 grid, as the legend's samples are; `ink` is the
 * claims' colour, `mark` the lozenge's.
 */
export function PartSample({ role, ink = GROUND.sea700, mark = GROUND.sea800 }: { role: 'outpost' | 'detached'; ink?: string; mark?: string }) {
  const edge = partEdge(role, 1.5, 0.9, undefined, 0)
  return (
    <g>
      <rect fill={ink} fillOpacity={0.1} height={14} stroke="none" width={40} x={4} y={3} />
      {edge.casing ? <rect fill="none" height={14} stroke={GROUND.whitewash} strokeWidth={edge.width} width={40} x={4} y={3} /> : null}
      <rect fill="none" height={14} stroke={ink} strokeDasharray={edge.dash} strokeOpacity={edge.opacity} strokeWidth={edge.width} width={40} x={4} y={3} />
      {role === 'outpost' ? <OutpostMark ink={mark} r={4} x={24} y={10} /> : null}
    </g>
  )
}

/**
 * The towns' names in small capitals, haloed in whitewash: at their home
 * blocks, with a lozenge for the home itself, or along the claim's edge
 * once the reader is inside. A held site wears its mark instead of the
 * lozenge, its name in the treasury's gold ink, and beneath it what it
 * gives and pays. From the scale of the nation in, each outpost is marked
 * at its spawn with a hollow lozenge and named a size smaller, after the
 * towns; a click on either opens the town and looks at the outpost. Drawn
 * after every other layer, where the plan found room. The lozenge and the
 * mark show the home at every zoom.
 */
export function TownLabels({
  projection,
  towns,
  labels,
  outposts,
  selected,
  onSelect,
}: {
  projection: Projection
  towns: MapTown[]
  labels: Map<number, TownLabel>
  /** The outposts' names, by town and part, as placeTownNames keyed them. */
  outposts?: Map<string, OutpostLabel>
  selected?: number | null
  /** A town clicked, at its mark or its name; `focus`, an outpost's bounds when it was the outpost's. */
  onSelect?: (town: MapTown, focus?: Bounds) => void
}) {
  const interactive = Boolean(onSelect)
  const scale = markScale(projection.zoom)
  const r = lozenge(projection.zoom)
  const hit = interactive ? 'az-hit' : undefined
  const cursor = interactive ? { cursor: 'pointer' } : undefined
  const weighed = byWeight(towns)
  return (
    <g className="az-town-names">
      {weighed.map((town) => {
        if (!town.home || !onPage(projection, town)) return null
        const label = labels.get(town.id)
        const [hx, hy] = projection.project(town.home)
        const isSelected = selected === town.id
        const site = siteFacts(town)
        const ink = site ? GROUND.saffronDeep : isSelected ? GROUND.saffronDeep : GROUND.sea800
        return (
          <g
            key={town.id}
            className={hit}
            onClick={onSelect ? () => onSelect(town) : undefined}
            style={cursor}
          >
            <g {...upright(hx, hy)} {...(site ? kept(projection, siteMarkRect(hx, hy, scale)) : null)}>
              {site ? (
                <SiteMark facts={site} scale={scale} selected={isSelected} x={hx} y={hy}>
                  <title>{spoken(town.name)}</title>
                </SiteMark>
              ) : (
                <path
                  d={lozengePath(hx, hy, r)}
                  fill={isSelected ? GROUND.saffron : GROUND.sea800}
                  stroke={GROUND.whitewash}
                  strokeWidth={1.5}
                >
                  <title>{spoken(town.name)}</title>
                </path>
              )}
            </g>
            {label ? (
              // At the home, the name keeps its distance from the mark; along the claim's edge, its own spot there.
              <g
                {...(label.at === 'home' ? upright(hx, hy) : upright(label.x + label.width / 2, label.y))}
                {...named(projection, 'town', town.id, { box: label, live: label.live })}
              >
                <text
                  className="font-label"
                  fill={ink}
                  fontSize={label.fontSize}
                  fontWeight={600}
                  letterSpacing={label.tracking}
                  opacity={label.opacity}
                  textAnchor="middle"
                  x={label.x + label.width / 2 + label.tracking / 2}
                  y={label.y + label.fontSize + 4}
                  {...halo(GROUND.whitewash, 3.5)}
                >
                  {spoken(town.name).toUpperCase()}
                </text>
                {label.sub ? (
                  <text
                    className="font-body"
                    fill={GROUND.saffronDeep}
                    fontSize={SUB_SIZE}
                    fontWeight={600}
                    opacity={label.opacity * 0.9}
                    textAnchor="middle"
                    x={label.x + label.width / 2}
                    y={label.y + label.fontSize + 4 + SUB_HEIGHT - 1}
                    {...halo(GROUND.whitewash, 3)}
                  >
                    {label.sub}
                  </text>
                ) : null}
              </g>
            ) : null}
          </g>
        )
      })}
      {weighed.map((town) =>
        outpostsOn(projection, town).map(({ part, index }) => {
          const key = `${town.id}/${index}`
          const label = outposts?.get(key)
          const [x, y] = projection.project(part.centre)
          const isSelected = selected === town.id
          const ink = isSelected ? GROUND.saffronDeep : GROUND.sea800
          return (
            <g className={hit} key={key} onClick={onSelect ? () => onSelect(town, part.bounds) : undefined} style={cursor}>
              <g {...upright(x, y)}>
                <OutpostMark ink={ink} r={r * 0.8} x={x} y={y}>
                  <title>{outpostName(town.name, part.spawns[0]?.name ?? null)}</title>
                </OutpostMark>
              </g>
              {label ? (
                <g
                  {...(label.at === 'home' ? upright(x, y) : upright(label.x + label.width / 2, label.y))}
                  {...named(projection, 'outpost', key, { box: label, live: label.live })}
                >
                  <text
                    className="font-label"
                    fill={ink}
                    fontSize={label.fontSize}
                    fontWeight={600}
                    letterSpacing={label.tracking}
                    opacity={label.opacity * 0.85}
                    textAnchor="middle"
                    x={label.x + label.width / 2 + label.tracking / 2}
                    y={label.y + label.fontSize + 4}
                    {...halo(GROUND.whitewash, 3)}
                  >
                    {label.text}
                  </text>
                  {label.sub ? (
                    <text
                      className="font-body"
                      fill={ink}
                      fontSize={SUB_SIZE}
                      fontWeight={600}
                      opacity={label.opacity * 0.75}
                      textAnchor="middle"
                      x={label.x + label.width / 2}
                      y={label.y + label.fontSize + 4 + SUB_HEIGHT - 1}
                      {...halo(GROUND.whitewash, 3)}
                    >
                      {label.sub}
                    </text>
                  ) : null}
                </g>
              ) : null}
            </g>
          )
        }),
      )}
    </g>
  )
}
