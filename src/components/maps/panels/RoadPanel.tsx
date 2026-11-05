import { roadLength, type MapData, type MapRoad } from '@/maps/data'
import { junctionsOf } from '@/maps/junctions'
import { describeChanges, describeLanes, lanesWidth, profileOf } from '@/maps/lanes'
import { ROAD_KINDS, ROAD_SHAPES } from '@/maps/registry'

import { LanesStrip } from '../ui/LanesStrip'
import { stripScale } from '../ui/lanesScale'
import { Look, RoadActions, Survey } from './islands'
import { Facts, PanelHead, PanelSection, TownLink } from './shared'

/** The roads this one shares a node with (src/maps/junctions.ts), each once, as named. */
function meets(road: MapRoad, roads: MapRoad[]): string[] {
  const ids = new Set<number>()
  for (const node of junctionsOf(roads)) if (node.roads.includes(road.id)) for (const id of node.roads) if (id !== road.id) ids.add(Number(id))
  return [...ids]
    .map((id) => roads.find((other) => other.id === id))
    .filter((other): other is MapRoad => Boolean(other))
    .map((other) => other.name ?? `an unnamed ${ROAD_KINDS[other.kind].label.toLowerCase()}`)
}

/** A road's page: its class, length, whose it is, and what it meets. */
export function RoadPanel({ road, data }: { road: MapRoad; data: MapData }) {
  const town = data.towns.find((candidate) => candidate.id === road.town) ?? null
  const length = Math.round(roadLength(road))
  const [start, end] = [road.line[0], road.line[road.line.length - 1]]
  const joined = meets(road, data.roads)
  return (
    <article className="pb-6">
      <PanelHead
        eyebrow={`${ROAD_KINDS[road.kind].label} · ${town ? 'town road' : 'national'}`}
        title={road.name ?? 'Unnamed road'}
      >
        <p className="mt-2 text-[15px] text-ink-700">
          {length.toLocaleString('en-GB')} blocks, {road.shape === 'curved' ? 'curving' : 'straight'}{' '}
          through {road.line.length} point{road.line.length === 1 ? '' : 's'}
          {road.shape === 'curved' && road.corners.length
            ? `, ${road.corners.length} of them sharp corner${road.corners.length === 1 ? '' : 's'}`
            : ''}
          .
        </p>
        {/* For those who may: the way in to the course, right under the name. */}
        <RoadActions className="mt-3" road={road} />
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
            // The cross-section as built: in a few words, and drawn to scale, as the editor shows it; where the lanes
            // change along the road, each change after it, with what the road comes to.
            ...(road.lanes
              ? [
                  {
                    label: 'Lanes',
                    value: (
                      <span className="block">
                        <span className="block">
                          {describeLanes(road.lanes)} · {lanesWidth(road.lanes)} blocks across
                          {road.lanes.changes?.length ? (road.lanes.changes.length === 1 ? ' at the start' : ` at the start, changing ${road.lanes.changes.length} times`) : ''}
                        </span>
                        <LanesStrip className="mt-1.5 max-w-full" frame={176} height={22} kind={road.kind} lanes={road.lanes} ppb={stripScale(road.lanes, 176, { min: 3, max: 12 })} />
                        {describeChanges(road.lanes).map((change, i) => {
                          const after = profileOf(road.lanes!, i + 1)
                          return (
                            <span className="mt-2 block" key={i}>
                              <span className="block">
                                <span className="font-mono text-[13px] tabular-nums text-ink-500">
                                  {change.at.toLocaleString('en-GB')} blocks in, over {change.over}
                                </span>
                                {' · '}
                                {change.words} · {lanesWidth(after)} across
                              </span>
                              <LanesStrip className="mt-1.5 max-w-full" frame={176} height={22} kind={road.kind} lanes={after} ppb={stripScale(after, 176, { min: 3, max: 12 })} />
                            </span>
                          )
                        })}
                      </span>
                    ),
                  },
                ]
              : []),
            {
              label: 'Runs',
              value: (
                <span className="font-mono text-[13px] tabular-nums">
                  {start[0]}, {start[1]} → {end[0]}, {end[1]}
                </span>
              ),
            },
            ...(joined.length ? [{ label: 'Meets', value: joined.join(', ') }] : []),
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
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
      </div>
      <PanelSection title="Start">
        <Survey point={start} />
      </PanelSection>
    </article>
  )
}
