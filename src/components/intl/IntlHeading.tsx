import type { ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'

type Props = {
  /** id placed on the h2 so sections can use aria-labelledby. */
  id: string
  label: string
  /** Optional right-aligned action, e.g. "The full register →". */
  action?: ReactNode
  className?: string
}

/** A register heading: a mono label on a graphite rule, the way a ledger heads a column. */
export function IntlHeading({ id, label, action, className }: Props) {
  return (
    <div className={cn('flex items-end justify-between gap-6 border-b border-graphite-900 pb-2', className)}>
      <h2 id={id} className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite-700">
        {label}
      </h2>
      {action}
    </div>
  )
}

/** The quiet link beside a heading. */
export const INTL_ACTION =
  'text-sm font-medium text-verdigris-700 transition-colors hover:text-verdigris-800'
