import { RULES } from '@/maps/battle'
import { GROUND } from '@/maps/palette'
import type { Siege } from '@/maps/world'

import { halo, upright, type Projection } from './projection'

/**
 * A siege's zones about its banner, drawn to scale in the war view: the
 * banner control zone, where staying five minutes takes the banner, a
 * solid coral ring on a wash; and the siege zone round it, where a death
 * costs a side a hundred points and nobody may teleport in, a wide dashed
 * ring on the faintest wash. The rings go with the ground, so they grow
 * and shrink mid-zoom as the claims do; their names stand over them,
 * their size kept, from the zoom where the rings are big enough to carry
 * one. Both radii are SiegeWar's defaults, which the server's rules don't
 * give (ASSUMED in src/maps/battle.ts); the sidebar says so.
 */

/** The rings are drawn from where they'd show at all: the banner's from three pixels across, the zone's from a dozen. */
const BANNER_FROM_PX = 1.5
const ZONE_FROM_PX = 6
/** And named from where the ring is wide enough to read the name along its top. */
const NAMED_FROM_PX = 70
const BANNER_NAMED_FROM_PX = 26

/** Whether a ring of `r` blocks about `at` reaches the page. */
const onPage = (projection: Projection, [x, z]: [number, number], r: number) =>
  x + r >= projection.bounds.minX && x - r <= projection.bounds.maxX && z + r >= projection.bounds.minZ && z - r <= projection.bounds.maxZ

export function BattleZones({
  projection,
  sieges,
  selected,
  part,
}: {
  projection: Projection
  sieges: Siege[]
  /** The siege the sidebar is looking at: its rings drawn stronger. */
  selected: string | null
  /** The rings, with the ground; or their names, over it. */
  part: 'rings' | 'names'
}) {
  const { ppb } = projection
  const zone = RULES.siegeZoneRadius * ppb
  const banner = RULES.bannerRadius * ppb
  if (zone < ZONE_FROM_PX) return null
  const shown = sieges.filter((siege) => onPage(projection, siege.at, RULES.siegeZoneRadius))
  if (!shown.length) return null
  return (
    <g className="az-battle-zones" pointerEvents="none">
      {shown.map((siege) => {
        const [x, y] = projection.project(siege.at)
        const strong = selected === siege.townId
        if (part === 'rings')
          return (
            <g key={siege.townId}>
              <circle
                cx={x}
                cy={y}
                fill={GROUND.coral}
                fillOpacity={strong ? 0.07 : 0.045}
                r={zone}
                stroke={GROUND.coralDeep}
                strokeDasharray="8 6"
                strokeOpacity={strong ? 0.9 : 0.6}
                strokeWidth={strong ? 2 : 1.5}
              />
              {banner >= BANNER_FROM_PX ? (
                <circle
                  cx={x}
                  cy={y}
                  fill={GROUND.coral}
                  fillOpacity={strong ? 0.22 : 0.16}
                  r={banner}
                  stroke={GROUND.coralDeep}
                  strokeOpacity={0.95}
                  strokeWidth={strong ? 2 : 1.5}
                />
              ) : null}
            </g>
          )
        // The names, along each ring's top, kept their size mid-zoom about the point they stand at.
        const name = (r: number, text: string, size: number) => (
          <g {...upright(x, y - r)}>
            <text
              className="font-label"
              fill={GROUND.coralDeep}
              fontSize={size}
              fontWeight={700}
              letterSpacing={1.4}
              textAnchor="middle"
              x={x}
              y={y - r - 5}
              {...halo(GROUND.whitewash, 3)}
            >
              {text}
            </text>
          </g>
        )
        return (
          <g key={siege.townId}>
            {zone >= NAMED_FROM_PX ? name(zone, `SIEGE ZONE · ${RULES.siegeZoneRadius} BLOCKS`, 9.5) : null}
            {banner >= BANNER_NAMED_FROM_PX ? name(banner, `BANNER · ${RULES.bannerRadius}`, 9) : null}
          </g>
        )
      })}
    </g>
  )
}
