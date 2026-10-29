'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import type { MapData } from '@/maps/data'

import type { EmbedSceneProps } from './EmbedScene'
import type { Subject } from '../layers/SubjectLayer'
import type { Frame } from '../still/Still'

/**
 * The live map, loaded only in the browser and only once the figure nears
 * the viewport; until then, and wherever it fails, the still picture stands.
 */
const EmbedScene = dynamic<EmbedSceneProps>(
  () => import('./EmbedScene').then((module) => module.EmbedScene),
  {
    ssr: false,
  },
)

type Props = {
  frame: Frame
  data: MapData
  now: number
  /** Where the mark leads: Azania Maps, at this spot. */
  href: string
  /** What the still drew of its own, for the live map to keep: a town block's claims and pin (../layers/SubjectLayer.tsx). */
  subject?: Subject | null
  /** The still, shown until the map is up. */
  children: ReactNode
}

/**
 * An article's map that readers can move: the still first (server-rendered,
 * there before any script), the live map faded in over it when the reader
 * scrolls near, starting from the same frame, with whatever the still drew
 * of its own. The wheel doesn't zoom it, so a page scroll never gets
 * caught; the buttons and pinching do.
 */
export function MapEmbed({ frame, data, now, href, subject, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'still' | 'loading' | 'live' | 'failed'>('still')

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const near = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPhase((current) => (current === 'still' ? 'loading' : current))
          near.disconnect()
        }
      },
      { rootMargin: '400px' },
    )
    near.observe(element)
    return () => near.disconnect()
  }, [])

  const live = phase === 'live'
  return (
    <div className="relative h-full w-full" ref={ref}>
      <div
        aria-hidden={live || undefined}
        className={cn(
          'absolute inset-0 transition-opacity duration-500',
          live && 'pointer-events-none opacity-0',
        )}
      >
        {children}
      </div>
      {phase === 'loading' || live ? (
        <EmbedScene
          className={cn(
            'absolute inset-0 transition-opacity duration-500',
            live ? 'opacity-100' : 'opacity-0',
          )}
          data={data}
          frame={frame}
          href={href}
          now={now}
          onReady={() => setPhase('live')}
          subject={subject}
        />
      ) : null}
    </div>
  )
}
