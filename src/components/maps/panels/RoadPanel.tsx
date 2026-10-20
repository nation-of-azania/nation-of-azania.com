import { roadLength, type MapData, type MapRoad } from '@/maps/data'
import { ROAD_KINDS, ROAD_SHAPES } from '@/maps/registry'

import { Look, RoadActions, Survey } from './islands'
import { Facts, PanelHead, PanelSection, TownLink } from './shared'

/** A road's page: its class, length and whose it is. */
export function RoadPanel({ road, data }: { road: MapRoad; data: MapData }) {
  const town = data.towns.find((candidate) => candidate.id === road.town) ?? null
  const length = Math.round(roadLength(road))
  const [start, end] = [road.line[0], road.line[road.line.length - 1]]
  return (
    <article className="pb-6">
      <PanelHead
        eyebrow={`${ROAD_KINDS[road.kind].label} · ${town ? 'town road' : 'national'}`}
        title={road.name ?? 'Unnamed road'}
      >
        <p className="mt-2 text-sm text-ink-700">
          {length.toLocaleString('en-GB')} blocks, {road.shape === 'curved' ? 'curving' : 'straight'}{' '}
          through {road.line.length} point{road.line.length === 1 ? '' : 's'}
          {road.shape === 'curved' && road.corners.length
            ? `, ${road.corners.length} of them sharp corner${road.corners.length === 1 ? '' : 's'}`
            : ''}
          .
        </p>
      </PanelHead>
      <div className="mt-4 px-4">
        <Facts
          items={[
            {
              label: 'Class',
              value: `${ROAD_KINDS[road.kind].label} · ${ROAD_SHAPES[road.shape].label.toLowerCase()}`,
            },
            {
              label: 'Belongs to',
              value: town ? <TownLink town={town} /> : 'The nation: it runs between towns',
            },
            { label: 'Length', value: `${length.toLocaleString('en-GB')} blocks` },
            {
              label: 'Runs',
              value: (
                <span className="font-mono text-[12px] tabular-nums">
                  {start[0]}, {start[1]} → {end[0]}, {end[1]}
                </span>
              ),
            },
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          <Look
            className="text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
            target={{ centre: start, zoom: 1, minZoom: true }}
          >
            Go to the start
          </Look>
          <Look
            className="text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
            target={{ centre: end, zoom: 1, minZoom: true }}
          >
            Go to the end
          </Look>
        </div>
        <div className="mt-4">
          <RoadActions road={road} />
        </div>
      </div>
      <PanelSection title="Start">
        <Survey point={start} />
      </PanelSection>
    </article>
  )
}
