import Link from 'next/link'

import type { Article } from '@/payload-types'

import { articleHref, formatDate } from './format'

/** A small oxide wax-seal mark for pinned documents of state. */
function Seal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={className}>
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="6" cy="6" r="2.2" fill="currentColor" />
    </svg>
  )
}

/**
 * A document-like card for pinned articles — the charter and standing
 * decrees shown under "Documents of State" on the homepage.
 */
export function DocumentCard({ article }: { article: Article }) {
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)
  const href = articleHref(article)

  return (
    <article className="group relative flex flex-col border border-parchment-300 bg-parchment-100 p-6 transition-colors hover:border-gold-400">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-oxide-700">
        <Seal className="h-3.5 w-3.5 shrink-0" />
        Pinned · Document of State
      </p>
      <h3 className="mt-3.5 font-display text-xl leading-snug text-ink-900">
        <Link
          href={href}
          className="transition-colors after:absolute after:inset-0 hover:text-pine-800 group-hover:text-pine-800"
        >
          {article.title}
        </Link>
      </h3>
      {article.excerpt ? (
        <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-ink-500">
          {article.excerpt}
        </p>
      ) : null}
      {date ? (
        <p className="mt-auto pt-5 text-xs text-ink-400">
          Entered <time dateTime={dateTime}>{date}</time>
        </p>
      ) : null}
    </article>
  )
}
