import { homeClaimBounds, isSite, spoken, type MapTown } from '@/maps/data'
import { outlineToRing } from '@/maps/geo'
import { GROUND } from '@/maps/palette'
import { siteFacts, siteLine } from '@/maps/sites'

import { boundsTouch, halo, LabelPlacer, pathOf, textWidth, type Projection, type Rect } from './projection'
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
}

type Props = {
  projection: Projection
  towns: MapTown[]
  selected?: number | null
  /** Towns to set apart, in gold: a mayor's own, while they draw. Everything else fades. */
  emphasised?: number[]
  onSelect?: (town: MapTown) => void
}

const far = (zoom: number) => zoom <= -3

/** The zoom from which a town fills the view: its name leaves the home block for the claim's edge. */
const INSIDE = 0.5
/** Closer than this, the reader is plainly in town and the name is left off. */
const TOO_CLOSE = 2
/** From this zoom a site's name carries what it gives and pays beneath it; further out, the name alone. */
const SUB_FROM = -2.5
const SUB_SIZE = 10
const SUB_HEIGHT = 12

/** The label's type at a zoom: size, tracking and how far above the home it sits (clear of a pin there, close in). */
const labelType = (zoom: number) => {
  const fontSize = zoom >= 0 ? 13 : zoom >= -2 ? 12 : 11
  return { fontSize, tracking: fontSize * 0.14, lift: zoom >= -0.5 ? 22 : 14 }
}

/** A site's mark shrinks a little at the scale of the nation, as the pins do. */
const markScale = (zoom: number) => (far(zoom) ? 0.75 : 1)

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

/**
 * Where a town's name may go, best first. Out at the scale of the nation,
 * above its home block (its lozenge), else below, else to either side.
 * Once the reader is inside the town, the name moves to the top edge of
 * the main claim, like a district's name on a street map, and is left off
 * when they are closer still: the panel names the town, and the roads and
 * places want the room. A held site's name keeps clear of its mark, which
 * is bigger than a lozenge, and carries a line beneath it saying what it
 * gives and pays.
 */
function nameCandidates(projection: Projection, town: MapTown): TownLabel[] {
  if (!town.home) return []
  const { zoom } = projection
  const type = labelType(zoom)
  const { fontSize, tracking } = type
  const site = siteFacts(town)
  const sub = site && zoom >= SUB_FROM ? siteLine(site) : null
  const subHeight = sub ? SUB_HEIGHT : 0
  const text = spoken(town.name).toUpperCase()
  const width = Math.max(textWidth(text, fontSize, tracking), sub ? textWidth(sub, SUB_SIZE) : 0) + 8
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
    const [x, y] = projection.project(town.home)
    // Clear of what stands at the home: a site's mark, or a pin (12 px) that may sit on a town's lozenge.
    const r = site ? SITE_R : 12
    const lift = site ? Math.max(type.lift, r + 8) : type.lift
    const beside = r + 4 + width / 2
    return [
      box(x, y - lift - subHeight, 'home', 1),
      box(x, y + lift + fontSize - 2, 'home', 1),
      box(x + beside, y + fontSize / 2 - 2 - subHeight / 2, 'home', 1),
      box(x - beside, y + fontSize / 2 - 2 - subHeight / 2, 'home', 1),
    ]
  }
  if (zoom >= TOO_CLOSE) return []
  const claim = homeClaimBounds(town)
  if (!claim) return []
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
 * Finds each town's name a spot, the biggest towns first; part of the label
 * plan (./labels.ts). The sites' marks take their room before any name is
 * placed, as the pins do, so no name lands on a gem.
 */
export function placeTownNames(
  projection: Projection,
  towns: MapTown[],
  placer: LabelPlacer,
): Map<number, TownLabel> {
  const placed = new Map<number, TownLabel>()
  for (const town of towns) {
    if (!town.home || !isSite(town) || !onPage(projection, town)) continue
    const [x, y] = projection.project(town.home)
    placer.claim(siteMarkRect(x, y, markScale(projection.zoom)))
  }
  for (const town of byWeight(towns)) {
    if (!onPage(projection, town)) continue
    const spot = placer.tryPlace(nameCandidates(projection, town))
    if (spot) placed.set(town.id, spot)
  }
  return placed
}

/**
 * Azania's towns: Towny's claims as a tinted outline in the deep sea of the
 * brand. Far out, the claims thin to a hairline. A held site's claims are
 * drawn in the treasury's gold instead, hatched and with a dashed edge, so
 * they read as ground the nation holds rather than a town it built. The
 * names are drawn by TownLabels, last of all, so a name is never under a
 * road.
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
          <pattern height={6} id={hatch} patternTransform="rotate(45)" patternUnits="userSpaceOnUse" width={6}>
            <line stroke={GROUND.saffronDeep} strokeOpacity={0.55} strokeWidth={1.2} x1={0} x2={0} y1={0} y2={6} />
          </pattern>
        </defs>
      ) : null}
      {visible.map((town) => {
        const isSelected = selected === town.id
        const dimmed = emphasis ? !emphasis.has(town.id) : false
        const highlighted = emphasis ? emphasis.has(town.id) : false
        const site = isSite(town)
        const d = town.claims
          .map((claim) => pathOf(projection, outlineToRing(claim), true))
          .join('')
        return (
          <g
            key={town.id}
            className={interactive ? 'az-hit' : undefined}
            data-town={town.id}
            onClick={onSelect ? () => onSelect(town) : undefined}
            opacity={dimmed ? 0.35 : 1}
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            {site ? (
              <>
                {/* A wash under the hatching, deeper once the site is open in the panel. */}
                <path d={d} fill={GROUND.saffron} fillOpacity={isSelected ? 0.16 : 0.06} stroke="none" />
                <path
                  d={d}
                  fill={`url(#${hatch})`}
                  stroke={GROUND.saffronDeep}
                  strokeDasharray={far(zoom) ? '3 2' : '5 3'}
                  strokeLinejoin="round"
                  strokeOpacity={isSelected ? 1 : 0.85}
                  strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
                />
              </>
            ) : (
              <path
                d={d}
                fill={highlighted ? GROUND.saffron : GROUND.sea700}
                fillOpacity={isSelected ? 0.2 : highlighted ? 0.16 : 0.09}
                stroke={highlighted ? GROUND.saffronDeep : GROUND.sea700}
                strokeLinejoin="round"
                strokeOpacity={isSelected || highlighted ? 1 : 0.8}
                strokeWidth={isSelected || highlighted ? strokeWidth + 1 : strokeWidth}
              />
            )}
          </g>
        )
      })}
    </g>
  )
}

/**
 * The towns' names in small capitals, haloed in whitewash: at their home
 * blocks, with a lozenge for the home itself, or along the claim's edge
 * once the reader is inside. A held site wears its mark instead of the
 * lozenge, its name in the treasury's gold ink, and beneath it what it
 * gives and pays. Drawn after every other layer, where the plan found
 * room. The lozenge and the mark show the home at every zoom.
 */
export function TownLabels({
  projection,
  towns,
  labels,
  selected,
  onSelect,
}: {
  projection: Projection
  towns: MapTown[]
  labels: Map<number, TownLabel>
  selected?: number | null
  onSelect?: (town: MapTown) => void
}) {
  const interactive = Boolean(onSelect)
  const scale = markScale(projection.zoom)
  return (
    <g className="az-town-names">
      {byWeight(towns).map((town) => {
        if (!town.home || !onPage(projection, town)) return null
        const label = labels.get(town.id)
        const [hx, hy] = projection.project(town.home)
        const isSelected = selected === town.id
        const site = siteFacts(town)
        const ink = site ? GROUND.saffronDeep : isSelected ? GROUND.saffronDeep : GROUND.sea800
        return (
          <g
            key={town.id}
            className={interactive ? 'az-hit' : undefined}
            onClick={onSelect ? () => onSelect(town) : undefined}
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            {site ? (
              <SiteMark facts={site} scale={scale} selected={isSelected} x={hx} y={hy}>
                <title>{spoken(town.name)}</title>
              </SiteMark>
            ) : (
              <path
                d={`M${hx} ${hy - 5}L${hx + 5} ${hy}L${hx} ${hy + 5}L${hx - 5} ${hy}Z`}
                fill={isSelected ? GROUND.saffron : GROUND.sea800}
                stroke={GROUND.whitewash}
                strokeWidth={1.5}
              >
                <title>{spoken(town.name)}</title>
              </path>
            )}
            {label ? (
              <>
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
              </>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
