import { cn } from '@/blocks/components/shared'

import { Crest } from './Crest'

/** A small coral wax-seal mark for pinned documents of state. */
export function Seal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={className}>
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="6" cy="6" r="2.2" fill="currentColor" />
    </svg>
  )
}

/**
 * The Seal of the Nation as pressed into wax: a coral disc bearing the crest
 * in sand, ringed by the faint impression of the matrix. Closes a signed
 * document of state. Decorative — the signature beside it carries the text.
 */
export function WaxSeal({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-coral-600 text-sand-50 shadow-[inset_0_0_0_2px_rgba(251,248,241,0.3),0_1px_2px_rgba(22,25,31,0.18)] ring-2 ring-coral-600/30 ring-offset-2 ring-offset-sand-50',
        className,
      )}
    >
      <Crest className="h-9 w-auto" />
    </span>
  )
}
