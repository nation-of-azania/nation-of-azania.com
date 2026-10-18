import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import {
  articleHref,
  documentNumber,
  formatDate,
  resolveByline,
  sectionOf,
  typeLabel,
} from '@/components/site/format'
import type { Article } from '@/payload-types'

import { IntlCredit } from './IntlByline'

/**
 * How the registry cites a record: its type, and the number it is referred
 * to by when its title carries one ("RS-1"). Only standards and resolutions
 * are numbered; a case study is cited by its title.
 */
export function recordRef(article: Pick<Article, 'title' | 'type'>): {
  number: string | null
  type: string
} {
  const numbered = article.type === 'standard' || article.type === 'resolution'
  return { number: numbered ? documentNumber(article.title) : null, type: typeLabel(article) }
}

/** The verb the registry dates a record by. */
export const dateLabelOf = (article: Pick<Article, 'type'>): string =>
  article.type === 'resolution' ? 'Adopted' : 'Published'

/** What the registry calls the person on a record. */
export const bylineLabelOf = (article: Pick<Article, 'type'>): string =>
  (
    ({
      announcement: 'From',
      standard: 'Submitted by',
      resolution: 'Entered by',
      report: 'Reported by',
      'case-study': 'Reported by',
    }) as Record<string, string>
  )[article.type] ?? 'By'

/** The reference column of a record row: a numbered badge, or the type in mono caps. */
export function RecordRef({
  article,
  className,
}: {
  article: Pick<Article, 'title' | 'type'>
  className?: string
}) {
  const { number, type } = recordRef(article)
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-graphite-500',
        className,
      )}
    >
      {number ? (
        <span className="inline-flex items-center border border-(--accent) px-1.5 py-px font-medium text-(--accent-ink)">
          {number}
        </span>
      ) : null}
      <span>{type}</span>
    </p>
  )
}

/**
 * One line of the register: reference, title and summary, where it was
 * filed (unless this is that context's own listing) and by whom, and the
 * date in the margin. The whole row is clickable through a stretched title
 * link.
 */
export function RecordRow({ article, within }: { article: Article; within?: number | null }) {
  const section = sectionOf(article)
  // Inside a context's own listing, naming it on every row says nothing.
  const filedElsewhere = section && section.id !== within
  const byline = resolveByline(article)
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)
  return (
    <li className="group relative grid gap-x-8 gap-y-2 border-t border-paper-200 py-5 sm:grid-cols-[8.5rem_minmax(0,1fr)] lg:grid-cols-[8.5rem_minmax(0,1fr)_10rem]">
      <RecordRef article={article} className="sm:pt-1" />
      <div className="min-w-0">
        <h3 className="font-record text-xl font-medium leading-snug text-graphite-900 md:text-[22px]">
          <Link
            href={articleHref(article)}
            className="transition-colors after:absolute after:inset-0 group-hover:text-verdigris-700"
          >
            {article.title}
          </Link>
        </h3>
        {article.excerpt ? (
          <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed text-graphite-700">
            {article.excerpt}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-graphite-500">
          {filedElsewhere ? <span>{section.name}</span> : null}
          {byline ? <IntlCredit byline={byline} /> : null}
          {article.pinned ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-verdigris-700">
              Pinned
            </span>
          ) : null}
        </div>
      </div>
      {date ? (
        <p className="font-mono text-xs text-graphite-500 sm:col-start-2 lg:col-start-3 lg:pt-1 lg:text-right">
          <time dateTime={dateTime}>{date}</time>
        </p>
      ) : null}
    </li>
  )
}

/** A run of record rows, closed by a rule; or the empty line a design passes. */
export function RecordList({
  articles,
  empty,
  within,
  className,
}: {
  articles: Article[]
  empty: string
  /** The context whose own listing this is: its name is left off its rows. */
  within?: number | null
  className?: string
}) {
  return articles.length > 0 ? (
    <ol className={cn('border-b border-paper-200', className)}>
      {articles.map((article) => (
        <RecordRow key={article.id} article={article} within={within} />
      ))}
    </ol>
  ) : (
    <p className={cn('border-y border-paper-200 py-8 text-sm text-graphite-500', className)}>{empty}</p>
  )
}
