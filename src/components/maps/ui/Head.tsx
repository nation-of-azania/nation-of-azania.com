'use client'

import { useState, type CSSProperties } from 'react'

import { cn } from '@/blocks/components/shared'
import { minecraftHeadUrl } from '@/components/site/format'
import { isBedrockName } from '@/maps/players'

/**
 * A player's head, wherever the map shows one: on the live players layer
 * (layers/PlayersLayer.tsx, which builds the same by hand for Leaflet's
 * markers), in a player's card, and in a town's list of residents. The
 * head is the player's monogram in an ink of its own, with the skin
 * service's face laid over it once it has arrived, so a head is never an
 * empty square: a Bedrock player (whom the skin service doesn't know), a
 * face still on its way and one that won't load all show the monogram.
 */

/**
 * A monogram's ink: one of the house's quieter colours, picked by the name
 * so a player keeps theirs, as an account's initial does in a mail app.
 * Never saffron (Azania's ring), coral (a siege) or the night sea of the
 * map's backdrop, where a monogram used to read as a hole in the map. All
 * take the whitewash letter at 4.9:1 or better.
 */
const MONOGRAM_INKS = ['#215577', '#11707d', '#357166', '#9b2f5e', '#6b5540', '#8a5a9c']

/** A player's monogram: the first letter of the name (a Bedrock player's without its dot) and its ink. */
export function monogramOf(name: string): { letter: string; ink: string } {
  const bare = name.replace(/^\./, '')
  let hash = 0
  for (const char of bare.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return { letter: bare.charAt(0).toUpperCase() || '·', ink: MONOGRAM_INKS[hash % MONOGRAM_INKS.length] }
}

/** The head in React, `px` wide: the marker's look (maps.css → .az-player-mark), at any size. */
export function Head({ name, px = 24, className }: { name: string; px?: number; className?: string }) {
  const { letter, ink } = monogramOf(name)
  const [face, setFace] = useState<'loading' | 'loaded' | 'failed'>('loading')
  return (
    <span
      aria-hidden="true"
      className={cn('az-player-mark relative shrink-0', className)}
      style={{ '--az-monogram': ink, width: px, height: px, fontSize: Math.round(px / 2), position: 'relative', left: 0, top: 0 } as CSSProperties}
    >
      {letter}
      {isBedrockName(name) || face === 'failed' ? null : (
        // eslint-disable-next-line @next/next/no-img-element -- the skin service's head, kept crisp; the marker uses the same picture
        <img
          alt=""
          className="az-player-head"
          data-loaded={face === 'loaded' ? '' : undefined}
          decoding="async"
          height={px}
          loading="lazy"
          onError={() => setFace('failed')}
          onLoad={() => setFace('loaded')}
          src={minecraftHeadUrl(name, px * 2)}
          width={px}
        />
      )}
    </span>
  )
}
