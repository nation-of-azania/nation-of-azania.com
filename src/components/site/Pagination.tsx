import Link from 'next/link'

import { cn } from '@/blocks/components/shared'

/** Each design's pagination colours: the row's rule, its links and the dead ends. */
const TONES = {
  gazette: {
    rule: 'border-sand-300',
    link: 'text-sea-700 hover:text-sea-600',
    muted: 'text-ink-400/60',
    count: 'text-ink-500',
  },
  times: {
    rule: 'border-news-200',
    link: 'text-cinnabar-700 hover:text-cinnabar-800',
    muted: 'text-news-300',
    count: 'text-news-500',
  },
  international: {
    rule: 'border-paper-200',
    link: 'text-verdigris-700 hover:text-verdigris-800',
    muted: 'text-paper-300',
    count: 'font-mono text-graphite-500',
  },
} as const

type PaginationProps = {
  page: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
  /** The URL of a page of the listing. */
  hrefFor: (page: number) => string
  tone?: keyof typeof TONES
}

/**
 * Restrained pagination row for the archives: Prev / "Page N of M" / Next,
 * as plain links against a hairline rule. Renders nothing for a single page.
 */
export function Pagination({
  page,
  totalPages,
  hasPrevPage,
  hasNextPage,
  hrefFor,
  tone = 'gazette',
}: PaginationProps) {
  if (totalPages <= 1) return null

  const tones = TONES[tone]
  const prevHref = hrefFor(page - 1)
  const nextHref = hrefFor(page + 1)
  const linkClasses = cn('text-sm font-medium transition-colors', tones.link)
  const mutedClasses = cn('select-none text-sm', tones.muted)

  return (
    <nav
      aria-label="Archive pages"
      className={cn('mt-14 flex items-center justify-between gap-6 border-t pt-6', tones.rule)}
    >
      {hasPrevPage ? (
        <Link rel="prev" href={prevHref} className={linkClasses}>
          ← Previous
        </Link>
      ) : (
        <span aria-hidden="true" className={mutedClasses}>
          ← Previous
        </span>
      )}
      <span className={cn('text-[11px] uppercase tracking-[0.2em]', tones.count)}>
        Page {page} of {totalPages}
      </span>
      {hasNextPage ? (
        <Link rel="next" href={nextHref} className={linkClasses}>
          Next →
        </Link>
      ) : (
        <span aria-hidden="true" className={mutedClasses}>
          Next →
        </span>
      )}
    </nav>
  )
}
