import type { ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import { MapClip } from '@/blocks/components/Map/Client'
import type { MapData } from '@/maps/data'
import type { Bounds, Point } from '@/maps/geo'
import { zoomForPixelsPerBlock } from '@/maps/palette'
import { VIEW_ASPECTS, type Drawing, type MapLayer, type ViewAspect } from '@/maps/registry'
import type { MapName } from '@/maps/source'
import { frameBounds } from '@/maps/view'

import { DrawingsLayer } from '../layers/DrawingsLayer'
import { EventsLayer } from '../layers/EventsLayer'
import { PlacesLayer } from '../layers/PlacesLayer'
import { LabelPlacer, type Projection } from '../layers/projection'
import { RoadsLayer } from '../layers/RoadsLayer'
import { TownLabels, TownsLayer } from '../layers/TownsLayer'

/** A framed piece of the map, as the Map block shows it and a map view stores it. */
export type Frame = {
  centre: Point
  span: number
  aspect: ViewAspect
  map: MapName
  layers: MapLayer[]
  drawings: Drawing[]
  /** A town to set apart, with its claims tinted stronger. */
  town?: number | null
}

/** The clipping's own picture: /mapclip, which stitches the tiles on the server and is cached at the CDN. */
export const clipUrl = (frame: Frame): string => {
  const query = new URLSearchParams({
    x: String(Math.round(frame.centre[0])),
    z: String(Math.round(frame.centre[1])),
    span: String(Math.round(frame.span)),
    aspect: frame.aspect,
    map: frame.map,
  })
  return `/mapclip?${query}`
}

/** The frame projected onto a picture `widthPx` wide: blocks to pixels, from the frame's north-west corner. */
export function frameProjection(frame: Frame, widthPx: number, id: string): Projection {
  const ppb = widthPx / frame.span
  const bounds = frameBounds(frame.centre, frame.span, frame.aspect)
  const pad = (b: Bounds, by: number): Bounds => {
    const dx = (b.maxX - b.minX) * by
    const dz = (b.maxZ - b.minZ) * by
    return { minX: b.minX - dx, maxX: b.maxX + dx, minZ: b.minZ - dz, maxZ: b.maxZ + dz }
  }
  return {
    project: ([x, z]) => [(x - bounds.minX) * ppb, (z - bounds.minZ) * ppb],
    ppb,
    zoom: zoomForPixelsPerBlock(ppb),
    bounds: pad(bounds, 0.25),
    id,
  }
}

/** The nation's layers over a frame, as one SVG `widthPx` wide. */
export function FrameLayers({
  frame,
  data,
  now,
  widthPx,
  id,
  className,
}: {
  frame: Frame
  data: MapData
  now: number
  widthPx: number
  id: string
  className?: string
}) {
  const projection = frameProjection(frame, widthPx, id)
  const heightPx = widthPx / VIEW_ASPECTS[frame.aspect].ratio
  const placer = new LabelPlacer()
  const labelled = new Set<number>()
  const show = (layer: MapLayer) => frame.layers.includes(layer)
  return (
    <svg
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      viewBox={`0 0 ${widthPx} ${heightPx.toFixed(1)}`}
    >
      {show('towns') ? (
        <TownsLayer
          labelled={labelled}
          placer={placer}
          projection={projection}
          selected={frame.town ?? null}
          towns={data.towns}
        />
      ) : null}
      {show('roads') ? (
        <RoadsLayer placer={placer} projection={projection} roads={data.roads} />
      ) : null}
      {show('events') ? (
        <EventsLayer events={data.events} now={now} placer={placer} projection={projection} />
      ) : null}
      {show('places') ? (
        <PlacesLayer placer={placer} places={data.places} projection={projection} />
      ) : null}
      {show('towns') ? (
        <TownLabels
          labelled={labelled}
          projection={projection}
          selected={frame.town ?? null}
          towns={data.towns}
        />
      ) : null}
      {frame.drawings.length ? (
        <DrawingsLayer drawings={frame.drawings} projection={projection} />
      ) : null}
    </svg>
  )
}

/**
 * A frame as a still picture, fast and without a map library: the clipping
 * from /mapclip under the nation's layers and the view's highlights, drawn
 * as SVG by the same components as the live map. The overlay is drawn twice,
 * once for a wide column and once for a phone's, so labels and pins keep a
 * readable size however the picture is scaled. When the clipping can't be
 * drawn (the Rulercraft map is down and nothing is cached), the layers
 * still show over a plain ground, with a line saying why.
 */
export function MapStill({
  frame,
  data,
  now,
  alt,
  note,
  className,
  children,
}: {
  frame: Frame
  data: MapData
  now: number
  alt: string
  /** Shown over the backdrop when the clipping can't be drawn. */
  note: string
  className?: string
  /** Anything to lay over the picture: the mark. */
  children?: ReactNode
}) {
  const ratio = VIEW_ASPECTS[frame.aspect].ratio
  return (
    <div
      className={cn('relative w-full overflow-hidden bg-sea-900', className)}
      style={{ aspectRatio: `${ratio}` }}
    >
      <MapClip
        alt={alt}
        className="absolute inset-0 block h-full w-full"
        fallback={
          <p className="absolute left-2 top-2 z-10 max-w-xs border border-saffron-400/60 bg-saffron-100/95 px-2.5 py-1.5 text-[11px] leading-snug text-saffron-600">
            {note}
          </p>
        }
        height={Math.round(1200 / ratio)}
        src={clipUrl(frame)}
        width={1200}
      />
      <FrameLayers
        className="hidden sm:block"
        data={data}
        frame={frame}
        id={`${frame.map}-${frame.centre.join('-')}-wide`}
        now={now}
        widthPx={720}
      />
      <FrameLayers
        className="sm:hidden"
        data={data}
        frame={frame}
        id={`${frame.map}-${frame.centre.join('-')}-narrow`}
        now={now}
        widthPx={360}
      />
      {children}
    </div>
  )
}
