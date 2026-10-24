import { spoken } from '@/maps/data'
import type { Outline, Point } from '@/maps/geo'
import { GROUND } from '@/maps/palette'
import { siegeTitle, type SiegeSide } from '@/maps/sieges'
import type { Siege } from '@/maps/world'

import {
  halo,
  inBounds,
  LabelPlacer,
  named,
  pathOf,
  textWidth,
  upright,
  type Projection,
  type Rect,
} from './projection'

/**
 * The sieges on the server, as SiegeWar marks them: always drawn when there
 * are any, whatever layers are on, since a siege is news. A mark stands
 * at the siege banner — crossed swords on the seal's coral while a battle
 * is fought there, breathing; a small fire on whitewash while it's quiet —
 * named "Siege: attacker vs defender", and tied to the town besieged: its
 * claims edged in coral with a dashed line, and a thread from the banner
 * to its home. A siege Azania is in is unmissable: a larger mark in a
 * saffron ring, the town's claims glowing, its name placed before
 * Azania's own towns' and kept at every zoom. A click opens its card.
 */

/** A siege as the map draws it: the siege, Azania's side in it, and its town's claims and home when known. */
export type SiegeOnMap = { siege: Siege; side: SiegeSide; town: { claims: Outline[]; home: Point | null } | null }

/** A mark placed: the siege, and where and how big. */
export type SiegeMark = SiegeOnMap & { x: number; y: number; scale: number }

/** A siege's name, placed: its box, the title and the line beneath. */
export type SiegeName = Rect & { title: string; sub: string | null }

const R = 11
/** Others' sieges are named from here in; Azania's at every zoom. */
const NAMED_FROM = -5
/** The line beneath a name, from here in. */
const SUB_FROM = -3.5

/** Crossed swords and a flame, on the 24 grid of the place icons. */
const SWORDS = 'M5 5l11 11M14 18l4-4M16 16l3 3M19 5L8 16M6 14l4 4M8 16l-3 3'
const FLAME = 'M12 3c.6 2.8 4.8 5 4.8 9.6a4.8 4.8 0 0 1-9.6 0c0-1.9 1-3.1 2-4 .1 1.7.9 2.8 2 3 .3-3-1.4-5.2.8-8.6z'

const scaleOf = (zoom: number, side: SiegeSide) => (zoom <= -5 ? 0.75 : zoom <= -2.5 ? 0.9 : 1) * (side ? 1.2 : 1)

/**
 * Where the marks go at this zoom: every siege whose banner or town is on
 * the page (a town besieged is marked even when its banner is off the
 * edge), Azania's last, so they're drawn on top.
 */
export function siegeMarks(projection: Projection, sieges: SiegeOnMap[]): SiegeMark[] {
  return sieges
    .filter(({ siege, town }) => inBounds(projection.bounds, siege.at) || (town?.home && inBounds(projection.bounds, town.home)))
    .map((entry) => {
      const [x, y] = projection.project(entry.siege.at)
      return { ...entry, x, y, scale: scaleOf(projection.zoom, entry.side) }
    })
    .sort((a, b) => Number(Boolean(a.side)) - Number(Boolean(b.side)))
}

/** The box a mark takes, with its ring, which no name may cover. */
export const siegeMarkRect = ({ x, y, scale, side }: SiegeMark): Rect => {
  const r = R * scale + (side ? 6 : 3)
  return { x: x - r, y: y - r, width: r * 2, height: r * 2 }
}

/** What a siege's name says beneath its title: the town, and how far along. */
const subOf = (siege: Siege) =>
  [siege.town ? spoken(siege.town) : null, siege.progress ? `${siege.progress.done} of ${siege.progress.of} fought` : null]
    .filter(Boolean)
    .join(' · ') || null

/**
 * Finds each siege's name a spot beside its mark; part of the label plan
 * (./labels.ts). `ours` places Azania's sieges, which go before Azania's
 * own towns' names and are kept even when there's no free room; the
 * others are placed after the nation's names, and only where there is.
 */
export function placeSiegeNames(
  projection: Projection,
  marks: SiegeMark[],
  placer: LabelPlacer,
  ours: boolean,
): Map<string, SiegeName> {
  const placed = new Map<string, SiegeName>()
  const { zoom } = projection
  if (!ours && zoom < NAMED_FROM) return placed
  for (const mark of marks) {
    if (Boolean(mark.side) !== ours) continue
    const title = siegeTitle(mark.siege)
    const sub = zoom >= SUB_FROM || ours ? subOf(mark.siege) : null
    const fontSize = ours ? 12.5 : 11.5
    const width = Math.max(textWidth(title, fontSize), sub ? textWidth(sub, 10.5) : 0) + 8
    const height = fontSize + 6 + (sub ? 13 : 0)
    const gap = R * mark.scale + (mark.side ? 8 : 5)
    const box = (x: number, y: number): SiegeName => ({ x, y, width, height, title, sub })
    const candidates = [
      box(mark.x + gap, mark.y - height / 2),
      box(mark.x - gap - width, mark.y - height / 2),
      box(mark.x - width / 2, mark.y + gap),
      box(mark.x - width / 2, mark.y - gap - height),
    ]
    const spot = placer.tryPlace(candidates) ?? (ours ? candidates[0] : null)
    if (spot) placed.set(mark.siege.townId, spot)
  }
  return placed
}

/**
 * A siege's mark: crossed swords on coral for a battle, breathing on the
 * map; a fire on whitewash while it's quiet; Azania's ringed in saffron.
 * Off the map (a badge in a panel, the alert, the legend) it keeps still:
 * an SVG that breathes is painted again every frame, and only the map's
 * one mark needs to.
 */
export function SiegeMarkGlyph({
  battle,
  side,
  x,
  y,
  scale = 1,
  selected = false,
  breathe = true,
}: {
  battle: boolean
  side: SiegeSide
  x: number
  y: number
  scale?: number
  selected?: boolean
  breathe?: boolean
}) {
  const r = R * scale
  return (
    <g transform={`translate(${x} ${y})`}>
      {battle ? (
        <circle
          className={breathe ? 'az-pulse' : undefined}
          fill="none"
          r={r + 3}
          stroke={GROUND.coral}
          strokeOpacity={breathe ? 1 : 0.55}
          strokeWidth={2.5}
        />
      ) : null}
      {side ? (
        <circle fill="none" r={r + 4.5} stroke={GROUND.saffron} strokeWidth={3} />
      ) : null}
      {selected ? <circle fill="none" r={r + (side ? 8 : 5)} stroke={GROUND.ink} strokeOpacity={0.6} strokeWidth={1.5} /> : null}
      <circle
        fill={battle ? GROUND.coralDeep : GROUND.whitewash}
        r={r}
        stroke={battle ? GROUND.whitewash : GROUND.coralDeep}
        strokeWidth={2}
      />
      <g transform={`translate(${-7 * scale} ${-7 * scale}) scale(${(14 / 24) * scale})`}>
        {battle ? (
          <path d={SWORDS} fill="none" stroke={GROUND.whitewash} strokeLinecap="round" strokeWidth={2.6} />
        ) : (
          <path d={FLAME} fill={GROUND.coral} stroke={GROUND.saffronLight} strokeLinejoin="round" strokeWidth={1.4} />
        )}
      </g>
    </g>
  )
}

/**
 * The sieges on one projection: the besieged towns' claims and the threads
 * to them under the marks, the names beside them. Over every other layer.
 */
export function SiegesLayer({
  projection,
  marks,
  labels,
  selected,
  onOpen,
}: {
  projection: Projection
  marks: SiegeMark[]
  labels: Map<string, SiegeName>
  selected?: string | null
  onOpen?: (siege: Siege) => void
}) {
  if (marks.length === 0) return null
  const interactive = Boolean(onOpen)
  return (
    <g className="az-sieges">
      {/* The towns besieged: edged in coral, Azania's own glowing, and a thread from the banner to the home. */}
      {marks.map(({ siege, side, town, x, y }) => {
        if (!town) return null
        const d = town.claims.map((claim) => pathOf(projection, claim.x.map((cx, i) => [cx, claim.z[i]] as Point), true)).join('')
        const home = town.home ? projection.project(town.home) : null
        const far = home ? Math.hypot(home[0] - x, home[1] - y) > 14 : false
        return (
          <g key={`town-${siege.townId}`} pointerEvents="none">
            {side === 'defending' ? (
              <path d={d} fill="none" stroke={GROUND.coral} strokeLinejoin="round" strokeOpacity={0.35} strokeWidth={7} />
            ) : null}
            <path
              d={d}
              fill={GROUND.coral}
              fillOpacity={side ? 0.16 : 0.1}
              stroke={GROUND.coralDeep}
              strokeDasharray="6 3"
              strokeLinejoin="round"
              strokeWidth={side ? 2 : 1.5}
            />
            {far && home ? (
              <path
                d={`M${x.toFixed(1)} ${y.toFixed(1)}L${home[0].toFixed(1)} ${home[1].toFixed(1)}`}
                stroke={GROUND.coralDeep}
                strokeDasharray="2 3"
                strokeLinecap="round"
                strokeWidth={1.5}
              />
            ) : null}
          </g>
        )
      })}
      {marks.map(({ siege, side, x, y, scale }) => {
        const name = labels.get(siege.townId)
        return (
          <g
            className={interactive ? 'az-hit' : undefined}
            key={siege.townId}
            // A mark's click is its own, as a player's head's is: the map's own click, which closes cards, never sees it.
            onClick={
              onOpen
                ? (event) => {
                    event.stopPropagation()
                    onOpen(siege)
                  }
                : undefined
            }
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            <title>{siegeTitle(siege)}</title>
            <g {...upright(x, y)}>
              <SiegeMarkGlyph battle={siege.battle} scale={scale} selected={selected === siege.townId} side={side} x={x} y={y} />
            </g>
            {name ? (
              <g {...upright(x, y)} {...named(projection, 'siege', siege.townId)}>
                <text
                  className="font-body"
                  fill={GROUND.coralDeep}
                  fontSize={side ? 12.5 : 11.5}
                  fontWeight={700}
                  x={name.x + 4}
                  y={name.y + (side ? 12.5 : 11.5) + 2}
                  {...halo(GROUND.whitewash, 3.5)}
                >
                  {name.title}
                </text>
                {name.sub ? (
                  <text
                    className="font-body"
                    fill={GROUND.inkSoft}
                    fontSize={10.5}
                    fontWeight={600}
                    x={name.x + 4}
                    y={name.y + (side ? 12.5 : 11.5) + 2 + 13}
                    {...halo(GROUND.whitewash, 3)}
                  >
                    {name.sub}
                  </text>
                ) : null}
              </g>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
