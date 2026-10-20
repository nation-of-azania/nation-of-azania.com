'use client'

import { useRef } from 'react'

import { cn } from '@/blocks/components/shared'
import type { MapData } from '@/maps/data'
import type { MapLayer } from '@/maps/registry'
import { frameBounds } from '@/maps/view'

import { DrawingsLayer } from '../layers/DrawingsLayer'
import { EventsLayer } from '../layers/EventsLayer'
import { PlacesLayer } from '../layers/PlacesLayer'
import { LabelPlacer } from '../layers/projection'
import { RoadsLayer } from '../layers/RoadsLayer'
import { TownLabels, TownsLayer } from '../layers/TownsLayer'
import { fitBounds, MapCanvas, useProjection, type L } from '../leaflet/canvas'
import { MapsMark } from '../Mark'
import type { Frame } from '../still/Still'
import { IconButton } from '../ui/chrome'

import '../maps.css'

export type EmbedSceneProps = {
  frame: Frame
  data: MapData
  now: number
  href: string
  className?: string
  onReady?: () => void
}

/**
 * The live map inside an article: the frame to start from, the nation's
 * layers and the view's highlights, buttons to zoom and to come back to
 * the frame, and the mark that opens Azania Maps here. Everything else
 * — search, panels, editing — stays on /maps, where the mark leads.
 */
export function EmbedScene({ frame, data, now, href, className, onReady }: EmbedSceneProps) {
  const mapRef = useRef<L.Map | null>(null)
  const bounds = frameBounds(frame.centre, frame.span, frame.aspect)
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <div className={cn('az-maps', className)}>
      <MapCanvas
        chrome={
          <>
            <div className="absolute right-2 top-2 z-10 flex flex-col">
              <IconButton
                className="h-8 w-8"
                icon="plus"
                label="Zoom in"
                onClick={() =>
                  mapRef.current?.setZoom(mapRef.current.getZoom() + 0.5, { animate: !reduced() })
                }
              />
              <IconButton
                className="-mt-px h-8 w-8"
                icon="minus"
                label="Zoom out"
                onClick={() =>
                  mapRef.current?.setZoom(mapRef.current.getZoom() - 0.5, { animate: !reduced() })
                }
              />
              <IconButton
                className="mt-1.5 h-8 w-8"
                icon="frame"
                label="Back to the frame"
                onClick={() => mapRef.current && fitBounds(mapRef.current, bounds, 0)}
              />
            </div>
            <MapsMark href={href} />
          </>
        }
        className="absolute inset-0 z-0"
        initial={{ bounds, padding: 0 }}
        mapName={frame.map}
        onReady={(map) => {
          mapRef.current = map
          map.whenReady(() => onReady?.())
        }}
        wheel={false}
      >
        <Layers data={data} frame={frame} now={now} />
      </MapCanvas>
    </div>
  )
}

function Layers({ frame, data, now }: { frame: Frame; data: MapData; now: number }) {
  const projection = useProjection(`embed-${frame.centre.join('-')}`)
  const placer = new LabelPlacer()
  const labelled = new Set<number>()
  const show = (layer: MapLayer) => frame.layers.includes(layer)
  return (
    <>
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
    </>
  )
}
