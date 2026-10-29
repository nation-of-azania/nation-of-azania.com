'use client'

import { useRef } from 'react'

import { cn } from '@/blocks/components/shared'
import type { MapData } from '@/maps/data'
import type { MapLayer } from '@/maps/registry'
import { frameBounds } from '@/maps/view'

import { DrawingsLayer } from '../layers/DrawingsLayer'
import { EventsLayer } from '../layers/EventsLayer'
import { planLabels } from '../layers/labels'
import { PlacesLayer } from '../layers/PlacesLayer'
import { RoadsLayer } from '../layers/RoadsLayer'
import { SubjectLayer, type Subject } from '../layers/SubjectLayer'
import { TownLabels, TownsLayer } from '../layers/TownsLayer'
import { fitBounds, MapCanvas, OnTop, useProjection, type L } from '../leaflet/canvas'
import { MapsMark } from '../Mark'
import type { Frame } from '../still/Still'
import { IconButton } from '../ui/chrome'

import '../maps.css'

export type EmbedSceneProps = {
  frame: Frame
  data: MapData
  now: number
  href: string
  /** What the still drew of its own, kept on the live map: a town block's claims and pin (../layers/SubjectLayer.tsx). */
  subject?: Subject | null
  className?: string
  onReady?: () => void
}

/**
 * The live map inside an article: the frame to start from, the nation's
 * layers and the view's highlights, buttons to zoom and to come back to
 * the frame, and the mark that opens Azania Maps here. Everything else
 * — search, panels, editing — stays on /maps, where the mark leads.
 */
export function EmbedScene({ frame, data, now, href, subject, className, onReady }: EmbedSceneProps) {
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
        onReady={(map) => {
          mapRef.current = map
          map.whenReady(() => onReady?.())
        }}
        wheel={false}
      >
        <Layers data={data} frame={frame} now={now} subject={subject ?? null} />
      </MapCanvas>
    </div>
  )
}

function Layers({ frame, data, now, subject }: { frame: Frame; data: MapData; now: number; subject: Subject | null }) {
  const projection = useProjection(`embed-${frame.centre.join('-')}`)
  const show = (layer: MapLayer) => frame.layers.includes(layer)
  // The subject's claims come outlined in the paper's ink, over the towns' tint: an Azanian subject isn't tinted stronger as well.
  const selected = subject?.claims.length ? null : (frame.town ?? null)
  const labels = planLabels(projection, {
    drawings: frame.drawings,
    towns: show('towns') ? data.towns : [],
    roads: show('roads') ? data.roads : [],
    places: show('places') ? data.places : [],
    events: show('events') ? data.events : [],
    now,
  })
  // The ground, and over it what keeps its size on the page mid-zoom (leaflet/canvas.tsx → OnTop).
  return (
    <>
      {show('towns') ? <TownsLayer projection={projection} selected={selected} towns={data.towns} /> : null}
      {subject ? <SubjectLayer part="claims" projection={projection} subject={subject} /> : null}
      {show('roads') ? <RoadsLayer part="roads" projection={projection} roads={data.roads} /> : null}
      <OnTop>
        {show('roads') ? (
          <RoadsLayer labels={labels.roads} part="names" projection={projection} roads={data.roads} />
        ) : null}
        {show('places') ? (
          <PlacesLayer labels={labels.places} places={data.places} projection={projection} />
        ) : null}
        {show('events') ? (
          <EventsLayer events={data.events} labels={labels.events} now={now} projection={projection} />
        ) : null}
        {show('towns') ? (
          <TownLabels
            labels={labels.towns}
            outposts={labels.outposts}
            projection={projection}
            selected={frame.town ?? null}
            towns={data.towns}
          />
        ) : null}
        {subject ? <SubjectLayer part="pin" projection={projection} subject={subject} /> : null}
        {frame.drawings.length ? (
          <DrawingsLayer drawings={frame.drawings} projection={projection} />
        ) : null}
      </OnTop>
    </>
  )
}
