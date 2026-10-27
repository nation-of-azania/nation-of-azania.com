import type { MouseEvent, PointerEvent } from 'react'

import {
  abroadCentre,
  abroadHomeBounds,
  namedFrom,
  nationFontSize,
  sameNation,
  type Abroad,
  type AbroadNation,
  type AbroadTown,
} from '@/maps/abroad'
import { spoken } from '@/maps/data'
import type { Bounds, Outline, Point } from '@/maps/geo'
import { GROUND, STANCE_COLOURS } from '@/maps/palette'
import { isSiteKind, siteLine, type SiteFacts } from '@/maps/sites'
import { isServerKind, SERVER_INKS, SERVER_WORDS, type ServerKind } from '@/maps/trading'
import type { MapSelection } from '@/maps/url'

import type { Store } from '../hooks'
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
  steadyHatch,
  textWidth,
  upright,
  type Live,
  type Projection,
  type Rect,
} from './projection'
import { SITE_R, SiteMark, siteMarkRect } from './SiteMark'
import { TRADING_R, TradingMark, tradingMarkRect, TradingPip } from './TradingMark'

/**
 * The rest of the world around Azania (src/maps/abroad.ts): every other
 * nation's towns and the towns of no nation, drawn quietly under the
 * nation's own layers — each in its nation's colour as the Rulercraft map
 * paints it (tempered, src/maps/palette.ts → nationInk), a thin edge and a
 * faint fill, the towns of no nation in grey with a dashed edge — so
 * Azania, in its sea and saffron, stays the one in full colour.
 *
 * Far out the world is nations: their names are set across their
 * heartlands in spaced capitals, a town too small to draw is a dot, and a
 * click opens the nation. Coming in, the capitals' names appear, then
 * every town's, smaller and quieter than Azania's and placed after them;
 * a click opens the town. A server site another nation holds wears the
 * site's mark rimmed in its holder's colour, with what it pays, since it
 * changes hands by siege. The server's own places, which nobody holds
 * (src/maps/trading.ts), are drawn apart from every nation: a trading
 * outpost is a pip of the lagoon far out, then its own square mark, then
 * its name in italic, as an atlas sets what isn't a settlement; its claim
 * is edged in lagoon dots. A landmark is the same, quieter, in grey, and
 * only from closer in.
 *
 * Three hundred-odd towns and some thirty thousand claim corners, redrawn
 * each time the map settles, so the drawing is lean: the projection is
 * applied as the scale and shift it is rather than point by point, a
 * corner closer than a pixel to the last is dropped, a claim off the page
 * or smaller than a pixel is left out, and one click and one hover
 * handler serve every town (the element under the pointer says which).
 */

/**
 * How a nation is drawn: its edge and fill, the ink of its names, a dash
 * for the towns of no nation, a hatch for a nation at war with Azania, and
 * how loudly its name is set — the diplomacy layer sets Azania's friends
 * and foes in bold and lets the neutral recede.
 */
export type NationStyle = {
  line: string
  text: string
  fill: number
  dash?: string
  hatch?: boolean
  voice?: 'loud' | 'quiet'
}

/** Clicks further out than this open the nation; closer in, the town. */
export const NATIONS_BELOW = -4.5
/** Every town's home is marked from here in; a capital's from further out. */
const HOMES_FROM = -3.5
const CAPITALS_FROM = -5.5
/** Names: a capital's from here, every town's from closer; the nations' until here. */
const CAPITAL_NAMES_FROM = -4.25
const NAMES_FROM = -3
const NATION_NAMES_UNTIL = -3.25
/** A site's mark from here, its name from closer, and what it pays beneath from closer still. */
const SITES_FROM = -5.5
const SITE_NAMES_FROM = -3.5
const SUB_FROM = -2.5
const SUB_SIZE = 10
/**
 * The server's own places. Sixty-odd across the world, so far out a
 * trading outpost is a pip, which shows where the trade is without a word;
 * its mark from where a site's appears, its name with the sites'. A
 * landmark is quieter: nothing far out, its mark from closer in, its name
 * with the towns', and what it is beneath.
 */
const TRADING_MARKS_FROM = SITES_FROM
const LANDMARKS_FROM = -4.5
const NAME_FROM: Record<ServerKind, number> = { trading: SITE_NAMES_FROM, landmark: NAMES_FROM }
/** A town drawn smaller than this, in px, is a dot. */
const DOT_BELOW = 3
/**
 * For the live map mid-gesture (leaflet/placing.ts): the nations' names,
 * and Azania's own, are kept in reserve while the drawn zoom is at or
 * beyond this, so a zoom out from where none is named brings them in; the
 * world's towns' names are kept in reserve this many to a copy of the
 * world, the best first, and a town is kept whose name would be set this
 * much further in.
 */
const NATION_RESERVES_UNTIL = -2.25
const TOWN_RESERVES = 40
const TOWN_RESERVE_REACH = 0.5

/** The projection as the scale and shift it is: Leaflet's is affine, so thirty thousand corners needn't each go through it. */
type Affine = { ax: number; bx: number; ay: number; by: number }

function affineOf(projection: Projection): Affine {
  const [x0, y0] = projection.project([0, 0])
  const [x1, y1] = projection.project([4096, 4096])
  return { ax: (x1 - x0) / 4096, bx: x0, ay: (y1 - y0) / 4096, by: y0 }
}

const at = (f: Affine, [x, z]: Point): [number, number] => [f.ax * x + f.bx, f.ay * z + f.by]

/** A claim's outline as a path, a corner within `min` px of the last one dropped; empty when it comes to less than a triangle. */
function ringPath(outline: Outline, f: Affine, min: number): string {
  let d = ''
  let n = 0
  let lx = 0
  let ly = 0
  for (let i = 0; i < outline.x.length; i++) {
    const x = f.ax * outline.x[i] + f.bx
    const y = f.ay * outline.z[i] + f.by
    if (n && Math.abs(x - lx) < min && Math.abs(y - ly) < min) continue
    d += `${n ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    lx = x
    ly = y
    n++
  }
  return n >= 3 ? `${d}Z` : ''
}

/** A town's claims on the page, each left out when it's off the page or under a pixel across. */
function claimsPath(town: AbroadTown, f: Affine, cull: Bounds, ppb: number): string {
  let d = ''
  for (let i = 0; i < town.claims.length; i++) {
    const b = town.claimBounds[i]
    if (!b || !boundsTouch(b, cull)) continue
    if (Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * ppb < 1) continue
    d += ringPath(town.claims[i], f, 0.75)
  }
  return d
}

/**
 * A dot as a stroke of no length with a round cap, which draws a disc the
 * stroke's width across: one path holds a nation's hundreds, and on the
 * live map, whose lines keep their width mid-zoom (maps.css), each keeps
 * its size as a mark should.
 */
const dot = ([x, y]: [number, number]): string => `M${x.toFixed(1)} ${y.toFixed(1)}h0`

const onPage = (projection: Projection, town: AbroadTown) =>
  town.bounds !== null && boundsTouch(town.bounds, projection.bounds)

const sizePx = (b: Bounds, ppb: number) => Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * ppb

/** A site's facts out of a town abroad; null for a players' town, and for the server's own places, which are no sites. */
export const abroadSite = (town: Pick<AbroadTown, 'kind' | 'income' | 'resource'>): SiteFacts | null =>
  isSiteKind(town.kind) ? { kind: town.kind, income: town.income, resource: town.resource, note: null } : null

/** How large one of the server's places is marked at a zoom; null where it isn't, or is a pip. */
const serverScale = (zoom: number, kind: ServerKind): number | null =>
  kind === 'trading'
    ? zoom >= TRADING_MARKS_FROM
      ? siteScale(zoom)
      : null
    : zoom >= LANDMARKS_FROM
      ? siteScale(zoom) * 0.85
      : null

/** The edge a town's claims are drawn in: its nation's, or for one of the server's places, its own. */
const edgeOf = (town: AbroadTown, styleOf: (nation: string | null) => NationStyle): string =>
  isServerKind(town.kind) ? SERVER_INKS[town.kind].edge : styleOf(town.nation).line

/** Whose a site is, in a word or two: its holder, or the server's own when nobody holds it. */
const holderWords = (town: Pick<AbroadTown, 'nation'>): string => (town.nation ? spoken(town.nation) : 'the server’s')

/** Which element of the layer an event fell on: a town's claims, a dot among a nation's, or nothing of ours. */
function hitOf(event: MouseEvent | PointerEvent): { town: string | null; nation: string | null } | null {
  const target = event.target as Element | null
  const group = target?.closest?.('[data-nation]')
  if (!group) return null
  return { town: target?.closest?.('[data-town]')?.getAttribute('data-town') ?? null, nation: group.getAttribute('data-nation') }
}

/**
 * The claims abroad, a group per nation (its colour set once on the group)
 * and a path per town, with the towns too small to draw as dots, a path
 * per nation for all of them. Far out, where a click opens the nation
 * anyway, all a nation's claims are one path. The server's own places are
 * a group of their own, in no nation's colour: a claim each, edged in dots
 * of their ink over the faintest wash, since nobody holds them, and only
 * from where their marks appear; further out, or too small to draw, a
 * place is left to its mark. The selected nation's are drawn stronger, the
 * selected town's stronger still, on top.
 */
export function AbroadClaims({
  projection,
  abroad,
  styleOf,
  selected,
  onSelect,
  hover,
}: {
  projection: Projection
  abroad: Abroad
  styleOf: (nation: string | null) => NationStyle
  selected: { town: string | null; nation: string | null }
  onSelect?: (selection: MapSelection) => void
  /** The nation under the pointer, by name, for whatever shows it. */
  hover?: Store<string | null>
}) {
  const { ppb, zoom } = projection
  const f = affineOf(projection)
  const cull = projection.bounds
  const merged = zoom < NATIONS_BELOW
  const groups = new Map<string, { paths: { town: AbroadTown; d: string }[]; all: string; dots: string }>()
  const server: { town: AbroadTown; kind: ServerKind; d: string }[] = []
  let picked: { town: AbroadTown; d: string } | null = null
  for (const town of abroad.towns) {
    if (!onPage(projection, town)) continue
    if (isServerKind(town.kind)) {
      const drawn = serverScale(zoom, town.kind) !== null && sizePx(town.bounds!, ppb) >= DOT_BELOW
      const d = drawn ? claimsPath(town, f, cull, ppb) : ''
      if (!d) continue
      server.push({ town, kind: town.kind, d })
      if (town.slug === selected.town) picked = { town, d }
      continue
    }
    const key = town.nation ?? ''
    const group = groups.get(key) ?? { paths: [], all: '', dots: '' }
    groups.set(key, group)
    if (sizePx(town.bounds!, ppb) < DOT_BELOW) {
      const centre = abroadCentre(town)
      if (centre) group.dots += dot(at(f, centre))
      continue
    }
    const d = claimsPath(town, f, cull, ppb)
    if (!d) continue
    if (merged) group.all += d
    else group.paths.push({ town, d })
    if (town.slug === selected.town) picked = { town, d }
  }
  const width = zoom >= -2 ? 1.25 : 1
  const pickedNation = selected.nation ? abroad.nationBySlug.get(selected.nation)?.name : null

  const click = (event: MouseEvent) => {
    const hit = hitOf(event)
    if (!hit || !onSelect) return
    const town = hit.town ? abroad.townBySlug.get(hit.town) : null
    const nation = hit.nation ? abroad.nationByName.get(hit.nation) : null
    // Far out, the nations; closer in, the towns; a town of no nation is always itself.
    if (nation && (zoom < NATIONS_BELOW || !town)) onSelect({ kind: 'nation', slug: nation.slug })
    else if (town) onSelect({ kind: 'abroad', slug: town.slug })
  }
  // Mid-drag the map slides under a still pointer: the nations passing beneath it aren't hovered, and nothing restyles.
  const over = (event: PointerEvent) => {
    if (!event.buttons) hover?.set(hitOf(event)?.nation || null)
  }
  const out = (event: PointerEvent) => {
    const next = event.relatedTarget as Element | null
    if (!event.buttons && !next?.closest?.('.az-abroad [data-nation]')) hover?.set(null)
  }

  // A nation at war with Azania is hatched in its stance's red, in the page's own pixels, so it reads the same at every zoom.
  const hatch = `${projection.id}-war-hatch`
  const anyHatch = [...groups.keys()].some((key) => styleOf(key || null).hatch)

  return (
    <g
      className="az-abroad az-hit"
      onClick={onSelect ? click : undefined}
      onPointerOut={hover ? out : undefined}
      onPointerOver={hover ? over : undefined}
      style={onSelect ? { cursor: 'pointer' } : undefined}
    >
      {anyHatch ? (
        <defs>
          <pattern
            height={7}
            id={hatch}
            patternTransform="rotate(-45)"
            patternUnits="userSpaceOnUse"
            width={7}
            {...steadyHatch(-45)}
          >
            <rect fill={STANCE_COLOURS.war.line} fillOpacity={0.12} height={7} width={7} />
            <line stroke={STANCE_COLOURS.war.line} strokeOpacity={0.6} strokeWidth={1.5} x1={0} x2={0} y1={0} y2={7} />
          </pattern>
        </defs>
      ) : null}
      {[...groups].map(([key, group]) => {
        const style = styleOf(key || null)
        const strong = Boolean(key) && key === pickedNation
        return (
          <g
            data-hatch={style.hatch ? '' : undefined}
            data-nation={key}
            fill={style.hatch ? `url(#${hatch})` : style.line}
            fillOpacity={style.hatch ? 1 : strong ? Math.max(0.16, style.fill * 2) : style.fill}
            key={key}
            stroke={style.line}
            strokeDasharray={style.dash}
            strokeLinejoin="round"
            strokeOpacity={strong ? 1 : 0.75}
            strokeWidth={strong ? width + 0.75 : width}
          >
            {group.all ? <path d={group.all} /> : null}
            {group.paths.map(({ town, d }) => (
              <path d={d} data-town={town.slug} key={town.slug} />
            ))}
            {group.dots ? (
              <path
                d={group.dots}
                fill="none"
                stroke={style.hatch ? `url(#${hatch})` : style.line}
                strokeDasharray="none"
                strokeLinecap="round"
                strokeOpacity={0.9}
                strokeWidth={zoom < -6 ? 2.6 : 3.2}
              />
            ) : null}
          </g>
        )
      })}
      {/* The server's own places: nobody's, so in no nation's group, never merged, a click always opening the place. */}
      {server.length ? (
        <g data-nation="" strokeLinecap="round" strokeLinejoin="round">
          {server.map(({ town, kind, d }) => (
            <path
              d={d}
              data-town={town.slug}
              fill={SERVER_INKS[kind].edge}
              fillOpacity={0.06}
              key={town.slug}
              stroke={SERVER_INKS[kind].edge}
              strokeDasharray="0.5 3.5"
              strokeOpacity={0.95}
              strokeWidth={width + 0.75}
            />
          ))}
        </g>
      ) : null}
      {/* The open town, lifted off the page: its edge in its colour over a whitewash casing, whatever that colour is; one of the server's places washed lighter, being nobody's. */}
      {picked ? (
        <g data-nation={picked.town.nation ?? ''} strokeLinejoin="round">
          <path d={picked.d} fill="none" stroke={GROUND.whitewash} strokeOpacity={0.9} strokeWidth={width + 3.5} />
          <path
            d={picked.d}
            data-town={picked.town.slug}
            fill={edgeOf(picked.town, styleOf)}
            fillOpacity={isServerKind(picked.town.kind) ? 0.1 : 0.22}
            stroke={edgeOf(picked.town, styleOf)}
            strokeWidth={width + 1}
          />
        </g>
      ) : null}
    </g>
  )
}

/** A town's name abroad, where the plan found room: as it's set, and for one of the server's places, which. */
export type AbroadName = Rect & { fontSize: number; tracking: number; text: string; sub: string | null; server: ServerKind | null; live?: Live }

/** A nation's name across its heartland, where the plan found room; `live`, how it may move mid-gesture on the live map's own canvas. */
export type NationName = Rect & { fontSize: number; tracking: number; text: string; opacity: number; live?: Live }

export type AbroadPlan = { towns: Map<string, AbroadName>; nations: Map<string, NationName> }

export const EMPTY_ABROAD_PLAN: AbroadPlan = { towns: new Map(), nations: new Map() }

/** Azania itself among the nations far out: its name, and where to set it. */
export type HomeNation = { name: string; heart: Point; extent: Bounds | null }

/** The mark at a town's home: a dot, a capital's ringed; null when it isn't shown at this zoom. */
const homeMark = (zoom: number, town: AbroadTown): { r: number; ring: number } | null => {
  if (town.kind !== 'town' || !town.home) return null
  if (town.capital) return zoom >= CAPITALS_FROM ? { r: zoom >= -2 ? 3 : 2.5, ring: zoom >= -2 ? 5.5 : 4.5 } : null
  return zoom >= HOMES_FROM ? { r: zoom >= -2 ? 2.75 : 2.25, ring: 0 } : null
}

const siteScale = (zoom: number) => (zoom <= -4.5 ? 0.55 : zoom <= -3 ? 0.7 : 0.85)

/**
 * A nation's name: sized by how much ground it holds, spaced out across its
 * heartland where there's room, as an atlas sets a country's name, and
 * kept on the page when its heartland runs off an edge.
 */
function nationName(
  projection: Projection,
  name: string,
  heart: Point,
  extent: Bounds | null,
  chunks: number,
  home: boolean,
): NationName[] {
  const { zoom, ppb } = projection
  const text = spoken(name).toUpperCase()
  const fontSize = nationFontSize(chunks, zoom, home)
  const across = extent ? (extent.maxX - extent.minX) * ppb : 0
  const bare = textWidth(text, fontSize)
  // Never tighter than a little air, nor looser than a letter's width apart.
  const tracking = Math.max(fontSize * (home ? 0.3 : 0.12), Math.min(fontSize * 0.7, (across * 0.75 - bare) / Math.max(1, text.length - 1)))
  const width = bare + tracking * text.length + 6
  const height = fontSize + 6
  const [hx, y] = projection.project(heart)
  const view = projection.view ?? projection.bounds
  const [left] = projection.project([view.minX, view.minZ])
  const [right] = projection.project([view.maxX, view.maxZ])
  // A heart near the page's edge keeps its name on the page; one further off leaves it where it falls.
  const near = inBounds(projection.bounds, heart) && right - left > width + 24
  const x = near ? Math.min(right - 12 - width / 2, Math.max(left + 12 + width / 2, hx)) : hx
  const opacity = home ? 1 : zoom <= NATIONS_BELOW ? 0.85 : 0.7
  const box = (cy: number): NationName => ({ x: x - width / 2, y: cy - height / 2, width, height, fontSize, tracking, text, opacity })
  return [box(y), box(y - height * 1.1), box(y + height * 1.1)]
}

/** The zoom from which a nation holding so much ground is named: the live zooms its name may show in run from here up to NATION_NAMES_UNTIL. */
const nationTier = (chunks: number): number => (chunks >= 6000 ? -99 : chunks >= 2500 ? -6.5 : chunks >= 600 ? -5.5 : -4.5)

/**
 * Azania's own name among the nations far out: placed before its towns'
 * names at the scale of the world, after them nearer; on the live map's
 * own canvas, kept in reserve when it lost, or nearer in than it's named,
 * for a zoom out to bring in.
 */
export function placeHomeName(projection: Projection, home: HomeNation, placer: LabelPlacer, reserve = false): NationName | null {
  const { zoom } = projection
  const placeable = zoom <= NATION_NAMES_UNTIL
  const reservable = reserve && zoom <= NATION_RESERVES_UNTIL
  if (!placeable && !reservable) return null
  const candidates = nationName(projection, home.name, home.heart, home.extent, 0, true)
  const rank = placer.rank()
  const spot = placeable ? placer.tryPlace(candidates) : null
  if (!livePlan(projection)) return spot
  // It leads every name of Azania's at the scale of the world (class 0 up to HOME_NAME_FIRST), and is kept on the page about its heart.
  const live = (at: number, held: boolean) =>
    liveOf(candidates, at, rank, [-99, NATION_NAMES_UNTIL], 1, { lead: HOME_NAME_FIRST, clamp: projection.project(home.heart), reserve: held || undefined })
  if (spot) return { ...spot, live: live(candidates.indexOf(spot), false) }
  return reservable ? { ...candidates[0], live: live(0, true) } : null
}

/** From here out, Azania's name outranks its own towns' names, which crowd at the scale of the world. */
export const HOME_NAME_FIRST = -5.5

/** The zoom from which a town abroad is named: a capital's from further out than a town's, a site's and the server's places' as their marks ask. */
const nameFrom = (town: AbroadTown): number =>
  isServerKind(town.kind) ? NAME_FROM[town.kind] : town.kind !== 'town' ? SITE_NAMES_FROM : town.capital ? CAPITAL_NAMES_FROM : NAMES_FROM

/**
 * Finds the world's names a spot, after Azania's own have had theirs; part
 * of the label plan (./labels.ts). The sites' marks and the server's places'
 * take their room first, then the nations' names far out, the greatest
 * first, then the capitals', then every town's, biggest first; the sites'
 * and the server's places', having nobody living there, come last. Azania's
 * Towny nation (`home`) is never named among them: its own name says it.
 * On the live map's own canvas each name says how it may move mid-gesture,
 * and what lost is kept in reserve (`reserve`), hidden: every nation on the
 * page that a zoom in of a level would name, while the drawn zoom isn't
 * too near, and the names close in, a few dozen of the world's towns.
 */
export function placeAbroadNames(
  projection: Projection,
  abroad: Abroad,
  home: string | null,
  placer: LabelPlacer,
  reserve = false,
): AbroadPlan {
  const { zoom } = projection
  const live = livePlan(projection)
  const towns = new Map<string, AbroadName>()
  const nations = new Map<string, NationName>()
  const visible = abroad.towns.filter((town) => onPage(projection, town))

  if (zoom >= SITES_FROM) {
    for (const town of visible) {
      if (town.kind === 'town' || !town.home) continue
      const [x, y] = projection.project(town.home)
      if (!isServerKind(town.kind)) placer.claim(siteMarkRect(x, y, siteScale(zoom)))
      else {
        // A pip far out claims nothing: the nations' names may cross it, as they do a dot.
        const scale = serverScale(zoom, town.kind)
        if (scale) placer.claim(tradingMarkRect(x, y, scale))
      }
    }
  }
  const nationsPlaceable = zoom <= NATION_NAMES_UNTIL
  const nationsReservable = reserve && zoom <= NATION_RESERVES_UNTIL
  if (nationsPlaceable || nationsReservable) {
    const least = namedFrom(zoom)
    const nearer = namedFrom(zoom + 1)
    const great = [...abroad.nations].sort((a, b) => b.chunks - a.chunks)
    for (const nation of great) {
      if (!nation.heart || !nation.extent || !boundsTouch(nation.extent, projection.bounds)) continue
      // Towns of Azania's Towny nation that the map doesn't hold as its own stay abroad, under Azania's name: never named twice.
      if (sameNation(nation.name, home)) continue
      const placeable = nationsPlaceable && nation.chunks >= least
      const reservable = nationsReservable && nation.chunks >= nearer
      if (!placeable && !reservable) continue
      const candidates = nationName(projection, nation.name, nation.heart, nation.extent, nation.chunks, false)
      const rank = placer.rank()
      const spot = placeable ? placer.tryPlace(candidates) : null
      if (!live) {
        if (spot) nations.set(nation.slug, spot)
        continue
      }
      const facts = (at: number, held: boolean) =>
        liveOf(candidates, at, rank, [nationTier(nation.chunks), NATION_NAMES_UNTIL], 2, { clamp: projection.project(nation.heart!), reserve: held || undefined })
      if (spot) nations.set(nation.slug, { ...spot, live: facts(candidates.indexOf(spot), false) })
      else if (reservable) nations.set(nation.slug, { ...candidates[0], live: facts(0, true) })
    }
  }

  const townsReservable = reserve && LIVE_CLOSE_IN
  const order = visible
    .filter((town) => town.home && zoom + (townsReservable ? TOWN_RESERVE_REACH : 0) >= nameFrom(town))
    .sort((a, b) => Number(b.capital) - Number(a.capital) || b.residents - a.residents || b.chunks - a.chunks)
  let reserves = 0
  for (const town of order) {
    const site = abroadSite(town)
    const server = isServerKind(town.kind) ? town.kind : null
    // A town's name in spaced capitals; one of the server's places' as it's spelt, in italic, as an atlas sets what isn't a settlement.
    const fontSize = server ? 11 : town.capital ? 11 : 10
    const tracking = server ? 0.2 : fontSize * 0.12
    const text = server ? spoken(town.name) : spoken(town.name).toUpperCase()
    const sub =
      zoom < SUB_FROM
        ? null
        : site
          ? `${holderWords(town)} · ${siteLine(site)}`
          : server === 'landmark'
            ? `the server’s ${SERVER_WORDS.landmark.label.toLowerCase()}`
            : null
    const subHeight = sub ? 12 : 0
    const width = Math.max(textWidth(text, fontSize, tracking), sub ? textWidth(sub, SUB_SIZE) : 0) + 6
    const height = fontSize + 6 + subHeight
    const [x, y] = projection.project(town.home!)
    const clear = site
      ? SITE_R * siteScale(zoom) + 5
      : server
        ? TRADING_R * (serverScale(zoom, server) ?? siteScale(zoom)) + 5
        : (homeMark(zoom, town)?.ring || 3) + 4
    const box = (cx: number, top: number): AbroadName => ({ x: cx - width / 2, y: top, width, height, fontSize, tracking, text, sub, server })
    const candidates = [
      box(x, y - clear - height),
      box(x, y + clear),
      box(x + clear + width / 2, y - height / 2),
      box(x - clear - width / 2, y - height / 2),
    ]
    const rank = placer.rank()
    const spot = zoom >= nameFrom(town) ? placer.tryPlace(candidates) : null
    if (!live) {
      if (spot) towns.set(town.slug, spot)
      continue
    }
    if (spot) towns.set(town.slug, { ...spot, live: liveOf(candidates, candidates.indexOf(spot), rank, [nameFrom(town), 99], 2) })
    else if (townsReservable && reserves < TOWN_RESERVES) {
      reserves++
      towns.set(town.slug, { ...candidates[0], live: liveOf(candidates, 0, rank, [nameFrom(town), 99], 2, { reserve: true }) })
    }
  }
  return { towns, nations }
}

/**
 * The world's marks and names, over the nation's own layers and under
 * nothing but the sieges: each town's home as a dot in its nation's colour
 * (a capital's ringed, as an atlas marks one), the sites' marks rimmed in
 * their holders' colours, the server's places' squares where its markers
 * stand, the towns' names in a dark shade of their nation's, the server's
 * places' in their own ink, and far out the nations' names, Azania's in
 * the deep sea.
 */
export function AbroadMarks({
  projection,
  abroad,
  styleOf,
  labels,
  selected,
  onSelect,
}: {
  projection: Projection
  abroad: Abroad
  styleOf: (nation: string | null) => NationStyle
  labels: AbroadPlan
  selected: { town: string | null; nation: string | null }
  onSelect?: (selection: MapSelection) => void
}) {
  const { zoom } = projection
  const interactive = Boolean(onSelect)
  const scale = siteScale(zoom)
  const hit = interactive ? 'az-hit' : undefined
  const cursor = interactive ? { cursor: 'pointer' } : undefined
  const visible = abroad.towns.filter((town) => town.home && onPage(projection, town))
  return (
    <g className="az-abroad-marks">
      {visible.map((town) => {
        const site = abroadSite(town)
        const server = isServerKind(town.kind) ? town.kind : null
        const serverAt = server ? serverScale(zoom, server) : null
        const pip = server === 'trading' && !serverAt
        const mark = homeMark(zoom, town)
        const label = labels.towns.get(town.slug)
        if (!label && !mark && !serverAt && !pip && !(site && zoom >= SITES_FROM)) return null
        const style = styleOf(town.nation)
        const ink = server ? SERVER_INKS[server].text : style.text
        const [hx, hy] = projection.project(town.home!)
        const isSelected = selected.town === town.slug
        const title = server ? `${spoken(town.name)} · ${SERVER_WORDS[server].label}` : null
        // The marks the plan keeps the names off (placeAbroadNames), said on their holders for the live map mid-gesture.
        const keep = server && serverAt ? tradingMarkRect(hx, hy, serverAt) : site && zoom >= SITES_FROM ? siteMarkRect(hx, hy, scale) : null
        return (
          <g
            className={hit}
            key={town.slug}
            onClick={onSelect ? () => onSelect({ kind: 'abroad', slug: town.slug }) : undefined}
            style={cursor}
          >
            <g {...upright(hx, hy)} {...(keep ? kept(projection, keep) : null)}>
              {server && serverAt ? (
                <TradingMark kind={server} scale={serverAt} selected={isSelected} x={hx} y={hy}>
                  <title>{title}</title>
                </TradingMark>
              ) : pip ? (
                <TradingPip x={hx} y={hy}>
                  <title>{title}</title>
                </TradingPip>
              ) : site && zoom >= SITES_FROM ? (
                <SiteMark facts={site} ring={style.line} scale={scale} selected={isSelected} x={hx} y={hy}>
                  <title>{`${spoken(town.name)} · ${holderWords(town)}`}</title>
                </SiteMark>
              ) : mark ? (
                <>
                  {mark.ring ? <circle cx={hx} cy={hy} fill={GROUND.whitewash} r={mark.ring} stroke={style.line} strokeWidth={1.25} /> : null}
                  <circle
                    cx={hx}
                    cy={hy}
                    fill={isSelected ? GROUND.ink : style.line}
                    r={mark.r}
                    stroke={mark.ring ? 'none' : GROUND.whitewash}
                    strokeWidth={1}
                  >
                    <title>{spoken(town.name)}</title>
                  </circle>
                </>
              ) : null}
            </g>
            {label ? (
              <g {...upright(hx, hy)} {...named(projection, 'abroad', town.slug, { box: label, live: label.live })}>
                <text
                  className={label.server ? 'font-display' : 'font-label'}
                  fill={ink}
                  fontSize={label.fontSize}
                  fontStyle={label.server ? 'italic' : undefined}
                  fontWeight={town.capital || isSelected ? 700 : 600}
                  letterSpacing={label.tracking}
                  opacity={isSelected || label.server === 'trading' ? 1 : 0.88}
                  textAnchor="middle"
                  x={label.x + label.width / 2 + label.tracking / 2}
                  y={label.y + label.fontSize + 2}
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
                    opacity={0.85}
                    textAnchor="middle"
                    x={label.x + label.width / 2}
                    y={label.y + label.fontSize + 2 + 12}
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
      {[...labels.nations].map(([slug, label]) => {
        const nation: AbroadNation | undefined = slug ? abroad.nationBySlug.get(slug) : undefined
        const home = !slug
        const style = home ? null : styleOf(nation?.name ?? null)
        const ink = style?.text ?? GROUND.sea800
        // Set across the heartland, it keeps its size about its own middle mid-zoom.
        return (
          <g
            key={slug || 'home'}
            {...upright(label.x + label.width / 2, label.y + label.height / 2)}
            {...named(projection, 'nation', slug || 'home', { box: label, live: label.live })}
          >
            <text
              className={cnHit(hit, 'font-display')}
              fill={ink}
              fontSize={label.fontSize}
              fontWeight={home || selected.nation === slug || style?.voice === 'loud' ? 700 : 500}
              letterSpacing={label.tracking}
              onClick={onSelect && nation ? () => onSelect({ kind: 'nation', slug: nation.slug }) : undefined}
              opacity={
                home
                  ? 1
                  : style?.voice === 'loud'
                    ? 1
                    : label.opacity * (selected.nation && selected.nation !== slug ? 0.7 : 1) * (style?.voice === 'quiet' ? 0.75 : 1)
              }
              style={nation ? cursor : undefined}
              textAnchor="middle"
              x={label.x + label.width / 2 + label.tracking / 2}
              y={label.y + label.fontSize}
              {...halo(GROUND.whitewash, home ? 3.5 : 2.5)}
            >
              {label.text}
            </text>
            {/* Azania's own, underscored in saffron, as the map's home. */}
            {home ? (
              <path
                d={`M${(label.x + label.width * 0.3).toFixed(1)} ${(label.y + label.fontSize + 5).toFixed(1)}h${(label.width * 0.4).toFixed(1)}`}
                stroke={GROUND.saffron}
                strokeLinecap="round"
                strokeWidth={2.5}
              />
            ) : null}
          </g>
        )
      })}
    </g>
  )
}

const cnHit = (...names: (string | undefined)[]) => names.filter(Boolean).join(' ')

/** From here out, Azania's towns glow as discs about their homes; nearer, as a casing about their claims. */
const GLOW_DISCS_BELOW = -4

/**
 * Under Azania's own towns, while the world is drawn around them: a glow of
 * saffron, so the nation reads at once among the others. Far out, where a
 * town is a few pixels, a soft disc about each home, under its lozenge;
 * nearer, a casing about its claims. The live map draws the casing with
 * the ground and the discs over it, under the lozenges, where they keep
 * their size mid-zoom as the lozenges do (leaflet/canvas.tsx → OnTop);
 * `part` says which this one is, and without it, it's whichever the zoom
 * calls for.
 */
export function HomeGlow({
  projection,
  towns,
  part,
}: {
  projection: Projection
  towns: { home: Point | null; bounds: Bounds | null; claims: Outline[] }[]
  part?: 'casing' | 'discs'
}) {
  const { zoom } = projection
  const discs = zoom < GLOW_DISCS_BELOW
  if (part && (part === 'discs') !== discs) return null
  const f = affineOf(projection)
  const shown = towns.filter((town) => town.bounds && boundsTouch(town.bounds, projection.bounds))
  if (discs) {
    const r = zoom <= -6 ? 7 : 6
    const homes = shown.map((town) =>
      at(f, town.home ?? [(town.bounds!.minX + town.bounds!.maxX) / 2, (town.bounds!.minZ + town.bounds!.maxZ) / 2]),
    )
    if (!homes.length) return null
    // A disc apiece, so each keeps its size about its home mid-zoom as the lozenge over it does; the
    // fills washed as one and the rims as one, so where two discs meet they merge, as one path's would.
    return (
      <g className="az-home-glow" pointerEvents="none">
        <g opacity={0.5}>
          {homes.map(([x, y], i) => (
            <circle key={i} {...upright(x, y)} cx={x} cy={y} fill={GROUND.saffronLight} r={r} />
          ))}
        </g>
        <g opacity={0.6}>
          {homes.map(([x, y], i) => (
            <circle key={i} {...upright(x, y)} cx={x} cy={y} fill="none" r={r} stroke={GROUND.saffron} strokeWidth={1} />
          ))}
        </g>
      </g>
    )
  }
  let d = ''
  for (const town of shown) for (const claim of town.claims) d += ringPath(claim, f, 0.75)
  if (!d) return null
  return (
    <path
      className="az-home-glow"
      d={d}
      fill="none"
      pointerEvents="none"
      stroke={GROUND.saffronLight}
      strokeLinejoin="round"
      strokeOpacity={0.5}
      strokeWidth={zoom <= -2 ? 4 : 5}
    />
  )
}

/** Where to look for a town abroad: the claim holding its home, else its home up close. */
export const abroadTownTarget = (town: AbroadTown): { bounds: Bounds } | { centre: Point; zoom: number } | null => {
  const bounds = abroadHomeBounds(town)
  if (bounds) return { bounds }
  return town.home ? { centre: town.home, zoom: 0 } : null
}
