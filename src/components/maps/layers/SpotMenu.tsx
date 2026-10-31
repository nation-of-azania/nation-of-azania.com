'use client'

import { useEffect, useRef, useState } from 'react'

import { SPRINT_BLOCKS_PER_S } from '@/maps/battle'
import { spoken, type MapData } from '@/maps/data'
import type { Point } from '@/maps/geo'
import { spawnRoute } from '@/maps/spawn'
import { inWorld } from '@/maps/source'
import type { Siege } from '@/maps/world'

import { useMaps } from '../context'
import { L, toPoint, useLeaflet } from '../leaflet/canvas'
import { Icon } from '../ui/icons'
import { privateSpawnNote, useCopy } from '../ui/Readouts'
import { clockOf } from '../warView'

/**
 * A spot on the map, asked about: a right click (a long press on a phone)
 * opens a small card there with the block's coordinates, as F3 shows
 * them, to copy; the way there as a player has it, the nearest town's
 * `/t spawn` and the walk from it (src/maps/spawn.ts), to copy; in the war
 * view, how far the spot is from the banner of the siege the view is on,
 * and the sprint; and a way to centre the map there. It closes on a click
 * on the map, a move, Escape or its ×. Nothing in an echo of the world,
 * which is nowhere a player can stand. The map's foot used to read the
 * block under the pointer out all the time; it's asked for now.
 */
export function SpotMenu({ data, siege }: { data: MapData; siege: Siege | null }) {
  const { map } = useLeaflet()
  const { look } = useMaps()
  const [spot, setSpot] = useState<Point | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [copied, copy] = useCopy()
  const [copiedWay, copyWay] = useCopy()

  useEffect(() => {
    const open = (event: L.LeafletMouseEvent) => {
      const point = toPoint(event.latlng)
      if (!inWorld(point)) return
      L.DomEvent.preventDefault(event.originalEvent)
      setSpot([Math.round(point[0]), Math.round(point[1])])
    }
    map.on('contextmenu', open)
    return () => {
      map.off('contextmenu', open)
    }
  }, [map])

  // Placed beside the spot, to the right, else the left, else below, and kept there as the map moves; gone when it does much.
  useEffect(() => {
    const card = ref.current
    if (!spot || !card) return
    L.DomEvent.disableClickPropagation(card)
    L.DomEvent.disableScrollPropagation(card)
    const place = () => {
      const p = map.latLngToContainerPoint(L.latLng(spot[1], spot[0]))
      const size = map.getSize()
      const width = card.offsetWidth
      const height = card.offsetHeight
      const margin = 8
      const gap = 14
      const top = Math.min(Math.max(p.y - height / 2, margin), Math.max(margin, size.y - height - margin))
      card.style.setProperty('--az-nib-y', `${p.y - top}px`)
      if (p.x + gap + width <= size.x - margin) {
        card.dataset.side = 'right'
        card.style.transform = `translate(${p.x + gap}px, ${top}px)`
      } else if (p.x - gap - width >= margin) {
        card.dataset.side = 'left'
        card.style.transform = `translate(${p.x - gap - width}px, ${top}px)`
      } else {
        card.dataset.side = 'below'
        const x = Math.min(Math.max(p.x - width / 2, margin), size.x - width - margin)
        card.style.setProperty('--az-nib', `${p.x - x}px`)
        card.style.transform = `translate(${x}px, ${p.y + gap}px)`
      }
    }
    const close = () => setSpot(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    map.on('move zoom viewreset resize', place)
    map.on('click zoomstart dragstart', close)
    window.addEventListener('keydown', onKey)
    place()
    return () => {
      map.off('move zoom viewreset resize', place)
      map.off('click zoomstart dragstart', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [spot, map])

  if (!spot) return null
  const [x, z] = spot
  const place = `${x} ${z}`
  const route = spawnRoute(spot, data.towns)
  const toBanner = siege ? Math.round(Math.hypot(x - siege.at[0], z - siege.at[1])) : null
  return (
    <div
      aria-label={`The spot at ${x}, ${z}`}
      className="az-chip az-siege-card pointer-events-auto absolute left-0 top-0 z-[500] w-72 max-w-[calc(100%-1rem)] border border-sand-300 bg-sand-50 text-ink-900 shadow-[0_2px_8px_rgba(22,25,31,0.18)]"
      data-side="right"
      ref={ref}
      role="dialog"
    >
      <div className="flex items-start gap-2 px-3 pt-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-saffron-600">This spot</p>
          <p className="mt-0.5 flex items-baseline gap-3 font-mono text-[15px] tracking-[0.04em] text-ink-900 tabular-nums">
            <span>
              <span className="text-ink-400">X</span> {x} <span className="ml-1 text-ink-400">Z</span> {z}
            </span>
            <button
              aria-label={`Copy ${place}`}
              className="inline-flex items-center gap-1 text-[13px] text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900 focus-visible:outline-saffron-500"
              onClick={() => copy(place)}
              type="button"
            >
              <Icon className="h-3.5 w-3.5" name={copied ? 'check' : 'copy'} />
              <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </p>
        </div>
        <button
          aria-label="Close"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center text-ink-500 hover:text-sea-900 focus-visible:outline-saffron-500"
          onClick={() => setSpot(null)}
          type="button"
        >
          <Icon className="h-3.5 w-3.5" name="close" />
        </button>
      </div>
      <div className="mt-2 space-y-1.5 border-t border-sand-300/70 px-3 py-2 text-[14px] leading-snug text-ink-700">
        {route ? (
          <p>
            <span className="text-ink-500">The way there: </span>
            <button
              aria-label={`Copy ${route.command}`}
              className="inline-flex items-center gap-1 font-mono text-[13px] tracking-[0.04em] text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900 focus-visible:outline-saffron-500"
              onClick={() => copyWay(route.command)}
              title={route.town.publicSpawn === false ? privateSpawnNote(route.town) : 'Copy the command'}
              type="button"
            >
              <Icon className="h-3.5 w-3.5" name={copiedWay ? 'check' : 'copy'} />
              <span aria-live="polite">{copiedWay ? 'Copied' : route.command}</span>
            </button>
            {route.then ? <span className="text-ink-500">, {route.then}</span> : null}
            {route.town.publicSpawn === false ? <span className="block text-[13px] italic text-saffron-600">{privateSpawnNote(route.town)}</span> : null}
          </p>
        ) : null}
        {toBanner !== null && siege ? (
          <p>
            <span className="font-semibold tabular-nums">{toBanner.toLocaleString('en-GB')} blocks</span> from the banner
            {siege.town ? ` at ${spoken(siege.town)}` : ''} · a <span className="font-mono tabular-nums">{clockOf(toBanner / SPRINT_BLOCKS_PER_S)}</span> sprint
          </p>
        ) : null}
        <p>
          <button
            className="text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900 focus-visible:outline-saffron-500"
            onClick={() => {
              look({ centre: spot })
              setSpot(null)
            }}
            type="button"
          >
            Centre the map here
          </button>
        </p>
      </div>
    </div>
  )
}
