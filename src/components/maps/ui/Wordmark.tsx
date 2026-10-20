import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { Crest } from '@/components/site/Crest'

/**
 * Azania Maps' name, set as the Gazette sets the nation's: the crest and
 * inscriptional capitals. On /maps it heads the panel; in an article's
 * Map block it is the small mark in the corner (./Mark.tsx).
 */
export function Wordmark({ className, small = false }: { className?: string; small?: boolean }) {
  return (
    <Link
      className={cn(
        'group inline-flex items-center gap-2.5 text-sea-900 focus-visible:outline-saffron-500',
        className,
      )}
      href="/maps"
    >
      <Crest
        className={cn(
          'w-auto shrink-0 text-sea-800 transition-colors group-hover:text-sea-600',
          small ? 'h-5' : 'h-8',
        )}
      />
      <span className="flex flex-col">
        <span
          className={cn(
            'font-mark uppercase leading-none tracking-[0.3em]',
            small ? 'text-[11px]' : 'text-base',
          )}
        >
          Azania<span className="text-saffron-600"> Maps</span>
        </span>
        {!small ? (
          <span className="mt-1 text-[9px] uppercase leading-none tracking-[0.22em] text-ink-400">
            The Nation, charted
          </span>
        ) : null}
      </span>
    </Link>
  )
}
