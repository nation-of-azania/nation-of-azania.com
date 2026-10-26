import type { MapPlace } from '@/maps/data'
import { PlaceGlyph } from '@/maps/icons'
import { GROUND, GROUP_COLOURS } from '@/maps/palette'
import { PLACE_CATEGORIES } from '@/maps/registry'

import {
  halo,
  inBounds,
  kept,
  labelBeside,
  LabelPlacer,
  LIVE_CLOSE_IN,
  liveOf,
  livePlan,
  named,
  pathOf,
  textWidth,
  upright,
  type Live,
  type Projection,
  type Rect,
} from './projection'

type Props = {
  projection: Projection
  places: MapPlace[]
  /** Where the plan put each place's name (./labels.ts); none without it. */
  labels?: Map<number, PlaceName>
  selected?: number | null
  onSelect?: (place: MapPlace) => void
}

/** Pixels across a cluster's cell: places closer than this merge from afar. */
const CELL = 56

/** The pin's disc: a 14 px glyph in a 24 px disc. */
const PIN = 12

/** Names show from this zoom. */
const NAMED_FROM = 0.5

export const placeColour = (place: Pick<MapPlace, 'category'>) =>
  GROUP_COLOURS[PLACE_CATEGORIES[place.category]?.group ?? 'other']

/** A pin as it will be drawn: the place (the one that stands for a cluster), where, and how big. */
export type PlacedPin = {
  place: MapPlace
  x: number
  y: number
  scale: number
  /** Every place in the pin: more than one from afar, where they merge. */
  group: MapPlace[]
}

/** A place's name, placed: the text's anchor and position, the box it takes, and how it may move mid-gesture on the live map's own canvas. */
export type PlaceName = { anchor: 'start' | 'middle' | 'end'; tx: number; ty: number; box: Rect; live?: Live }

/**
 * Where the pins go at this zoom, before anything is drawn: from afar,
 * counted into clusters so a busy town reads as "12" rather than a smear;
 * nearer, each place its own pin. Null when too far out for any. Shared
 * by the drawing and by the label plan (./labels.ts), so names never land
 * on a pin.
 */
export function placePins(
  projection: Projection,
  places: MapPlace[],
  selected: number | null = null,
): { clustered: boolean; items: PlacedPin[] } | null {
  const { zoom, bounds } = projection
  if (zoom < -3.5) return null
  const visible = places.filter((place) => inBounds(bounds, place.point))

  if (zoom < -1.5) {
    const cells = new Map<string, MapPlace[]>()
    for (const place of visible) {
      const [x, y] = projection.project(place.point)
      const key = `${Math.floor(x / CELL)}:${Math.floor(y / CELL)}`
      cells.set(key, [...(cells.get(key) ?? []), place])
    }
    return {
      clustered: true,
      items: [...cells.values()].map((group) => {
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
        return { place: chosen, x, y, scale: group.length === 1 ? 0.6 : 1, group }
      }),
    }
  }

  const scale = zoom < -0.5 ? 0.8 : 1
  // The selected place first, so its name is placed before the rest.
  const ordered = [...visible].sort((a, b) => Number(b.id === selected) - Number(a.id === selected))
  return {
    clustered: false,
    items: ordered.map((place) => {
      const [x, y] = projection.project(place.point)
      return { place, x, y, scale: place.id === selected ? scale * 1.2 : scale, group: [place] }
    }),
  }
}

/** The box a pin takes, which no label may cover. */
export const pinRect = ({ x, y, scale }: PlacedPin): Rect => {
  const r = PIN * scale + 1
  return { x: x - r, y: y - r, width: r * 2, height: r * 2 }
}

/**
 * Finds each place's name a spot beside its pin — to the right, else the
 * left, below or above — close in; part of the label plan (./labels.ts).
 * The selected place keeps its name whatever the crowd.
 */
export function placePlaceNames(
  projection: Projection,
  pins: PlacedPin[],
  placer: LabelPlacer,
  selected: number | null = null,
): Map<number, PlaceName> {
  const placed = new Map<number, PlaceName>()
  if (projection.zoom < NAMED_FROM) return placed
  const live = livePlan(projection) && LIVE_CLOSE_IN
  const fontSize = 12
  for (const { place, x, y, scale } of pins) {
    const width = textWidth(place.name, fontSize)
    const candidates = (['right', 'left', 'below', 'above'] as const).map((side) =>
      labelBeside(x, y, width, fontSize, side, PIN * scale + 4),
    )
    const rank = placer.rank()
    const chosen = place.id === selected
    const spot = placer.tryPlace(candidates) ?? (chosen ? candidates[0] : null)
    if (!spot) continue
    const box = { x: spot.x, y: spot.y, width: spot.width, height: spot.height }
    // Azania's own (class 1); the chosen place's name is kept whatever the crowd.
    const facts = live ? liveOf(candidates, candidates.indexOf(spot), rank, [NAMED_FROM, 99], chosen ? 0 : 1, { force: chosen || undefined }) : undefined
    placed.set(place.id, { anchor: spot.anchor, tx: spot.tx, ty: spot.ty, box, live: facts })
  }
  return placed
}

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
 * Places: from afar, clusters with a count; nearer, each a pin with its
 * glyph; close in, the names beside the pins where the plan found room,
 * and a building's outline drawn under it. A pin without a name shows it
 * on hover.
 */
export function PlacesLayer({ projection, places, labels, selected, onSelect }: Props) {
  const { zoom } = projection
  const interactive = Boolean(onSelect)
  const pins = placePins(projection, places, selected)
  if (!pins) return null
  const fontSize = 12

  if (pins.clustered) {
    return (
      <g className="az-places">
        {pins.items.map((pin) =>
          pin.group.length === 1 ? (
            <g
              key={pin.place.id}
              className={interactive ? 'az-hit' : undefined}
              onClick={onSelect ? () => onSelect(pin.place) : undefined}
              style={interactive ? { cursor: 'pointer' } : undefined}
            >
              <title>{pin.place.name}</title>
              <g {...upright(pin.x, pin.y)} {...kept(projection, pinRect(pin))}>
                <PlacePin place={pin.place} scale={pin.scale} selected={selected === pin.place.id} x={pin.x} y={pin.y} />
              </g>
            </g>
          ) : (
            <g
              key={`cluster-${pin.place.id}`}
              className={interactive ? 'az-hit' : undefined}
              onClick={onSelect ? () => onSelect(pin.place) : undefined}
              style={interactive ? { cursor: 'pointer' } : undefined}
            >
              <title>{pin.group.map((member) => member.name).join(', ')}</title>
              <g {...upright(pin.x, pin.y)} {...kept(projection, pinRect(pin))}>
                <g transform={`translate(${pin.x} ${pin.y})`}>
                  <circle fill={GROUND.sea800} r={12} stroke={GROUND.whitewash} strokeWidth={2} />
                  <text
                    className="font-label"
                    dy={4}
                    fill={GROUND.whitewash}
                    fontSize={11}
                    fontWeight={700}
                    textAnchor="middle"
                  >
                    {pin.group.length}
                  </text>
                </g>
              </g>
            </g>
          ),
        )}
      </g>
    )
  }

  const outlined = zoom >= 1

  return (
    <g className="az-places">
      {outlined
        ? pins.items.map(({ place }) =>
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
      {pins.items.map((pin) => {
        const { place, x, y, scale } = pin
        const isSelected = selected === place.id
        const name = labels?.get(place.id) ?? null
        return (
          <g
            key={place.id}
            className={interactive ? 'az-hit az-place' : 'az-place'}
            data-labelled={name ? '' : undefined}
            onClick={onSelect ? () => onSelect(place) : undefined}
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            {!name ? <title>{place.name}</title> : null}
            <g {...upright(x, y)} {...kept(projection, pinRect(pin))}>
              <PlacePin place={place} scale={scale} selected={isSelected} x={x} y={y} />
              {/* Keyed apart, so a name the plan places is mounted afresh and one it drops is let go of. */}
              <text
                key={name ? 'named' : 'unnamed'}
                className="font-body az-place-label"
                dy={fontSize * 0.36}
                fill={GROUND.ink}
                fontSize={fontSize}
                fontWeight={600}
                opacity={name ? 1 : 0}
                textAnchor={name?.anchor ?? 'start'}
                x={name?.tx ?? x + PIN * scale + 6}
                y={name?.ty ?? y}
                {...(name ? named(projection, 'place', place.id, { box: name.box, live: name.live }) : null)}
                {...halo(GROUND.whitewash, 3)}
              >
                {place.name}
              </text>
            </g>
          </g>
        )
      })}
    </g>
  )
}
