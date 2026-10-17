import type { CalloutBlockType } from '@/payload-types'

import { cn } from './shared'

type CalloutProps = Pick<CalloutBlockType, 'body' | 'style' | 'title'>

const LABELS: Record<CalloutBlockType['style'], string> = {
  decree: 'Decree',
  note: 'Note',
  warning: 'Warning',
}

/**
 * Callout — three registers of official notice.
 *
 * - note: quiet parchment panel with a pine rule
 * - decree: centered proclamation inside a double hairline gold/pine frame
 * - warning: the note panel struck in oxide red
 */
export function CalloutBlock({ style, title, body }: CalloutProps) {
  if (style === 'decree') {
    return (
      <aside className="my-10 border border-pine-800 bg-parchment-100 p-1.5" role="note">
        <div className="border border-gold-500 px-6 py-7 text-center sm:px-10">
          <p className="flex items-center justify-center gap-3 text-[0.6875rem] font-semibold tracking-[0.3em] text-gold-600 uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-gold-400" />
            {LABELS.decree}
            <span aria-hidden="true" className="h-px w-8 bg-gold-400" />
          </p>
          {title ? <p className="mt-3 font-display text-2xl text-pine-900">{title}</p> : null}
          <span aria-hidden="true" className="mx-auto mt-4 block h-1.5 w-1.5 rotate-45 bg-oxide-700" />
          <p className="mx-auto mt-4 max-w-prose text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink-700">
            {body}
          </p>
        </div>
      </aside>
    )
  }

  const isWarning = style === 'warning'

  return (
    <aside
      className={cn(
        'my-8 border-l-2 bg-parchment-100 px-5 py-4 sm:px-6',
        isWarning ? 'border-oxide-700' : 'border-pine-700',
      )}
      role="note"
    >
      <p
        className={cn(
          'text-[0.6875rem] font-semibold tracking-[0.18em] uppercase',
          isWarning ? 'text-oxide-700' : 'text-pine-700',
        )}
      >
        {LABELS[style] ?? LABELS.note}
      </p>
      {title ? (
        <p className={cn('mt-2 font-display text-lg', isWarning ? 'text-oxide-700' : 'text-pine-900')}>
          {title}
        </p>
      ) : null}
      <p className="mt-2 text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink-700">{body}</p>
    </aside>
  )
}
