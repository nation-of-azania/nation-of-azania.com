'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import type { Point } from '@/maps/geo'
import type { Insets } from '@/maps/globe'
import { GLOBE } from '@/maps/globe-switches'
import type { MapPosition } from '@/maps/url'

import { useMaps } from '../context'
import type { Store } from '../hooks'
import type { LiveState } from '../live'
import type { LookTarget, SceneApi } from '../MapScene'
import { Notice } from '../ui/chrome'
import type { SheetState } from '../ui/Sheet'
import { Globe } from './Globe'
import { GlobeFrame } from './GlobeFrame'
import { markGlobeBroken } from './support'
import type { GlobeApi, GlobeEntry, GlobePhase, GlobePick, GlobePull, LeaveRequest } from './types'

/** The world's picture, decoded as the globe's code comes, for the globe to take up in a moment (./sheet.ts). */
export { warmSheet } from './sheet'

/**
 * The globe's own keeper, loaded with it: what the shell (../MapsShell.tsx)
 * would otherwise carry in the map's first load for a globe most readers
 * never open. It mounts the globe (./Globe.tsx) and lets it linger, hidden
 * and drawing nothing, a while after it closes, so opening it again is
 * instant, before giving its memory back, and mounts it again the moment
 * the flat map is pulled out past its farthest zoom; it remembers where
 * the flat map is to look once the globe has gone; it turns a click on the
 * globe into the page it opens; it says to a screen reader that the globe
 * has come and gone; it tells a reader whose pull fell short to keep
 * going; and should the globe fail, it says so in a note among the map's
 * controls and leaves the flat map as it was.
 */

/**
 * What the shell asks of the globe. Each of `look`, `zoomBy` and `escape`
 * answers whether the globe saw to it: false while it's closed (or only
 * following a pull), when the flat map is to do it itself.
 */
export type HostApi = {
  enter: (entry: GlobeEntry) => void
  leave: (request?: LeaveRequest) => void
  /**
   * Somewhere to look. A page that has just arrived (`stay`) turns the
   * globe towards it; anything else hands back to the flat map, which then
   * looks; asked while the globe hands back, it waits, the latest winning.
   */
  look: (target: LookTarget, stay: boolean) => boolean
  /**
   * The zoom buttons' step: the globe's while it's open; on its way up, a step out the globe's once it's open
   * and a step in a turn back to the flat map; and while it hands back, the flat map's once it has gone.
   */
  zoomBy: (delta: number) => boolean
  /** Escape: back to the flat map, from an open globe or one on its way up, which turns back; swallowed while it goes. */
  escape: () => boolean
}

export type GlobeHostProps = {
  onApi: (api: HostApi) => void
  /** How the globe was first asked for, and, by the address, where it opens facing. */
  entry: GlobeEntry
  arrival?: { at: MapPosition | null }
  /** Whether the reader has asked for the globe: mounted by a pull, it may not have been yet. */
  wanted: boolean
  /** Beside the panel, or on a phone under its sheet, how far the sheet is drawn up. */
  wide: boolean
  sheet: SheetState
  liveStore: Store<LiveState>
  pull: Store<GlobePull | null>
  flat: RefObject<SceneApi | null>
  /**
   * The flat map's own look, for once the globe has gone; given what covered the map as the globe rested (a
   * phone's search and its sheet, a wide map's foot), the spot handed over lands where the globe let go of it.
   */
  look: (target: LookTarget, cover?: Insets) => void
  /** Back to the flat map, by the shell's way, which keeps the address in step. */
  leave: (request?: LeaveRequest) => void
  onCover: (covered: boolean) => void
  onSettle: (position: MapPosition) => void
  onPointer: (point: Point | null) => void
  onGesture: () => void
}

/** How long the note that the globe couldn't be drawn stays, and the hint telling a reader to keep pulling. */
const NOTE_MS = 4000
const HINT_MS = 2500

/**
 * How far up from the map's bottom edge its foot reaches (the readouts and
 * the What's-on strip, kept by the shell under `data-globe-foot`): what a
 * globe beside a wide map rests clear of. Nothing, where there's no foot.
 */
function footOf(foot: HTMLElement | null): number {
  const map = foot?.parentElement
  if (!foot || !map || !foot.offsetHeight) return 0
  return Math.max(0, map.getBoundingClientRect().bottom - foot.getBoundingClientRect().top)
}

export function GlobeHost({
  onApi: giveApi,
  entry: firstEntry,
  arrival,
  wanted,
  wide,
  sheet,
  liveStore,
  pull,
  flat,
  look,
  leave,
  onCover,
  onSettle,
  onPointer,
  onGesture,
}: GlobeHostProps) {
  // A click on the globe opens what it found as the rest of the map does.
  const { select, openSiege } = useMaps()
  // The globe itself, mounted while it's wanted and a while after; how it opens; where it faces on arrival.
  const [mounted, setMounted] = useState(true)
  const [entry, setEntry] = useState(firstEntry)
  const [opening, setOpening] = useState(arrival ?? null)
  // What the screen reader is told as the globe comes and goes: set only as it does, the line itself already on the page.
  const [said, setSaid] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const api = useRef<GlobeApi | null>(null)
  const phase = useRef<GlobePhase>('closed')
  const after = useRef<LookTarget | null>(null)
  const linger = useRef(0)
  const noteTimer = useRef(0)
  const isMounted = useRef(mounted)
  useEffect(() => {
    isMounted.current = mounted
  }, [mounted])
  useEffect(
    () => () => {
      window.clearTimeout(linger.current)
      window.clearTimeout(noteTimer.current)
    },
    [],
  )

  // Gone after lingering, the globe is mounted again by the first pull past the flat map's farthest zoom, to follow it.
  useEffect(
    () =>
      pull.subscribe(() => {
        const next = pull.get()
        if (isMounted.current || next?.phase !== 'move' || next.levels <= 0) return
        isMounted.current = true
        window.clearTimeout(linger.current)
        setEntry('pull')
        setOpening(null)
        setMounted(true)
      }),
    [pull],
  )

  // Beside a wide map the globe rests clear of the map's foot, measured as it changes (the What's-on strip folds,
  // or stacks under the readouts on a narrower map); on a phone it sits in what the sheet leaves of the screen,
  // and with the sheet drawn all the way up, it isn't drawn at all.
  const [foot, setFoot] = useState(() => footOf(document.querySelector<HTMLElement>('[data-globe-foot]')))
  useEffect(() => {
    const element = document.querySelector<HTMLElement>('[data-globe-foot]')
    if (!element) return
    const observer = new ResizeObserver(() => setFoot(footOf(element)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const insets = useMemo<Insets>(
    () =>
      wide
        ? { top: 0, bottom: foot }
        : { top: 64, bottom: sheet === 'half' ? window.innerHeight * 0.5 : 76 },
    [wide, sheet, foot],
  )

  /** Whether the globe is up, or on its way up or down: not closed, nor only following a pull. */
  const up = () => phase.current !== 'closed' && phase.current !== 'pulling'
  const hostApi = useMemo(
    (): HostApi => ({
      enter: (next) => {
        window.clearTimeout(linger.current)
        after.current = null
        setEntry(next)
        if (api.current) return api.current.enter(next)
        // Gone after lingering: mounted afresh, facing the flat map's spot.
        setOpening(null)
        setMounted(true)
      },
      leave: (request) => {
        after.current = request?.to ?? null
        if (api.current && phase.current !== 'closed') return api.current.leave(request)
        // Not drawn yet, its code still compiling: nothing to hand back from.
        after.current = null
        setMounted(false)
        onCover(false)
        if (request?.to) look(request.to)
      },
      look: (target, stay) => {
        if (!up()) return false
        if (phase.current === 'leaving') after.current = target
        else if (stay) api.current?.face(target)
        else leave({ to: target })
        return true
      },
      zoomBy: (delta) => {
        if (!up()) return false
        api.current?.zoomBy(delta)
        return true
      },
      escape: () => {
        if (!up()) return false
        if (phase.current !== 'leaving') leave()
        return true
      },
    }),
    [look, onCover, leave],
  )
  useEffect(() => giveApi(hostApi), [giveApi, hostApi])

  const onApi = useCallback((next: GlobeApi) => {
    api.current = next
  }, [])
  const onPhase = useCallback((next: GlobePhase) => {
    phase.current = next
    // However it was opened, the first time or again, by hand or by the address, and however it goes.
    if (next === 'opening') setSaid('Showing the world as a globe')
    else if (next === 'leaving') setSaid('Back to the flat map')
  }, [])
  /** A click on the globe lands on the flat map there, and opens what was clicked, if anything was. */
  const onPick = useCallback(
    (pick: GlobePick) => {
      if (pick.siege) return openSiege(pick.siege)
      leave({ to: pick.target })
      if (pick.selection !== undefined) select(pick.selection)
    },
    [openSiege, leave, select],
  )
  /**
   * Gone: the flat map looks where it was asked to, from where the globe let go, in what the globe rested in (on a
   * phone between the search and the sheet, as far up as it is now), and the globe lingers a while, hidden, should
   * it be wanted again.
   */
  const onClosed = useCallback(() => {
    const target = after.current
    after.current = null
    if (target) look(target, insets)
    window.clearTimeout(linger.current)
    linger.current = window.setTimeout(() => {
      api.current = null
      setMounted(false)
    }, GLOBE.lingerMs)
  }, [look, insets])
  /**
   * The globe can't be drawn: the flat map beneath it carries on as it was,
   * and the reader who asked for it is told why nothing came. A browser
   * that can't draw it at all isn't offered it again this session, button
   * and all; a context lost and not given back may be had afresh, so the
   * button stays for another try.
   */
  const onFail = useCallback(
    (reason: 'webgl' | 'lost' | 'shader' | 'error') => {
      const gone = reason !== 'lost'
      // Focus on the globe's button, should it go with the globe, or on the globe itself, moves first to what
      // stays: the zoom out beside the button, or the flat map.
      const focused = document.activeElement
      const button = focused?.closest('.az-globe-button')
      if (button && gone) button.previousElementSibling?.querySelector<HTMLElement>('button:last-child')?.focus()
      else if (focused?.closest('.az-globe')) flat.current?.focus()
      // Unmounting the globe lifts any veil it laid over the flat map (./Globe.tsx → dispose).
      if (gone) markGlobeBroken()
      api.current = null
      phase.current = 'closed'
      // Back to the flat map by the shell's way, which keeps the button and the address in step, and looks
      // where the flat map was to look once the globe had gone. A globe that fails as it's made fails before
      // the shell has been handed this keeper's api, so it's handed it first, for the way back to run through.
      const target = after.current
      giveApi(hostApi)
      leave(target ? { to: target } : undefined)
      if (entry === 'pull') return
      window.clearTimeout(noteTimer.current)
      setNote(
        reason === 'webgl' || reason === 'shader'
          ? 'This browser can’t draw the globe.'
          : 'The globe couldn’t be drawn just now.',
      )
      noteTimer.current = window.setTimeout(() => setNote(null), NOTE_MS)
    },
    [entry, flat, leave, giveApi, hostApi],
  )
  /** Lost while lingering closed: let go of quietly, as when the lingering ends, and mounted afresh when next wanted. */
  const onGone = useCallback(() => {
    window.clearTimeout(linger.current)
    api.current = null
    phase.current = 'closed'
    setMounted(false)
  }, [])
  /** A pull that fell short: the reader is told, over the map, that the globe is further on. */
  const [hint, setHint] = useState(false)
  const hintTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(hintTimer.current), [])
  const onHint = useCallback(() => {
    window.clearTimeout(hintTimer.current)
    setHint(true)
    hintTimer.current = window.setTimeout(() => setHint(false), HINT_MS)
  }, [])

  // The notes hang from the column of the map's controls, which the shell marks for them; mounted only in the browser, after the shell.
  const [slot] = useState(() => document.querySelector<HTMLElement>('[data-globe-notes]'))
  return (
    <>
      {mounted ? (
        <GlobeFrame onFail={onFail}>
          <Globe
            arrival={opening !== null}
            entry={entry}
            flat={flat}
            hidden={!wide && sheet === 'full'}
            initial={opening?.at ?? null}
            insets={insets}
            liveStore={liveStore}
            onApi={onApi}
            onClosed={onClosed}
            onCover={onCover}
            onFail={onFail}
            onGone={onGone}
            onHint={onHint}
            onLeave={leave}
            onPhase={onPhase}
            onPick={onPick}
            onPointer={onPointer}
            onSettle={onSettle}
            onGesture={onGesture}
            pull={pull}
            wanted={wanted}
          />
        </GlobeFrame>
      ) : null}
      {/* Under the controls, where the globe's button was, moving none of them, in the shell's region for notes, which is read out. */}
      {note && slot
        ? createPortal(
            <Notice live={false}>{note}</Notice>,
            slot,
          )
        : null}
      <p aria-live="polite" className="sr-only" role="status">
        {said}
      </p>
      {/* Over the map, just above its foot or a phone's sheet, without moving the controls. */}
      <p
        aria-live="polite"
        className="az-globe-hint pointer-events-none absolute left-1/2 z-[6] -translate-x-1/2 whitespace-nowrap border border-sand-300 bg-sand-50 px-3 py-1.5 font-label text-[13px] text-ink-900 shadow-[0_2px_8px_rgba(22,25,31,0.16)]"
        data-shown={hint || undefined}
        role="status"
        style={{ bottom: insets.bottom + (wide ? 8 : 36) }}
      >
        {hint ? 'Keep zooming out to see the globe.' : ''}
      </p>
    </>
  )
}
