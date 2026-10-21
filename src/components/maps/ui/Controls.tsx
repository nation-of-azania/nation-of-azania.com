'use client'

import { useId } from 'react'

import { cn } from '@/blocks/components/shared'
import { PlaceIcon } from '@/maps/icons'
import { GROUP_COLOURS, GROUND, ROAD_STYLES } from '@/maps/palette'
import {
  MAP_LAYERS,
  PLACE_CATEGORIES,
  PLACE_GROUPS,
  ROAD_KINDS,
  type MapLayer,
  type PlaceGroup,
} from '@/maps/registry'

import { useStore, type Store } from '../hooks'
import { EventMark } from '../layers/EventsLayer'
import { SiteMark } from '../layers/SiteMark'
import type { LiveState } from '../live'
import { EYEBROW, IconButton, Popover } from './chrome'
import { Icon } from './icons'

const LAYER_WORDS: Record<MapLayer, string> = {
  towns: 'Towns and held sites',
  places: 'Places',
  roads: 'Roads',
  events: 'Events',
}

/** The live layer's row: what the feed says, in a few words beside its name. */
function LiveWords({ store }: { store: Store<LiveState> }) {
  const live = useStore(store)
  const words =
    live.status === 'live'
      ? `${live.online ?? live.players.length} online`
      : live.status === 'down'
        ? 'offline'
        : live.status === 'asking'
          ? 'asking…'
          : null
  return words ? <span className="ml-auto text-xs text-ink-500">{words}</span> : null
}

/** Which of the map's own layers show, whether past events do, and whether the players online are. */
export function LayerMenu({
  layers,
  onChange,
  showPast,
  onShowPast,
  live,
  onLive,
  liveStore,
}: {
  layers: MapLayer[]
  onChange: (layers: MapLayer[]) => void
  showPast: boolean
  onShowPast: (value: boolean) => void
  live: boolean
  onLive: (value: boolean) => void
  liveStore: Store<LiveState>
}) {
  const toggle = (layer: MapLayer) =>
    onChange(
      layers.includes(layer) ? layers.filter((other) => other !== layer) : [...layers, layer],
    )
  return (
    <Popover icon="layers" label="Layers" pressed={layers.length < 4 || !live} width="w-60">
      <p className={cn(EYEBROW, 'px-2 pt-1')}>Layers</p>
      <ul className="mt-1.5">
        {(Object.keys(MAP_LAYERS) as MapLayer[]).map((layer) => (
          <li key={layer}>
            <label className="flex cursor-pointer items-center gap-2.5 px-2 py-1.5 hover:bg-sand-100">
              <input
                checked={layers.includes(layer)}
                className="h-4 w-4 accent-sea-800"
                onChange={() => toggle(layer)}
                type="checkbox"
              />
              <span>{LAYER_WORDS[layer]}</span>
            </label>
            {layer === 'events' && layers.includes('events') ? (
              <label className="flex cursor-pointer items-center gap-2.5 px-2 py-1.5 pl-9 text-xs text-ink-500 hover:bg-sand-100">
                <input
                  checked={showPast}
                  className="h-3.5 w-3.5 accent-sea-800"
                  onChange={(e) => onShowPast(e.target.checked)}
                  type="checkbox"
                />
                <span>Past events too</span>
              </label>
            ) : null}
          </li>
        ))}
        <li className="mt-1.5 border-t border-sand-300/70 pt-1.5">
          <label className="flex cursor-pointer items-center gap-2.5 px-2 py-1.5 hover:bg-sand-100">
            <input
              checked={live}
              className="h-4 w-4 accent-sea-800"
              onChange={(e) => onLive(e.target.checked)}
              type="checkbox"
            />
            <span>Players (live)</span>
            {live ? <LiveWords store={liveStore} /> : null}
          </label>
          <p className="px-2 pb-1 pl-9 text-[11px] leading-snug text-ink-400">
            Who’s on the server, where they are, every few seconds. Nothing is kept.
          </p>
        </li>
      </ul>
    </Popover>
  )
}

/** What the marks mean: the road classes, the place groups, a town's claims and a held site's, the event mark. */
export function Legend() {
  const hatch = `${useId()}-hatch`
  const groups = Object.keys(PLACE_GROUPS) as PlaceGroup[]
  const sample = (group: PlaceGroup) =>
    (Object.entries(PLACE_CATEGORIES).find(([, c]) => c.group === group)?.[0] ??
      'other') as keyof typeof PLACE_CATEGORIES
  return (
    <Popover icon="info" label="Legend" width="w-72">
      <div className="max-h-[70vh] overflow-y-auto px-1 pb-1">
        <p className={cn(EYEBROW, 'px-1 pt-1')}>Roads</p>
        <ul className="mt-1.5 space-y-1">
          {(Object.keys(ROAD_KINDS) as (keyof typeof ROAD_KINDS)[]).map((kind) => {
            const style = ROAD_STYLES[kind]
            return (
              <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]" key={kind}>
                <svg aria-hidden="true" className="h-3 w-12 shrink-0" viewBox="0 0 48 12">
                  {style.casing ? (
                    <line
                      stroke={style.casing}
                      strokeLinecap="round"
                      strokeWidth={7}
                      x1={3}
                      x2={45}
                      y1={6}
                      y2={6}
                    />
                  ) : null}
                  <line
                    stroke={style.fill}
                    strokeDasharray={
                      style.dash ? style.dash.map((n) => n * 5).join(' ') : undefined
                    }
                    strokeLinecap={style.dash ? 'butt' : 'round'}
                    strokeWidth={5}
                    x1={3}
                    x2={45}
                    y1={6}
                    y2={6}
                  />
                  {style.over ? (
                    <line
                      stroke={style.over.colour}
                      strokeDasharray={style.over.dash.map((n) => n * 5).join(' ')}
                      strokeWidth={2.2}
                      x1={3}
                      x2={45}
                      y1={6}
                      y2={6}
                    />
                  ) : null}
                </svg>
                <span>{ROAD_KINDS[kind].label}</span>
              </li>
            )
          })}
        </ul>
        <p className={cn(EYEBROW, 'mt-3 px-1')}>Places</p>
        <ul className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
          {groups.map((group) => (
            <li className="flex items-center gap-2 px-1 py-0.5 text-[13px]" key={group}>
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-sand-50"
                style={{ background: GROUP_COLOURS[group] }}
              >
                <PlaceIcon category={sample(group)} className="h-3 w-3" />
              </span>
              <span className="truncate">{PLACE_GROUPS[group]}</span>
            </li>
          ))}
        </ul>
        <p className={cn(EYEBROW, 'mt-3 px-1')}>Towns and events</p>
        <ul className="mt-1.5 space-y-1">
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-4 w-12 shrink-0" viewBox="0 0 48 16">
              <rect
                fill={GROUND.sea700}
                fillOpacity={0.12}
                height={12}
                stroke={GROUND.sea700}
                strokeWidth={1.5}
                width={40}
                x={4}
                y={2}
              />
            </svg>
            <span>A town’s claims (Towny)</span>
          </li>
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-5 w-12 shrink-0" viewBox="0 0 48 20">
              <defs>
                <pattern height={6} id={hatch} patternTransform="rotate(45)" patternUnits="userSpaceOnUse" width={6}>
                  <line stroke={GROUND.saffronDeep} strokeOpacity={0.55} strokeWidth={1.2} x1={0} x2={0} y1={0} y2={6} />
                </pattern>
              </defs>
              <rect fill={GROUND.saffron} fillOpacity={0.08} height={14} width={40} x={4} y={3} />
              <rect
                fill={`url(#${hatch})`}
                height={14}
                stroke={GROUND.saffronDeep}
                strokeDasharray="4 2"
                strokeWidth={1.5}
                width={40}
                x={4}
                y={3}
              />
              <SiteMark facts={{ kind: 'quarry', resource: 'Diamond' }} scale={0.7} x={24} y={10} />
            </svg>
            <span>A site Azania holds: a quarry, a wasteland, a treasure ship</span>
          </li>
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-5 w-12 shrink-0" viewBox="0 0 48 20">
              <rect fill={GROUND.sea500} height={12} rx={1} stroke={GROUND.saffron} strokeWidth={2} width={12} x={8} y={4} />
              <rect fill={GROUND.inkSoft} height={12} rx={1} stroke={GROUND.whitewash} strokeWidth={2} width={12} x={28} y={4} />
            </svg>
            <span>A player online now: Azania’s own ringed in saffron</span>
          </li>
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-5 w-12 shrink-0" viewBox="0 0 48 20">
              <EventMark phase="upcoming" scale={0.8} x={14} y={10} />
              <EventMark phase="past" scale={0.8} x={34} y={10} />
            </svg>
            <span>An event: coming, and past</span>
          </li>
        </ul>
      </div>
    </Popover>
  )
}

export function ZoomButtons({ onZoom }: { onZoom: (delta: number) => void }) {
  return (
    <div className="flex flex-col" role="group" aria-label="Zoom">
      <IconButton icon="plus" label="Zoom in" onClick={() => onZoom(1)} />
      <IconButton className="-mt-px" icon="minus" label="Zoom out" onClick={() => onZoom(-1)} />
    </div>
  )
}

export type DrawChoice = 'place' | 'road' | 'event' | 'view' | 'views'

/** What the signed-in person may add: offered only to those who may. */
export function DrawMenu({
  canDraw,
  canViews,
  onChoose,
  active,
}: {
  canDraw: boolean
  canViews: boolean
  onChoose: (choice: DrawChoice) => void
  active: boolean
}) {
  const items: {
    choice: DrawChoice
    label: string
    icon: 'pin' | 'road' | 'flag' | 'frame' | 'list'
    hint: string
    show: boolean
  }[] = [
    {
      choice: 'place',
      label: 'Add a place',
      icon: 'pin',
      hint: 'A pin, with a name and a category',
      show: canDraw,
    },
    {
      choice: 'road',
      label: 'Draw a road',
      icon: 'road',
      hint: 'Point by point, with a name and a class',
      show: canDraw,
    },
    {
      choice: 'event',
      label: 'Add an event',
      icon: 'flag',
      hint: 'At a place or a point, with a time',
      show: canDraw,
    },
    {
      choice: 'view',
      label: 'New map view',
      icon: 'frame',
      hint: 'Frame and highlight a piece for an article',
      show: canViews,
    },
    {
      choice: 'views',
      label: 'My map views',
      icon: 'list',
      hint: 'Open one again, rename or redraw it',
      show: canViews,
    },
  ]
  return (
    <Popover icon="pencil" label="Draw on the map" pressed={active} width="w-72">
      {(close) => (
        <ul role="menu">
          {items
            .filter((item) => item.show)
            .map((item) => (
              <li key={item.choice} role="none">
                <button
                  className="flex w-full items-start gap-3 px-2 py-2 text-left hover:bg-sand-100 focus-visible:outline-saffron-500"
                  onClick={() => {
                    close()
                    onChoose(item.choice)
                  }}
                  role="menuitem"
                  type="button"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sea-700" name={item.icon} />
                  <span>
                    <span className="block font-semibold text-ink-900">{item.label}</span>
                    <span className="block text-xs text-ink-500">{item.hint}</span>
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </Popover>
  )
}
