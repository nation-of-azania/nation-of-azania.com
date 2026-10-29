'use client'

import { useId, type ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import { PlaceIcon } from '@/maps/icons'
import { GROUP_COLOURS, GROUND, nationInk, NO_NATION, ROAD_STYLES } from '@/maps/palette'
import {
  MAP_LAYERS,
  PLACE_CATEGORIES,
  PLACE_GROUPS,
  ROAD_KINDS,
  type MapLayer,
  type PlaceGroup,
} from '@/maps/registry'
import { SERVER_INKS } from '@/maps/trading'
import { DEFAULT_EXTRAS, type ExtraLayer, type Extras } from '@/maps/url'
import { CAPITAL_WAR_RADIUS } from '@/maps/world'

import { useStore, type Store } from '../hooks'
import { EventMark } from '../layers/EventsLayer'
import { SiegeMarkGlyph } from '../layers/SiegesLayer'
import { SiteMark } from '../layers/SiteMark'
import { PartSample } from '../layers/TownsLayer'
import { TradingMark } from '../layers/TradingMark'
import type { LiveState } from '../live'
import type { WorldState } from '../world'
import { EYEBROW, IconButton, Popover } from './chrome'
import { STANCE_ORDER, StanceSwatch, stanceLabel } from './Diplomacy'
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

/** One of the layers beyond the nation's own: a checkbox, its name, a few words of state, and a line saying what it is. */
function ExtraRow({
  checked,
  onChange,
  label,
  state,
  note,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  state?: ReactNode
  note: string
}) {
  return (
    <>
      <label className="flex cursor-pointer items-center gap-2.5 px-2 py-1.5 hover:bg-sand-100">
        <input
          checked={checked}
          className="h-4 w-4 accent-sea-800"
          onChange={(e) => onChange(e.target.checked)}
          type="checkbox"
        />
        <span>{label}</span>
        {state}
      </label>
      <p className="px-2 pb-1 pl-9 text-[11px] leading-snug text-ink-400">{note}</p>
    </>
  )
}

/** The world layer's state in a word, while it isn't simply there. */
const WORLD_WORDS: Partial<Record<WorldState['status'], string>> = {
  waiting: 'soon',
  asking: 'loading…',
  saved: 'as last saved',
  down: 'offline',
}

/**
 * Which of the map's own layers show, whether past events do, and the
 * layers beyond the nation's own: the rest of the world, and the players
 * online.
 */
export function LayerMenu({
  layers,
  onChange,
  showPast,
  onShowPast,
  extras,
  onExtra,
  liveStore,
  worldStatus,
}: {
  layers: MapLayer[]
  onChange: (layers: MapLayer[]) => void
  showPast: boolean
  onShowPast: (value: boolean) => void
  extras: Extras
  onExtra: (layer: ExtraLayer, on: boolean) => void
  liveStore: Store<LiveState>
  worldStatus: WorldState['status']
}) {
  const toggle = (layer: MapLayer) =>
    onChange(
      layers.includes(layer) ? layers.filter((other) => other !== layer) : [...layers, layer],
    )
  const changed = (Object.keys(DEFAULT_EXTRAS) as ExtraLayer[]).some((layer) => extras[layer] !== DEFAULT_EXTRAS[layer])
  const worldWords = extras.world ? WORLD_WORDS[worldStatus] : undefined
  return (
    <Popover icon="layers" label="Layers" pressed={layers.length < 4 || changed} width="w-64">
      <p className={cn(EYEBROW, 'px-2 pt-1')}>Azania</p>
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
      </ul>
      <p className={cn(EYEBROW, 'mt-1.5 border-t border-sand-300/70 px-2 pt-2.5')}>The world</p>
      <ul className="mt-1.5">
        <li>
          <ExtraRow
            checked={extras.world}
            label="Other nations"
            note="Every town on the server in its nation’s colour; Azania stays in full."
            onChange={(on) => onExtra('world', on)}
            state={worldWords ? <span className="ml-auto text-xs text-ink-500">{worldWords}</span> : null}
          />
        </li>
        <li>
          <ExtraRow
            checked={extras.diplomacy}
            label="Diplomacy"
            note="Where Azania stands with the other nations: allies green, enemies red, the land veiled so they read. The pennant button beside is the same switch."
            onChange={(on) => onExtra('diplomacy', on)}
          />
        </li>
        <li>
          <ExtraRow
            checked={extras.reach}
            label="War reach"
            note="How far from its capital a nation may besiege: Azania’s ring, and a nation’s when it’s open or under the pointer."
            onChange={(on) => onExtra('reach', on)}
          />
        </li>
        <li>
          <ExtraRow
            checked={extras.players}
            label="Players (live)"
            note="Who’s on the server, where they are, every few seconds. Nothing is kept."
            onChange={(on) => onExtra('players', on)}
            state={extras.players ? <LiveWords store={liveStore} /> : null}
          />
        </li>
      </ul>
    </Popover>
  )
}

/**
 * What the marks mean: the road classes, the place groups, a town's claims
 * and a held site's, the event mark; and the way out to the globe, where
 * the browser can draw one (`globe`).
 */
export function Legend({ globe }: { globe: boolean }) {
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
              <PartSample role="outpost" />
            </svg>
            <span>A town’s outpost: claims apart from the town, with a spawn of their own (/t outpost), striped in its nation’s colour</span>
          </li>
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-5 w-12 shrink-0" viewBox="0 0 48 20">
              <PartSample role="detached" />
            </svg>
            <span>Claims detached from a town: joined to neither the town nor an outpost</span>
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
        <p className={cn(EYEBROW, 'mt-3 px-1')}>The world</p>
        <ul className="mt-1.5 space-y-1">
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-4 w-12 shrink-0" viewBox="0 0 48 16">
              <rect fill={NATION_SAMPLE.line} fillOpacity={0.12} height={12} stroke={NATION_SAMPLE.line} strokeWidth={1} width={19} x={3} y={2} />
              <rect fill={OTHER_SAMPLE.line} fillOpacity={0.12} height={12} stroke={OTHER_SAMPLE.line} strokeWidth={1} width={19} x={26} y={2} />
            </svg>
            <span>Another nation’s towns, in its own colour</span>
          </li>
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-4 w-12 shrink-0" viewBox="0 0 48 16">
              <rect fill={NO_NATION.line} fillOpacity={0.08} height={12} stroke={NO_NATION.line} strokeDasharray="3 2" strokeWidth={1} width={40} x={4} y={2} />
            </svg>
            <span>A town of no nation</span>
          </li>
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-4 w-12 shrink-0" viewBox="0 0 48 16">
              <circle cx={14} cy={8} fill={GROUND.whitewash} r={5.5} stroke={NATION_SAMPLE.line} strokeWidth={1.25} />
              <circle cx={14} cy={8} fill={NATION_SAMPLE.line} r={3} />
              <circle cx={34} cy={8} fill={NATION_SAMPLE.line} r={2.75} stroke={GROUND.whitewash} strokeWidth={1} />
            </svg>
            <span>A nation’s capital, and a town</span>
          </li>
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-5 w-12 shrink-0" viewBox="0 0 48 20">
              <SiteMark facts={{ kind: 'quarry', resource: 'Iron' }} ring={NATION_SAMPLE.line} scale={0.7} x={24} y={10} />
            </svg>
            <span>A site another nation holds, rimmed in its colour</span>
          </li>
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-5 w-12 shrink-0" viewBox="0 0 48 20">
              <rect
                fill={SERVER_INKS.trading.edge}
                fillOpacity={0.06}
                height={14}
                stroke={SERVER_INKS.trading.edge}
                strokeDasharray="0.5 3.5"
                strokeLinecap="round"
                strokeWidth={1.75}
                width={40}
                x={4}
                y={3}
              />
              <TradingMark kind="trading" scale={0.75} x={24} y={10} />
            </svg>
            <span>A trading outpost, the server’s own: trade with it at its prices. Nobody holds one, and it’s no town’s outpost</span>
          </li>
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-5 w-12 shrink-0" viewBox="0 0 48 20">
              <TradingMark kind="landmark" scale={0.7} x={24} y={10} />
            </svg>
            <span>One of the server’s landmarks, nobody’s either</span>
          </li>
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-6 w-12 shrink-0" viewBox="0 0 48 24">
              <SiegeMarkGlyph battle breathe={false} scale={0.8} side={null} x={13} y={12} />
              <SiegeMarkGlyph battle={false} breathe={false} scale={0.8} side={null} x={35} y={12} />
            </svg>
            <span>A siege, at its banner: a battle on, and quiet. Always shown</span>
          </li>
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-6 w-12 shrink-0" viewBox="0 0 48 24">
              <SiegeMarkGlyph battle breathe={false} scale={0.7} side="defending" x={24} y={12} />
            </svg>
            <span>A siege Azania is in, ringed in saffron</span>
          </li>
          <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
            <svg aria-hidden="true" className="h-6 w-12 shrink-0" viewBox="0 0 48 24">
              <path d="M2 22A30 30 0 0 1 46 22" fill="none" stroke={GROUND.whitewash} strokeOpacity={0.7} strokeWidth={4} />
              <path d="M2 22A30 30 0 0 1 46 22" fill="none" stroke={GROUND.sea800} strokeDasharray="5 3" strokeWidth={2} />
            </svg>
            <span>
              War reach: {CAPITAL_WAR_RADIUS.toLocaleString('en-GB')} blocks from a capital, as far as a nation may
              besiege; it ends at the world’s edge
            </span>
          </li>
          {globe ? (
            <li className="flex items-center gap-3 px-1 py-0.5 text-[13px]">
              <Icon className="mx-3.5 h-5 w-5 shrink-0 text-sea-800" name="globe" />
              <span>Zoom out past the whole world and the map becomes a globe</span>
            </li>
          ) : null}
        </ul>
        <p className={cn(EYEBROW, 'mt-3 px-1')}>Diplomacy, when it’s on</p>
        <ul className="mt-1.5 grid grid-cols-3 gap-x-2 gap-y-1">
          {STANCE_ORDER.map((stance) => (
            <li className="flex items-center gap-1.5 px-1 py-0.5 text-[13px]" key={stance}>
              <StanceSwatch stance={stance} />
              <span className="truncate">{stanceLabel(stance)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 px-1 text-[12px] leading-snug text-ink-500">
          The land is veiled and each nation washed in its stance; a friend’s or foe’s name wears a pennant, and a siege one is in is ringed in its colour. Set from a nation’s page by Azania’s diplomats.
        </p>
      </div>
    </Popover>
  )
}

/** Two nations' colours for the legend's samples, as the map tempers them. */
const NATION_SAMPLE = nationInk('#00008B')
const OTHER_SAMPLE = nationInk('#FF0000')

/**
 * The zoom, and under it the world as a globe and back, since the globe is
 * the zoom's own last step out (`globe`, where the browser can draw one).
 * The globe's code is fetched the moment the pointer comes to its button,
 * or it's focused, so a click opens it at once. The button is a toggle: its
 * name stays the same and it says whether it's pressed, so a screen reader
 * hears the globe shown or not, never a name that reads as the other way.
 */
export function ZoomButtons({
  onZoom,
  globe,
}: {
  onZoom: (delta: number) => void
  globe?: { on: boolean; disabled: boolean; onToggle: () => void; onWarm: () => void } | null
}) {
  return (
    <>
      <div className="flex flex-col" role="group" aria-label="Zoom">
        <IconButton icon="plus" label="Zoom in" onClick={() => onZoom(1)} />
        <IconButton className="-mt-px" icon="minus" label="Zoom out" onClick={() => onZoom(-1)} />
      </div>
      {globe ? (
        <IconButton
          className="az-globe-button relative"
          disabled={globe.disabled}
          icon="globe"
          label="Show the world as a globe"
          onClick={globe.onToggle}
          onFocus={globe.onWarm}
          onPointerEnter={globe.onWarm}
          pressed={globe.on}
        />
      ) : null}
    </>
  )
}

/**
 * The diplomacy layer's own button, beside the layers: where Azania stands
 * with the other nations is the question the map is most often asked, and
 * a row in the layers menu was too easy to miss. A toggle, pressed while
 * the layer is on.
 */
export function DiplomacyButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <IconButton
      icon="diplomacy"
      label={on ? 'Hide Azania’s diplomacy' : 'Show Azania’s diplomacy: where it stands with the other nations'}
      onClick={onToggle}
      pressed={on}
    />
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
