import Link from 'next/link'

type PaginationProps = {
  page: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

/**
 * Restrained pagination row for the gazette index: Prev / "Page N of M" /
 * Next, as plain links against a hairline rule. Renders nothing for a single
 * page.
 */
export function Pagination({ page, totalPages, hasPrevPage, hasNextPage }: PaginationProps) {
  if (totalPages <= 1) return null

  // Page 1 keeps a clean URL without the query string.
  const prevHref = page - 1 <= 1 ? '/gov/articles' : `/gov/articles?page=${page - 1}`
  const nextHref = `/gov/articles?page=${page + 1}`
  const linkClasses = 'text-sm font-medium text-pine-700 transition-colors hover:text-pine-600'
  const mutedClasses = 'select-none text-sm text-ink-400/60'

  return (
    <nav
      aria-label="Gazette pages"
      className="mt-14 flex items-center justify-between gap-6 border-t border-parchment-300 pt-6"
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
      <span className="text-[11px] uppercase tracking-[0.2em] text-ink-500">
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
