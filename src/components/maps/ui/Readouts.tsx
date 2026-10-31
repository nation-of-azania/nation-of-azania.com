'use client'

import { useState } from 'react'

import { cn } from '@/blocks/components/shared'
import { spoken, type MapTown } from '@/maps/data'
import { formatDate } from '@/components/site/format'

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
        // No clipboard (an insecure context): the command is on the page to select.
      })
  }
  return [copied, copy]
}

/** Said of a spawn only its residents may use. */
export const privateSpawnNote = (town: Pick<MapTown, 'name'>): string =>
  `${spoken(town.name)}’s spawn is private: only its residents can use it.`

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
        'flex items-center gap-2 border border-saffron-400/60 bg-saffron-100/95 px-2.5 py-1.5 text-[13px] leading-snug text-saffron-600',
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
