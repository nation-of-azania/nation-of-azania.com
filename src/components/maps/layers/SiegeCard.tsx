'use client'

import { useEffect, useRef } from 'react'

import { siegeHeadline, siegeTitle, type SiegeSide } from '@/maps/sieges'
import type { MapSelection } from '@/maps/url'
import type { Siege } from '@/maps/world'

import { useLatest } from '../hooks'
import { L, toLatLng, useLeaflet } from '../leaflet/canvas'
import { Icon } from '../ui/icons'
import { SiegeBadge, SiegeFigures } from '../ui/Siege'

/**
 * A siege's card, beside its banner on the map: the title, Azania's part in
 * it in a line, and its figures in plain words, with the way to the town
 * besieged. It follows the banner as the map moves (to the right, else the
 * left, else below), and closes on Escape, a click on the map, or its ×.
 */
export function SiegeCard({
  siege,
  side,
  town,
  onClose,
  onOpen,
}: {
  siege: Siege
  side: SiegeSide
  /** The besieged town's page, when it's on the map. */
  town: MapSelection | null
  onClose: () => void
  onOpen: (selection: MapSelection) => void
}) {
  const { map } = useLeaflet()
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useLatest(onClose)

  useEffect(() => {
    const card = ref.current
    if (!card) return
    L.DomEvent.disableClickPropagation(card)
    L.DomEvent.disableScrollPropagation(card)
    const place = () => {
      const p = map.latLngToContainerPoint(toLatLng(siege.at))
      const size = map.getSize()
      const width = card.offsetWidth
      const height = card.offsetHeight
      const margin = 8
      const gap = 22
      // Kept within the map's height; the nib points at the banner however the card is nudged.
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
    const hide = () => (card.style.visibility = 'hidden')
    const show = () => {
      card.style.visibility = ''
      place()
    }
    const close = () => onCloseRef.current()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    // A viewreset is the map re-based a world over (leaflet/home.ts): the banner stands again, so the card follows.
    map.on('move zoom viewreset resize', place)
    map.on('zoomstart', hide)
    map.on('zoomend', show)
    map.on('click', close)
    window.addEventListener('keydown', onKey)
    place()
    return () => {
      map.off('move zoom viewreset resize', place)
      map.off('zoomstart', hide)
      map.off('zoomend', show)
      map.off('click', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [map, siege, onCloseRef])

  return (
    <div
      aria-label={siegeTitle(siege)}
      className="az-chip az-siege-card pointer-events-auto absolute left-0 top-0 z-[500] w-72 border border-sand-300 bg-sand-50 text-ink-900 shadow-[0_2px_8px_rgba(22,25,31,0.18)]"
      data-side="right"
      ref={ref}
      role="dialog"
    >
      <div className="flex items-start gap-2.5 px-3 pt-2.5">
        <SiegeBadge className="mt-0.5 h-7 w-7" side={side} siege={siege} />
        <div className="min-w-0 flex-1">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-coral-700">
            {siege.battle ? 'Siege · a battle on' : 'Siege · quiet'}
          </p>
          <p className="font-display text-base leading-tight text-sea-950">{siegeTitle(siege)}</p>
          {side ? (
            <p className="mt-0.5 text-[12px] font-semibold leading-snug text-coral-700">{siegeHeadline(siege, side)}</p>
          ) : null}
        </div>
        <button
          aria-label="Close"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center text-ink-500 hover:text-sea-900 focus-visible:outline-saffron-500"
          onClick={onClose}
          type="button"
        >
          <Icon className="h-3.5 w-3.5" name="close" />
        </button>
      </div>
      {/* The figures scroll within a short map; the card's nib stays outside the scroll. */}
      <div className="max-h-[min(22rem,calc(100vh-14rem))] overflow-y-auto">
        <SiegeFigures className="mt-1.5 border-t border-sand-300/70 px-3 py-2" siege={siege} />
      </div>
      {town ? (
        <p className="border-t border-sand-300/70 px-3 py-2 text-[12px]">
          <button
            className="text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
            onClick={() => onOpen(town)}
            type="button"
          >
            Open the town besieged
          </button>
        </p>
      ) : null}
    </div>
  )
}
