import type { MapPlace } from '@/maps/data'
import { PlaceGlyph } from '@/maps/icons'
import { GROUND, GROUP_COLOURS } from '@/maps/palette'
import { PLACE_CATEGORIES } from '@/maps/registry'

import { halo, inBounds, LabelPlacer, pathOf, textWidth, type Projection } from './projection'

type Props = {
  projection: Projection
  places: MapPlace[]
  placer: LabelPlacer
  selected?: number | null
  onSelect?: (place: MapPlace) => void
  labels?: boolean
}

/** Pixels across a cluster's cell: places closer than this merge from afar. */
const CELL = 56

/** The pin's disc: a 14 px glyph in a 24 px disc. */
const PIN = 12

export const placeColour = (place: Pick<MapPlace, 'category'>) =>
  GROUP_COLOURS[PLACE_CATEGORIES[place.category]?.group ?? 'other']

/**
 * A place's pin: a disc in its group's colour with the category's glyph in
 * whitewash, ringed in whitewash so it stands off the ground. Exported for
 * the legend and the search list, which draw the same pin small.
 */
export function PlacePin({
  place,
  x,
  y,
  scale = 1,
  selected = false,
}: {
  place: Pick<MapPlace, 'category'>
  x: number
  y: number
  scale?: number
  selected?: boolean
}) {
  const r = PIN * scale
  return (
    <g transform={`translate(${x} ${y})`}>
      {selected ? <circle fill="none" r={r + 4} stroke={GROUND.saffron} strokeWidth={3} /> : null}
      <circle fill={placeColour(place)} r={r} stroke={GROUND.whitewash} strokeWidth={1.5 * scale} />
      <g
        color={GROUND.whitewash}
        transform={`translate(${-7 * scale} ${-7 * scale}) scale(${(14 / 24) * scale})`}
      >
        <PlaceGlyph category={place.category} />
      </g>
    </g>
  )
}

/**
 * Places: from afar, counted into clusters so a busy town reads as "12"
 * rather than a smear; nearer, each a pin with its glyph; close in, the
 * names appear beside the pins where they fit, and a building's outline is
 * drawn under it.
 */
export function PlacesLayer({
  projection,
  places,
  placer,
  selected,
  onSelect,
  labels = true,
}: Props) {
  const { zoom, bounds } = projection
  const interactive = Boolean(onSelect)
  if (zoom < -3.5) return null
  const visible = places.filter((place) => inBounds(bounds, place.point))
  const fontSize = 12

  // Far out: clusters, except the selected place, which always shows.
  if (zoom < -1.5) {
    const cells = new Map<string, MapPlace[]>()
    for (const place of visible) {
      const [x, y] = projection.project(place.point)
      const key = `${Math.floor(x / CELL)}:${Math.floor(y / CELL)}`
      cells.set(key, [...(cells.get(key) ?? []), place])
    }
    return (
      <g className="az-places">
        {[...cells.values()].map((group) => {
          const chosen = group.find((place) => place.id === selected) ?? group[0]
          const [x, y] = group
            .reduce(
              ([sx, sy], place) => {
                const [px, py] = projection.project(place.point)
                return [sx + px, sy + py]
              },
              [0, 0],
            )
            .map((sum) => sum / group.length)
          if (group.length === 1) {
            return (
              <g
                key={chosen.id}
                className={interactive ? 'az-hit' : undefined}
                onClick={onSelect ? () => onSelect(chosen) : undefined}
                style={interactive ? { cursor: 'pointer' } : undefined}
              >
                <title>{chosen.name}</title>
                <PlacePin
                  place={chosen}
                  scale={0.6}
                  selected={selected === chosen.id}
                  x={x}
                  y={y}
                />
              </g>
            )
          }
          return (
            <g
              key={`cluster-${chosen.id}`}
              className={interactive ? 'az-hit' : undefined}
              onClick={onSelect ? () => onSelect(chosen) : undefined}
              style={interactive ? { cursor: 'pointer' } : undefined}
              transform={`translate(${x} ${y})`}
            >
              <title>{group.map((place) => place.name).join(', ')}</title>
              <circle fill={GROUND.sea800} r={12} stroke={GROUND.whitewash} strokeWidth={2} />
              <text
                className="font-label"
                dy={4}
                fill={GROUND.whitewash}
                fontSize={11}
                fontWeight={700}
                textAnchor="middle"
              >
                {group.length}
              </text>
            </g>
          )
        })}
      </g>
    )
  }

  const scale = zoom < -0.5 ? 0.8 : 1
  const named = labels && zoom >= 0.5
  const outlined = zoom >= 1
  // The selected place labels first, then the rest in order.
  const ordered = [...visible].sort((a, b) => Number(b.id === selected) - Number(a.id === selected))

  return (
    <g className="az-places">
      {outlined
        ? ordered.map((place) =>
            place.outline ? (
              <path
                key={`outline-${place.id}`}
                d={pathOf(projection, place.outline, true)}
                fill={placeColour(place)}
                fillOpacity={0.14}
                stroke={placeColour(place)}
                strokeLinejoin="round"
                strokeOpacity={0.9}
                strokeWidth={selected === place.id ? 2 : 1.25}
              />
            ) : null,
          )
        : null}
      {ordered.map((place) => {
        const [x, y] = projection.project(place.point)
        const isSelected = selected === place.id
        const width = textWidth(place.name, fontSize)
        const labelRect = {
          x: x + PIN * scale + 4,
          y: y - fontSize / 2 - 3,
          width: width + 6,
          height: fontSize + 6,
        }
        const pinRect = {
          x: x - PIN * scale,
          y: y - PIN * scale,
          width: PIN * scale * 2,
          height: PIN * scale * 2,
        }
        placer.claim(pinRect)
        const showLabel = named && (isSelected || placer.tryClaim(labelRect))
        return (
          <g
            key={place.id}
            className={interactive ? 'az-hit az-place' : 'az-place'}
            data-labelled={showLabel ? '' : undefined}
            onClick={onSelect ? () => onSelect(place) : undefined}
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            {!showLabel ? <title>{place.name}</title> : null}
            <PlacePin
              place={place}
              scale={isSelected ? scale * 1.2 : scale}
              selected={isSelected}
              x={x}
              y={y}
            />
            <text
              className="font-body az-place-label"
              dy={fontSize * 0.36}
              fill={GROUND.ink}
              fontSize={fontSize}
              fontWeight={600}
              opacity={showLabel ? 1 : 0}
              x={x + PIN * scale + 6}
              y={y}
              {...halo(GROUND.whitewash, 3)}
            >
              {place.name}
            </text>
          </g>
        )
      })}
    </g>
  )
}
