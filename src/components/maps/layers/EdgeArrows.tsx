'use client'

import { useEffect, useState } from 'react'

import type { PlayerSide } from '@/maps/battle'
import { spoken } from '@/maps/data'
import type { LivePlayer } from '@/maps/players'

import { useLatest, type Store } from '../hooks'
import { L, toLatLng, useLeaflet } from '../leaflet/canvas'
import type { LiveState } from '../live'
import { Head } from '../ui/Head'
import { Hint } from '../ui/Hint'
import type { Allegiance } from '../warView'

/**
 * The fighters off the edge of the map, in the war view: for each player
 * of either side of the siege the view is on who stands beyond the page
 * (and for the one being watched, whatever their side), a small marker
 * on the map's border pointing their way, with their head, a chevron in
 * their side's colour (an ally's head in a dashed ring of it, whose ally in
 * the tooltip) and how far they are from the middle of the view.
 * The nearest first, at most a few, so a panned-away map says where the
 * fight went without a crowd; placed again as the map moves, by one
 * handler on the map's own events, and never while nobody is off the edge.
 */

/** How many are marked at most, the nearest first; the watched player always. */
const MOST = 8
/** The markers sit this far inside the map's edge, clear of the controls' column on the right. */
const INSET = { top: 28, right: 28, bottom: 28, left: 28 }

type Arrow = { name: string; side: PlayerSide | null; allyOf: string | null; x: number; y: number; angle: number; blocks: number; watched: boolean }

export function EdgeArrows({
  store,
  allegiance,
  watch,
  onPick,
}: {
  store: Store<LiveState>
  /** A player's part in the view's siege: their side, and whose ally they are. */
  allegiance: (name: string) => Allegiance | null
  watch: string | null
  onPick: (name: string) => void
}) {
  const { map } = useLeaflet()
  const [arrows, setArrows] = useState<Arrow[]>([])
  // The players are read from the store as each placing runs, so a poll places the arrows and re-renders nothing else.
  const sideRef = useLatest(allegiance)
  const watchRef = useLatest(watch)

  useEffect(() => {
    let frame = 0
    const place = () => {
      frame = 0
      const { players } = store.get()
      const side = sideRef.current
      const watched = watchRef.current
      const size = map.getSize()
      const centre = L.point(size.x / 2, size.y / 2)
      const box = { left: INSET.left, right: size.x - INSET.right, top: INSET.top, bottom: size.y - INSET.bottom }
      const found: (Arrow & { distance: number })[] = []
      const middle = map.containerPointToLatLng(centre)
      for (const player of players as LivePlayer[]) {
        const part = side(player.name)
        const theirSide = part?.side ?? null
        const isWatched = watched !== null && player.name.toLowerCase() === watched.toLowerCase()
        if (!isWatched && theirSide !== 'attackers' && theirSide !== 'defenders') continue
        const p = map.latLngToContainerPoint(toLatLng([player.x, player.z]))
        if (p.x >= 0 && p.x <= size.x && p.y >= 0 && p.y <= size.y) continue
        // Where the line from the middle to the player crosses the inset box.
        const dx = p.x - centre.x
        const dy = p.y - centre.y
        const scale = Math.min(
          dx > 0 ? (box.right - centre.x) / dx : dx < 0 ? (box.left - centre.x) / dx : Infinity,
          dy > 0 ? (box.bottom - centre.y) / dy : dy < 0 ? (box.top - centre.y) / dy : Infinity,
        )
        const x = centre.x + dx * scale
        const y = centre.y + dy * scale
        const blocks = Math.round(Math.hypot(player.x - middle.lng, player.z - middle.lat))
        found.push({ name: player.name, side: theirSide, allyOf: part?.allyOf ?? null, x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI, blocks, watched: isWatched, distance: Math.hypot(dx, dy) })
      }
      found.sort((a, b) => Number(b.watched) - Number(a.watched) || a.distance - b.distance)
      setArrows(spread(found.slice(0, MOST), box))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place)
    }
    map.on('move zoom viewreset resize', schedule)
    schedule()
    const unsubscribe = store.subscribe(schedule)
    return () => {
      map.off('move zoom viewreset resize', schedule)
      unsubscribe()
      cancelAnimationFrame(frame)
    }
  }, [map, store, sideRef, watchRef])
  // The sides or the watched player changed: placed again.
  useEffect(() => {
    map.fire('viewreset')
  }, [map, allegiance, watch])

  if (!arrows.length) return null
  return (
    <div aria-label="Fighters off the edge of the map" className="pointer-events-none absolute inset-0 z-[480]">
      {arrows.map((arrow) => (
        <Hint
          described={false}
          key={arrow.name}
          text={`${arrow.name}: ${arrow.blocks.toLocaleString('en-GB')} blocks from the middle of the view${arrow.allyOf ? ` · ally of ${spoken(arrow.allyOf)}` : ''}`}
        >
          <button
            aria-label={`${arrow.name}${arrow.allyOf ? `, ally of ${spoken(arrow.allyOf)}` : ''}, ${arrow.blocks.toLocaleString('en-GB')} blocks that way`}
            className={cn('az-edge pointer-events-auto', arrow.side ? `az-edge-${arrow.side}` : null, arrow.allyOf ? 'az-edge-ally' : null)}
            data-watched={arrow.watched ? '' : undefined}
            onClick={() => onPick(arrow.name)}
            style={{ transform: `translate(${arrow.x.toFixed(0)}px, ${arrow.y.toFixed(0)}px) translate(-50%, -50%)` }}
            type="button"
          >
            <span aria-hidden="true" className="az-edge-chevron" style={{ transform: `rotate(${arrow.angle.toFixed(0)}deg)` }} />
            <Head name={arrow.name} px={22} />
            <span className="az-edge-blocks">{arrow.blocks >= 10_000 ? `${Math.round(arrow.blocks / 1000)}k` : arrow.blocks.toLocaleString('en-GB')}</span>
          </button>
        </Hint>
      ))}
    </div>
  )
}

/** Two markers on one edge keep at least this far apart along it. */
const GAP = 40

/**
 * Markers that land on the same edge near one another are spread along
 * it, each kept at least a gap from the last, so a side's fighters
 * gathered the same way read as a row rather than a pile.
 */
function spread<T extends { x: number; y: number }>(arrows: T[], box: { left: number; right: number; top: number; bottom: number }): T[] {
  const edgeOf = (arrow: T) => (arrow.x <= box.left + 1 ? 'left' : arrow.x >= box.right - 1 ? 'right' : arrow.y <= box.top + 1 ? 'top' : 'bottom')
  const out = arrows.map((arrow) => ({ ...arrow }))
  for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
    const vertical = edge === 'left' || edge === 'right'
    const along = vertical ? 'y' : 'x'
    const low = vertical ? box.top : box.left
    const high = vertical ? box.bottom : box.right
    const here = out.filter((arrow) => edgeOf(arrow) === edge).sort((a, b) => a[along] - b[along])
    // Pushed apart from the first, then pulled back within the edge from the last.
    for (let i = 1; i < here.length; i++) here[i][along] = Math.max(here[i][along], here[i - 1][along] + GAP)
    for (let i = here.length - 1; i >= 0; i--) {
      const limit = i === here.length - 1 ? high : here[i + 1][along] - GAP
      here[i][along] = Math.min(here[i][along], limit)
    }
    for (const arrow of here) arrow[along] = Math.max(low, arrow[along])
  }
  return out
}

/** Joins class names, as the map's components do; here so the layer imports nothing of the site's blocks. */
function cn(...classes: (string | null | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
