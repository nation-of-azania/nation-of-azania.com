import { roadLength, type MapData, type MapRoad } from '@/maps/data'
import { junctionsOf } from '@/maps/junctions'
import { describeChanges, describeLanes, laneEndsOf, laneEndWords, lanesWidth, partLabel, placedParts, profileOf, type RoadLanes } from '@/maps/lanes'
import { ROAD_KINDS } from '@/maps/registry'

import { LanesStrip } from '../ui/LanesStrip'
import { stripScale, stripSpan } from '../ui/lanesScale'
import { Look, RoadActions, Survey } from './islands'
import { Facts, PanelHead, PanelSection, TownLink } from './shared'

const nameOf = (road: MapRoad) => road.name ?? `an unnamed ${ROAD_KINDS[road.kind].label.toLowerCase()}`

/**
 * The roads this one meets, each once, as named: those it shares a node
 * with (src/maps/junctions.ts), and those met at a lane (src/maps/lanes.ts
 * → laneEndsOf), with which lane: "Hauptallee (at its outer right lane)"
 * on the slip road's page, "Abfahrt (at the outer right lane)" on
 * Hauptallee's; a road on two of its lanes names both.
 */
function meets(road: MapRoad, roads: MapRoad[]): string[] {
  const byId = new Map(roads.map((other) => [other.id, other]))
  const ids = new Set<number>()
  for (const node of junctionsOf(roads)) if (node.roads.includes(road.id)) for (const id of node.roads) if (id !== road.id) ids.add(Number(id))
  const named = [...ids].flatMap((id) => (byId.has(id) ? [nameOf(byId.get(id)!)] : []))
  // At a lane: by the other road, its lanes met in order.
  const atLanes = new Map<number, string[]>()
  for (const end of laneEndsOf(roads)) {
    if (end.road !== road.id && end.onto !== road.id) continue
    const other = byId.get(end.road === road.id ? end.onto : end.road)
    const onto = byId.get(end.onto)
    if (!other || !onto || ids.has(other.id)) continue
    const words = `${end.onto === road.id ? 'the' : 'its'} ${laneEndWords(onto, end)}`
    const lanes = atLanes.get(other.id) ?? []
    if (!lanes.includes(words)) lanes.push(words)
    atLanes.set(other.id, lanes)
  }
  for (const [id, lanes] of atLanes) named.push(`${nameOf(byId.get(id)!)} (at ${lanes.join(' and ')})`)
  return named
}

/** The lanes figures' frame, in px: the strips and the ribbon share it, so they line up down the section. */
const FRAME = 320
const STRIP_HEIGHT = 28
const LABEL_PX = 5.6

const blocks = (width: number) => width.toLocaleString('en-GB', { maximumFractionDigits: 1 })

/**
 * The cross-section drawn to scale (ui/LanesStrip.tsx) with its parts
 * labelled right under it, where they lie, instead of a sentence beside:
 * each part's width in blocks, then its name, "2 lanes" over a run of
 * lanes one way, "median", "verge" or "pavement" (the lines between lanes
 * need no name). A name too wide for its part sits a line lower, so
 * neighbours never overlap. The sentence the labels replace
 * (lanes.ts → describeLanes) is the figure's name for a screen reader.
 */
function LanesFigure({ lanes, kind, words }: { lanes: RoadLanes; kind: MapRoad['kind']; words: string }) {
  const ppb = stripScale(lanes, FRAME, { min: 4, max: 14 })
  const width = Math.max(stripSpan(lanes) * ppb, FRAME)
  const x = (offset: number) => width / 2 + offset * ppb
  const placed = placedParts(lanes)
  // Widths under each part wide enough on the page to hold a figure.
  const widths = placed.filter(({ part }) => part.kind !== 'line' && part.width * ppb >= 16).map((p) => ({ at: x(p.centre), text: blocks(p.part.width) }))
  // Names: a run of lanes one way is one label; a strip or a pavement its own.
  const names: { at: number; text: string; line: number }[] = []
  for (let i = 0; i < placed.length; i++) {
    const { part, from } = placed[i]
    if (part.kind === 'line') continue
    if (part.kind === 'lane') {
      let j = i
      let count = 0
      let to = placed[i].to
      while (j < placed.length && (placed[j].part.kind === 'line' || (placed[j].part.kind === 'lane' && (placed[j].part as { dir: string }).dir === part.dir))) {
        if (placed[j].part.kind === 'lane') {
          count++
          to = placed[j].to
        }
        j++
      }
      // A line after the last lane of the run belongs to the next run.
      while (j > i && placed[j - 1].part.kind === 'line') j--
      names.push({ at: x((from + to) / 2), text: `${count} lane${count === 1 ? '' : 's'}`, line: 0 })
      i = j - 1
    } else {
      names.push({ at: x(placed[i].centre), text: partLabel(lanes, i).toLowerCase(), line: 0 })
    }
  }
  // Stagger: a name that would run into the one before it drops to the line below.
  const ends: number[] = []
  for (const name of names) {
    const half = (name.text.length * LABEL_PX) / 2 + 3
    let line = 0
    while (line < 2 && ends[line] !== undefined && name.at - half < ends[line]) line++
    name.line = line
    ends[line] = name.at + half
  }
  const lines = Math.max(1, ...names.map((name) => name.line + 1))
  return (
    <div aria-label={words} className="max-w-full overflow-x-auto" role="img">
      <div className="relative" style={{ width, height: STRIP_HEIGHT + 14 + lines * 13 }}>
        <LanesStrip frame={FRAME} height={STRIP_HEIGHT} kind={kind} lanes={lanes} ppb={ppb} />
        {widths.map((label, i) => (
          <span className="absolute -translate-x-1/2 whitespace-nowrap font-mono text-[11px] leading-none text-ink-500 tabular-nums" key={`w${i}`} style={{ left: label.at, top: STRIP_HEIGHT + 3 }}>
            {label.text}
          </span>
        ))}
        {names.map((label, i) => (
          <span className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] leading-none text-ink-700" key={`n${i}`} style={{ left: label.at, top: STRIP_HEIGHT + 16 + label.line * 13 }}>
            {label.text}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * The road unrolled, start to end, with each change along its lanes
 * marked where it begins and how far it runs: the editor's ribbon
 * (editor/ChangesRibbon.tsx) read-only, the start a dot, the end a tick,
 * each change a band with its distance in under it. Where it begins, in
 * blocks, is the figure; the strips below say what it comes to.
 */
function RoadRibbon({ lanes, length }: { lanes: RoadLanes; length: number }) {
  const changes = lanes.changes ?? []
  const pad = 10
  const height = 30
  const mid = 11
  const scale = (FRAME - 2 * pad) / Math.max(1, length)
  const x = (s: number) => pad + Math.max(0, Math.min(length, s)) * scale
  const words = `Along the ${blocks(length)}-block road the lanes change ${changes.length === 1 ? 'once' : `${changes.length} times`}: ${changes
    .map((change) => `from ${blocks(change.at)} blocks, over ${blocks(change.over)}`)
    .join('; ')}.`
  return (
    <svg aria-label={words} className="block max-w-full text-ink-700" height={height} role="img" viewBox={`0 0 ${FRAME} ${height}`} width={FRAME}>
      <line stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} x1={pad} x2={FRAME - pad} y1={mid} y2={mid} />
      <circle cx={pad} cy={mid} fill="currentColor" fillOpacity={0.55} r={4} />
      <line stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} x1={FRAME - pad} x2={FRAME - pad} y1={mid - 5} y2={mid + 5} />
      <text className="fill-ink-500 font-mono" fontSize={11} textAnchor="end" x={FRAME - pad} y={height - 2}>
        {blocks(length)}
      </text>
      {changes.map((change, i) => {
        const x0 = x(change.at)
        const x1 = Math.max(x0 + 3, x(change.at + change.over))
        return (
          <g key={i}>
            <rect fill="currentColor" fillOpacity={0.14} height={14} width={x1 - x0} x={x0} y={mid - 7} />
            <line stroke="currentColor" strokeOpacity={0.65} strokeWidth={2} x1={x0} x2={x0} y1={mid - 10} y2={mid + 10} />
            <line stroke="currentColor" strokeOpacity={0.65} strokeWidth={1.5} x1={x1} x2={x1} y1={mid - 7} y2={mid + 7} />
            <text className="fill-ink-700 font-mono" fontSize={11} fontWeight={600} textAnchor="middle" x={x0} y={height - 2}>
              {blocks(change.at)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** A road's page: its class, length, whose it is, and what it meets. */
export function RoadPanel({ road, data }: { road: MapRoad; data: MapData }) {
  const town = data.towns.find((candidate) => candidate.id === road.town) ?? null
  const length = Math.round(roadLength(road))
  const [start, end] = [road.line[0], road.line[road.line.length - 1]]
  const joined = meets(road, data.roads)
  const changes = road.lanes ? describeChanges(road.lanes) : []
  const corners = road.shape === 'curved' ? road.corners.length : 0
  return (
    <article className="pb-6">
      <PanelHead eyebrow={ROAD_KINDS[road.kind].label} title={road.name ?? 'Unnamed road'}>
        {/* For those who may: the way in to the course, right under the name. */}
        <RoadActions className="mt-3" road={road} />
      </PanelHead>
      <div className="mt-4 px-4">
        <Facts
          items={[
            { label: 'Length', value: `${length.toLocaleString('en-GB')} blocks` },
            {
              label: 'Course',
              value: `${road.shape === 'curved' ? 'Curved' : 'Straight'} · ${road.line.length} point${road.line.length === 1 ? '' : 's'}${corners ? ` · ${corners} sharp corner${corners === 1 ? '' : 's'}` : ''}`,
            },
            {
              label: 'Belongs to',
              value: town ? <TownLink town={town} /> : 'The nation',
              hint: town ? undefined : 'A national road runs between towns, drawn by those who may draw anywhere.',
            },
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
      {/* The cross-section as built, drawn to scale and labelled on the drawing; where it changes along the road, the ribbon says where and each strip what it comes to. */}
      {road.lanes ? (
        <PanelSection
          action={<span className="shrink-0 font-mono text-[13px] font-semibold text-ink-900 tabular-nums">{blocks(lanesWidth(road.lanes))} <span className="font-normal text-ink-500">blocks across</span></span>}
          hint="The road as built, looking along it as drawn: each part as wide as it is, the arrows the way traffic runs, the dotted line where it was drawn."
          title="Lanes"
        >
          <div className="space-y-4">
            {changes.length ? <RoadRibbon lanes={road.lanes} length={length} /> : null}
            {changes.length ? <p className="font-label text-[11px] uppercase tracking-[0.18em] text-ink-500">At the start</p> : null}
            <LanesFigure kind={road.kind} lanes={road.lanes} words={`${describeLanes(road.lanes)} · ${blocks(lanesWidth(road.lanes))} blocks across${changes.length ? ' at the start' : ''}`} />
            {changes.map((change, i) => {
              const after = profileOf(road.lanes!, i + 1)
              return (
                <div key={i}>
                  <p className="flex items-baseline justify-between gap-3 font-label text-[11px] uppercase tracking-[0.18em] text-ink-500">
                    <span>
                      From <span className="font-mono text-[12px] font-semibold tabular-nums text-ink-900">{blocks(change.at)}</span> blocks, over{' '}
                      <span className="font-mono text-[12px] font-semibold tabular-nums text-ink-900">{blocks(change.over)}</span>
                    </span>
                    <span className="font-mono text-[12px] font-semibold normal-case tracking-normal text-ink-900 tabular-nums">
                      {blocks(lanesWidth(after))} <span className="font-normal text-ink-500">across</span>
                    </span>
                  </p>
                  <div className="mt-1.5">
                    <LanesFigure kind={road.kind} lanes={after} words={`${blocks(change.at)} blocks in, over ${blocks(change.over)}: ${change.words} · ${blocks(lanesWidth(after))} blocks across`} />
                  </div>
                </div>
              )
            })}
          </div>
        </PanelSection>
      ) : null}
      <PanelSection title="Start">
        <Survey point={start} />
      </PanelSection>
    </article>
  )
}
