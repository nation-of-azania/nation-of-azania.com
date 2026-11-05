'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import type { MapRoad } from '@/maps/data'
import {
  LANE_PRESETS,
  lanePreset,
  newPart,
  otherSide,
  PART_LABELS,
  PART_WIDTHS,
  partLabel,
  profileOf,
  roomForChange,
  withChangeAt,
  withoutChange,
  withoutPart,
  withPart,
  withPartAt,
  withPavements,
  withProfile,
  withWidth,
  type LanePartKind,
  type RoadLanes,
} from '@/maps/lanes'
import { ROAD_KINDS, type RoadKind } from '@/maps/registry'

import { BUTTON, LABEL, TextButton } from '../ui/chrome'
import { Hint, HintMark } from '../ui/Hint'
import { Icon } from '../ui/icons'
import { LanesStrip } from '../ui/LanesStrip'
import { stripScale } from '../ui/lanesScale'
import { ChangesRibbon } from './ChangesRibbon'

/**
 * The road's lanes in the road editor (./forms.tsx → RoadForm): quiet
 * until wanted, since most roads have none. Opened, it offers a starting
 * point, the cross-sections the road's own town has already (by example:
 * "as Löwenzahnweg") and then the presets, with the side traffic keeps to
 * and the pavements to add; chosen, the cross-section is a strip drawn to
 * scale (ui/LanesStrip.tsx) about the drawn line, which holds still at the
 * middle as the road grows; each part pressed to shape it: its width by
 * the half block, a lane's direction, a line's style, a strip's surface;
 * parts added and taken away. Where the lanes change along the road
 * (lanes.ts → changes), a ribbon over the strip shows the road unrolled
 * with each change on it (./ChangesRibbon.tsx): pressed, the strip shows
 * that change's cross-section to shape; dragged, it slides along the
 * road. A change is added at the picked point, or where there's most room.
 * The words are few; what a thing does is a hint away (ui/Hint.tsx).
 */

type Example = { lanes: RoadLanes; roads: MapRoad[] }

/** The glyphs the buttons speak in, drawn small. */
const glyph = (d: string, extra?: ReactNode) => (
  <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 16 16">
    <path d={d} />
    {extra}
  </svg>
)
const GLYPHS = {
  with: glyph('M8 14V2M4 6l4-4 4 4'),
  against: glyph('M8 2v12M4 10l4 4 4-4'),
  both: glyph('M8 2v12M5 5l3-3 3 3M5 11l3 3 3-3'),
  dashed: glyph('M8 2v2.5M8 7v2.5M8 12v2.5'),
  solid: glyph('M8 2v12'),
  grass: glyph('M4 14v-4M8 14V6M12 14v-4M6 14v-2M10 14v-3'),
  paved: glyph('M2.5 2.5h5v5h-5zM8.5 2.5h5v5h-5zM2.5 8.5h5v5h-5zM8.5 8.5h5v5h-5z'),
  swap: glyph('M3 5h9M9 2l3 3-3 3M13 11H4M7 8l-3 3 3 3'),
  /** The road narrowing: a change along it. */
  change: glyph('M4 1.5v5l2 8M12 1.5v5l-2 8'),
  /** A road between two pavements: which to add. */
  walkLeft: glyph('M5 2v12M11 2v12', <rect fill="currentColor" height={12} stroke="none" width={2.5} x={1.5} y={2} />),
  walkRight: glyph('M5 2v12M11 2v12', <rect fill="currentColor" height={12} stroke="none" width={2.5} x={12} y={2} />),
  walkBoth: glyph(
    'M5 2v12M11 2v12',
    <>
      <rect fill="currentColor" height={12} stroke="none" width={2.5} x={1.5} y={2} />
      <rect fill="currentColor" height={12} stroke="none" width={2.5} x={12} y={2} />
    </>,
  ),
}

/** A square button that says what it is on a rest of the mouse, a finger held, or from the keyboard. */
function Tool({
  label,
  pressed,
  disabled,
  onClick,
  children,
  className,
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <Hint described={false} text={label}>
      <button
        aria-label={label}
        aria-pressed={pressed}
        className={cn(BUTTON, 'h-9 w-9 shrink-0', className)}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {children}
      </button>
    </Hint>
  )
}

/** A choice of one among a few, as a row of buttons joined edge to edge. */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | null
  options: { id: T; label: string; glyph?: ReactNode; text?: string }[]
  /** Pressed again, a choice that may be none comes off. */
  onChange: (id: T) => void
}) {
  return (
    <div aria-label={label} className="flex" role="group">
      {options.map((option, index) => (
        <Hint described={false} key={option.id} text={option.label}>
          <button
            aria-label={option.label}
            aria-pressed={value === option.id}
            className={cn(BUTTON, 'h-9 shrink-0', option.text ? 'px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em]' : 'w-9', index > 0 && '-ml-px')}
            onClick={() => onChange(option.id)}
            type="button"
          >
            {option.glyph ?? option.text}
          </button>
        </Hint>
      ))}
    </div>
  )
}

/** The room the strip has: the width of its box, read once it's on the page and again when the panel changes. */
function useRoom(fallback = 352): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState(fallback)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const read = () => setRoom(element.clientWidth || fallback)
    read()
    const observer = new ResizeObserver(read)
    observer.observe(element)
    return () => observer.disconnect()
  }, [fallback])
  return [ref, room]
}

/** What an example is called: by the first road named, with how many more have it. */
function exampleName(example: Example): string {
  const named = example.roads.find((road) => road.name)
  const name = named?.name ?? `an unnamed ${ROAD_KINDS[example.roads[0].kind].label.toLowerCase()}`
  const more = example.roads.length - 1
  return more ? `as ${name} and ${more} more` : `as ${name}`
}

const LANES_HINT = (
  <>
    The road as built, kerb to kerb and beyond: its lanes and which way each runs, the lines between them, a median or a verge,
    the pavements. Seen looking along the road the way you drew it, left to right. The saffron line is where you drew it, down
    the middle of the lanes: widen a part and the road grows from it both ways. Close in, the map draws the road at this
    width, over the build. Where the road changes along its length (a median ending, a turn lane opening), add a change: from
    there on, over so many blocks, the lanes become what you shape.
  </>
)

const RIBBON_HINT = (
  <>
    The road from start to end, with each change along it. Press one to shape the lanes from there on; drag it along the road,
    or its far end to set how far the change runs (the arrow keys do the same, ten blocks at a time with shift). The same marks
    lie across the road on the map, where they can be dragged too.
  </>
)

export function LanesEditor({
  lanes,
  kind,
  length,
  pickedAt,
  section,
  examples,
  onSection,
  onChange,
}: {
  lanes: RoadLanes | null
  kind: RoadKind
  /** The road's length along its course, in blocks. */
  length: number
  /** How far along the road the picked point lies, in blocks: where a change is put in; null for none picked. */
  pickedAt: number | null
  /** The cross-section being shaped: 0 the start's, k the k-th change's (src/maps/lanes.ts → profileOf). */
  section: number
  /** The cross-sections the road's town uses already, most used first (src/maps/lanes.ts → lanesInUse). */
  examples: Example[]
  onSection: (section: number) => void
  /**
   * A change to the lanes, with the cross-section to show from now on
   * where that changes too (one update, so neither overwrites the other);
   * `gesture` names a drag, for the shell to undo as one step.
   */
  onChange: (lanes: RoadLanes | null, how?: { section?: number; gesture?: number }) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const [side, setSide] = useState<'right' | 'left'>('right')
  const [walks, setWalks] = useState<'left' | 'right' | 'both' | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [box, room] = useRoom()
  const changes = lanes?.changes ?? []
  // After an undo, the picked cross-section may be gone: the last there is.
  const k = Math.min(section, changes.length)
  const pick = (next: number) => {
    onSection(next)
    setSelected(null)
  }

  const choose = (chosen: RoadLanes) => {
    onChange(chosen, { section: 0 })
    setChoosing(false)
    setSelected(null)
    setAdding(false)
  }
  const addChange = () => {
    if (!lanes) return
    const added = withChangeAt(lanes, pickedAt ?? roomForChange(lanes, length))
    if (!added) return
    onChange(added.lanes, { section: added.k })
    setSelected(null)
  }
  const removeChange = () => {
    if (!lanes || k < 1) return
    onChange(withoutChange(lanes, k), { section: k - 1 })
    setSelected(null)
  }
  const fromPreset = (id: (typeof LANE_PRESETS)[number]['id']) => {
    const preset = lanePreset(id, side)
    return walks ? withPavements(preset, PART_WIDTHS.walk.usual, walks) : preset
  }

  return (
    <div ref={box}>
      <div className="flex items-center justify-between gap-2">
        <span className={LABEL}>
          Lanes
          <span className="ms-1.5 font-normal normal-case tracking-normal text-ink-400">optional</span>
          <HintMark label="About lanes" text={LANES_HINT} />
        </span>
        {lanes ? (
          <button
            className="text-[12px] text-ink-500 underline decoration-dotted underline-offset-2 hover:text-ink-900 focus-visible:outline-saffron-500"
            onClick={() => {
              onChange(null, { section: 0 })
              setChoosing(false)
              setSelected(null)
            }}
            type="button"
          >
            Remove
          </button>
        ) : choosing ? (
          <button
            className="text-[12px] text-ink-500 underline decoration-dotted underline-offset-2 hover:text-ink-900 focus-visible:outline-saffron-500"
            onClick={() => setChoosing(false)}
            type="button"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {!lanes && !choosing ? (
        <TextButton className="mt-1.5 px-2.5 py-1.5" onClick={() => setChoosing(true)}>
          <Icon className="h-3.5 w-3.5" name="plus" /> Add lanes
        </TextButton>
      ) : null}

      {!lanes && choosing ? (
        <div className="mt-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Choice
              label="Which side traffic keeps to"
              onChange={setSide}
              options={[
                { id: 'right', label: 'Traffic keeps right: it sets the lanes’ directions', text: 'Right' },
                { id: 'left', label: 'Traffic keeps left: it sets the lanes’ directions', text: 'Left' },
              ]}
              value={side}
            />
            <Choice
              label="Pavements to add"
              onChange={(id) => setWalks((current) => (current === id ? null : id))}
              options={[
                { id: 'left', label: 'A pavement on the left', glyph: GLYPHS.walkLeft },
                { id: 'both', label: 'Pavements both sides', glyph: GLYPHS.walkBoth },
                { id: 'right', label: 'A pavement on the right', glyph: GLYPHS.walkRight },
              ]}
              value={walks}
            />
          </div>
          <ul className="mt-2 space-y-1">
            {examples.map((example, index) => (
              <li key={index}>
                <Starter kind={kind} label={exampleName(example)} lanes={example.lanes} onChoose={choose} room={room} />
              </li>
            ))}
            {LANE_PRESETS.map((preset) => (
              <li key={preset.id}>
                <Starter kind={kind} label={preset.label} lanes={fromPreset(preset.id)} onChoose={choose} room={room} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lanes && changes.length ? (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 text-ink-700">
            <div className="min-w-0 flex-1">
              <ChangesRibbon
                lanes={lanes}
                length={length}
                onChange={(next, gesture) => onChange(next, { gesture })}
                onSection={pick}
                section={k}
                width={Math.max(120, room - 28)}
              />
            </div>
            <HintMark label="About the changes along the road" text={RIBBON_HINT} />
          </div>
          <div className="mt-1 flex min-h-9 items-center gap-1">
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] tabular-nums text-ink-500">
              {k > 0 ? (
                <>
                  change {k} · from {changes[k - 1].at} blocks · over {changes[k - 1].over}
                </>
              ) : (
                'from the start'
              )}
            </span>
            {k > 0 ? (
              <Tool label={`Remove change ${k}: the lanes before it carry on`} onClick={removeChange}>
                <Icon className="h-4 w-4" name="trash" />
              </Tool>
            ) : null}
          </div>
        </div>
      ) : null}

      {lanes ? (
        <Shaper
          adding={adding}
          canAddChange={pickedAt != null || length > 0}
          k={k}
          kind={kind}
          lanes={lanes}
          onAddChange={addChange}
          onAdding={setAdding}
          onChange={onChange}
          onSelect={setSelected}
          room={room}
          selected={selected}
        />
      ) : null}
    </div>
  )
}

/** A cross-section to start from: drawn small beside its name, pressed to take it. Every starter's frame is the same, so their drawn lines stand in one column. */
function Starter({ lanes, kind, label, room, onChoose }: { lanes: RoadLanes; kind: RoadKind; label: string; room: number; onChoose: (lanes: RoadLanes) => void }) {
  const frame = Math.min(150, room * 0.4)
  const ppb = stripScale(lanes, frame, { min: 2.5, max: 7 })
  return (
    <button
      className="flex w-full items-center gap-3 border border-sand-300 bg-sand-50 px-2.5 py-1.5 text-left text-[13px] text-ink-900 transition-colors hover:border-sea-700 hover:bg-sand-100 focus-visible:outline-saffron-500"
      onClick={() => onChoose(lanes)}
      type="button"
    >
      <span className="flex w-[40%] max-w-[150px] shrink-0 justify-start">
        <LanesStrip frame={frame} height={18} kind={kind} lanes={lanes} ppb={ppb} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

/** The chosen cross-section (the start's, or a change's: `k` as profileOf takes it), shaped part by part. */
function Shaper({
  lanes: whole,
  k,
  kind,
  room,
  selected,
  adding,
  canAddChange,
  onSelect,
  onAdding,
  onAddChange,
  onChange,
}: {
  lanes: RoadLanes
  k: number
  kind: RoadKind
  room: number
  selected: number | null
  adding: boolean
  canAddChange: boolean
  onSelect: (index: number | null) => void
  onAdding: (adding: boolean) => void
  onAddChange: () => void
  onChange: (lanes: RoadLanes) => void
}) {
  // The strip shows one cross-section; shaped, it goes back into the road's lanes where it belongs.
  const lanes = k > 0 ? profileOf(whole, k) : whole
  const shape = (next: RoadLanes | null) => next && onChange(k > 0 ? withProfile(whole, k, next) : next)
  const ppb = stripScale(lanes, room)
  const part = selected != null ? lanes.parts[selected] : null
  const index = selected ?? lanes.parts.length - 1
  const limits = part ? PART_WIDTHS[part.kind] : null
  const add = (partKind: LanePartKind) => {
    shape(withPartAt(lanes, index + 1, newPart(partKind)))
    onSelect(index + 1)
    onAdding(false)
  }
  const remove = () => {
    if (selected == null) return
    const next = withoutPart(lanes, selected)
    if (!next) return
    shape(next)
    onSelect(null)
  }
  const set = (change: Parameters<typeof withPart>[2]) => selected != null && shape(withPart(lanes, selected, change))
  const setWidth = (width: number) => selected != null && shape(withWidth(lanes, selected, width))
  // The last lane stays.
  const removable = part != null && !(part.kind === 'lane' && lanes.parts.filter((p) => p.kind === 'lane').length === 1)

  return (
    <div className="mt-2">
      {/* The frame is the panel's width, so the drawn line stands still at its middle as the road grows. */}
      <div className="overflow-x-auto">
        <LanesStrip frame={room} kind={kind} lanes={lanes} onSelect={(i) => onSelect(selected === i ? null : i)} ppb={ppb} selected={selected} />
      </div>
      <div className="mt-2 flex min-h-9 items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-700">
          {part ? (
            <>
              {partLabel(lanes, selected!)}{' '}
              <span className="font-mono text-[12px] tabular-nums text-ink-500">
                {part.width} block{part.width === 1 ? '' : 's'}
              </span>
            </>
          ) : (
            <span className="text-ink-500">
              <span className="font-mono text-[12px] tabular-nums">{lanes.parts.reduce((sum, p) => sum + p.width, 0)} blocks</span> across
            </span>
          )}
        </span>
        {part && limits ? (
          <>
            <Tool disabled={part.width <= limits.min} label="Half a block narrower" onClick={() => setWidth(part.width - 0.5)}>
              <Icon className="h-4 w-4" name="minus" />
            </Tool>
            <Tool className="-ml-px" disabled={part.width >= limits.max} label="Half a block wider" onClick={() => setWidth(part.width + 0.5)}>
              <Icon className="h-4 w-4" name="plus" />
            </Tool>
          </>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {part?.kind === 'lane' ? (
          <Choice
            label="Which way the lane runs"
            onChange={(dir) => set({ dir })}
            options={[
              { id: 'with', label: 'Runs the way the road was drawn', glyph: GLYPHS.with },
              { id: 'against', label: 'Runs against it', glyph: GLYPHS.against },
              { id: 'both', label: 'Both ways, shared', glyph: GLYPHS.both },
            ]}
            value={part.dir}
          />
        ) : part?.kind === 'line' ? (
          <Choice
            label="The line’s style"
            onChange={(style) => set({ style })}
            options={[
              { id: 'dashed', label: 'Dashed', glyph: GLYPHS.dashed },
              { id: 'solid', label: 'Solid', glyph: GLYPHS.solid },
            ]}
            value={part.style}
          />
        ) : part?.kind === 'strip' ? (
          <Choice
            label="The strip’s surface"
            onChange={(surface) => set({ surface })}
            options={[
              { id: 'grass', label: 'Grass', glyph: GLYPHS.grass },
              { id: 'paved', label: 'Paved', glyph: GLYPHS.paved },
            ]}
            value={part.surface}
          />
        ) : null}
        <span className="flex-1" />
        <Tool
          disabled={!canAddChange}
          label={canAddChange ? 'Add a change along the road: from there on, the lanes become what you shape' : 'Draw the road first, then add a change along it'}
          onClick={onAddChange}
        >
          {GLYPHS.change}
        </Tool>
        <Tool className="ml-1.5" label="Traffic on the other side: every lane turned about, all along the road" onClick={() => onChange(otherSide(whole))}>
          {GLYPHS.swap}
        </Tool>
        <Tool
          className="-ml-px"
          label={part ? `Add a part after the ${partLabel(lanes, selected!).toLowerCase()}` : 'Add a part at the right edge'}
          onClick={() => onAdding(!adding)}
          pressed={adding}
        >
          <Icon className="h-4 w-4" name="plus" />
        </Tool>
        <Tool
          className="-ml-px"
          disabled={!removable}
          label={!part ? 'Pick a part to remove it' : removable ? `Remove the ${partLabel(lanes, selected!).toLowerCase()}` : 'The last lane stays'}
          onClick={remove}
        >
          <Icon className="h-4 w-4" name="trash" />
        </Tool>
      </div>
      {adding ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {(Object.keys(PART_LABELS) as LanePartKind[]).map((partKind) => (
            <button
              className={cn(BUTTON, 'h-8 px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em]')}
              key={partKind}
              onClick={() => add(partKind)}
              type="button"
            >
              {PART_LABELS[partKind]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
