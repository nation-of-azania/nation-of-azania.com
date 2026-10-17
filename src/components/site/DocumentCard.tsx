import Link from 'next/link'

import type { Article } from '@/payload-types'

import { GazetteCredit } from './GazetteByline'
import { Seal } from './Seal'
import { articleHref, formatDate, resolveByline } from './format'

/**
 * A document-like card for pinned articles — the charter and standing
 * decrees shown under "Documents of State" on the homepage. The foot names
 * the signatory and the date of entry, as a register would.
 */
export function DocumentCard({ article }: { article: Article }) {
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)
  const href = articleHref(article)
  const byline = resolveByline(article)

  return (
    <article className="group relative flex flex-col border border-sand-300 bg-sand-100 p-6 transition-colors hover:border-saffron-400">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-coral-700">
        <Seal className="h-3.5 w-3.5 shrink-0" />
        Pinned · Document of State
      </p>
      <h3 className="mt-3.5 font-display text-xl leading-snug text-ink-900">
        <Link
          href={href}
          className="transition-colors after:absolute after:inset-0 hover:text-sea-800 group-hover:text-sea-800"
        >
          {article.title}
        </Link>
      </h3>
      {article.excerpt ? (
        <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-ink-500">
          {article.excerpt}
        </p>
      ) : null}
      {byline || date ? (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-5">
          {byline ? <GazetteCredit byline={byline} /> : null}
          {date ? (
            <p className="text-xs text-ink-400">
              Entered <time dateTime={dateTime}>{date}</time>
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
