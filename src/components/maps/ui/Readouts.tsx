'use client'

import { useState } from 'react'

import { cn } from '@/blocks/components/shared'
import type { Point } from '@/maps/geo'
import { formatDate } from '@/components/site/format'

import { Icon } from './icons'

/** Copies text and says so for a moment; quiet when the clipboard is out of reach. */
export function useCopy(): [copied: boolean, copy: (text: string) => void] {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {
        // No clipboard (an insecure context): the coordinates are on the page to select.
      })
  }
  return [copied, copy]
}

/** "/tp 4296 64 4952", with ~ for a height nobody knows. */
export const tpCommand = ([x, z]: Point, y?: number | null) =>
  `/tp ${Math.round(x)} ${y ?? '~'} ${Math.round(z)}`

/**
 * The block under the pointer (or the middle of the view, on a phone), in
 * the survey hand of the Map block, with a Copy that puts a /tp in the
 * clipboard. A live region that stays quiet: coordinates change too often
 * to be read aloud, so only the Copy speaks.
 */
export function Coordinates({
  point,
  hint,
  className,
}: {
  point: Point | null
  hint: string
  className?: string
}) {
  const [copied, copy] = useCopy()
  if (!point) return null
  const [x, z] = point.map(Math.round)
  return (
    <div
      className={cn(
        'flex items-center gap-x-3 border border-sand-300/80 bg-sand-50/90 px-2.5 py-1.5 font-mono text-[11px] tracking-[0.06em] text-ink-700 tabular-nums backdrop-blur-sm',
        className,
      )}
    >
      <span className="hidden text-ink-400 sm:inline">{hint}</span>
      <span>
        <span className="opacity-60">X</span> {x} <span className="ml-1 opacity-60">Z</span> {z}
      </span>
      <button
        aria-label={`Copy ${tpCommand([x, z])}`}
        className="inline-flex items-center gap-1 text-sea-700 hover:text-sea-900 focus-visible:outline-saffron-500"
        onClick={() => copy(tpCommand([x, z]))}
        title="Copy as /tp"
        type="button"
      >
        <Icon className="h-3 w-3" name={copied ? 'check' : 'copy'} />
        <span aria-live="polite">{copied ? 'Copied' : '/tp'}</span>
      </button>
    </div>
  )
}

export type MapStatus = { online: boolean; checkedAt: string; townsReadAt: string | null }

/** Said when the Rulercraft map isn't answering: the pictures are the last saved. */
export function StatusNote({
  status,
  className,
}: {
  status: MapStatus | null
  className?: string
}) {
  if (!status || status.online) return null
  const read = formatDate(status.townsReadAt)
  return (
    <p
      className={cn(
        'flex items-center gap-2 border border-saffron-400/60 bg-saffron-100/95 px-2.5 py-1.5 text-[12px] leading-snug text-saffron-600 backdrop-blur-sm',
        className,
      )}
      role="status"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-saffron-500" />
      <span>
        The Rulercraft map isn’t answering, so this is the map as last saved
        {read ? `, towns as read on ${read}` : ''}. Azania’s own places and events are current.
      </span>
    </p>
  )
}
