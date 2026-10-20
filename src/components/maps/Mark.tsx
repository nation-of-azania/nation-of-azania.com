import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { Crest } from '@/components/site/Crest'

/**
 * The small mark in the corner of a map shown elsewhere — an article's Map
 * block — that says what it is and opens Azania Maps at the same spot, as
 * an embedded map links to its maker. Whitewash on a hairline, so it reads
 * on any ground and never looks like part of the terrain.
 */
export function MapsMark({ href, className }: { href: string; className?: string }) {
  return (
    <Link
      className={cn(
        'absolute bottom-2 right-2 z-10 inline-flex items-center gap-1.5 border border-sand-300/80 bg-sand-50/95 py-1 pl-1.5 pr-2 font-mark text-[10px] uppercase leading-none tracking-[0.22em] text-sea-900 shadow-[0_1px_2px_rgba(22,25,31,0.12)] backdrop-blur-sm transition-colors hover:bg-sand-50 hover:text-sea-700 focus-visible:outline-saffron-500',
        className,
      )}
      href={href}
      title="Open on Azania Maps"
    >
      <Crest className="h-3.5 w-auto text-sea-800" />
      <span>
        Azania <span className="text-saffron-600">Maps</span>
      </span>
    </Link>
  )
}
