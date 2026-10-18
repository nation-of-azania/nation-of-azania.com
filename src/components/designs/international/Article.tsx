import Image from 'next/image'
import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { PreviewTools } from '@/components/PreviewTools'
import { RichText } from '@/components/RichText'
import { IntlByline } from '@/components/intl/IntlByline'
import { bylineLabelOf, dateLabelOf, recordRef } from '@/components/intl/IntlRecord'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { accentStyle, formatDate, resolveByline, resolveImage } from '@/components/site/format'
import { accentOf, archiveHref, contextHref } from '@/lib/site'

import type { ArticleProps } from '../types'

const DT = 'font-mono text-[11px] uppercase tracking-[0.14em] text-graphite-500'
const DD = 'mt-1 text-sm text-graphite-900'

/**
 * A record in the register. Every record carries a details panel — its
 * reference, type, date, where it was filed and who entered it — the way a
 * registry card does. The types then set their own tone: a standard carries
 * its number as a badge and a citation; a resolution opens formally, centred
 * under its initiative; a report or case study leads with a boxed summary
 * and numbers its figures.
 */
export function Article({ article, chain, draft }: ArticleProps) {
  const top = chain[0]
  const filedIn = chain[chain.length - 1]
  const parent = chain.length > 2 ? chain[chain.length - 2] : null
  const { number, type } = recordRef(article)
  const byline = resolveByline(article)
  const hero = resolveImage(article.featuredImage, 'hero')
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)
  const formal = article.type === 'resolution'
  const report = article.type === 'report' || article.type === 'case-study'
  const citation =
    number && date ? `${number}, ${filedIn?.name ?? top?.name}, ${new Date(dateTime).getFullYear()}` : null

  return (
    <article className="mx-auto max-w-6xl px-6 py-12 md:py-16" style={accentStyle(accentOf(chain), 'slate')}>
      {draft ? <PreviewTools /> : null}
      <Breadcrumb
        chain={chain}
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite-500"
        linkClassName="transition-colors hover:text-graphite-900"
        separatorClassName="text-paper-300"
      />

      <header className={cn('mt-8 border-b-2 border-(--accent) pb-8', formal && 'text-center')}>
        {formal && filedIn ? (
          <p className="font-record text-sm italic text-graphite-500">
            A resolution of the {filedIn.name}
          </p>
        ) : null}
        <p
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em] text-graphite-500',
            formal && 'mt-3 justify-center',
          )}
        >
          {number ? (
            <span className="inline-flex items-center border border-(--accent) px-2 py-0.5 text-xs font-medium text-(--accent-ink)">
              {number}
            </span>
          ) : null}
          <span className="text-(--accent-ink)">{type}</span>
          {article.pinned ? (
            <>
              <span aria-hidden="true" className="text-paper-300">·</span>
              <span>Pinned</span>
            </>
          ) : null}
        </p>
        <h1
          className={cn(
            'mt-4 max-w-4xl text-balance font-record text-4xl font-medium leading-[1.1] tracking-tight text-graphite-900 md:text-5xl',
            formal && 'mx-auto',
          )}
        >
          {article.title}
        </h1>
        {article.excerpt && !report ? (
          <p className={cn('mt-5 max-w-3xl text-lg leading-relaxed text-graphite-700', formal && 'mx-auto')}>
            {article.excerpt}
          </p>
        ) : null}
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-16">
        {/* The registry card: first on narrow screens, in the margin on wide ones. */}
        <aside aria-label="Record details" className="lg:order-last">
          <dl className="grid gap-x-8 gap-y-4 border-t border-paper-200 pt-4 sm:grid-cols-2 lg:sticky lg:top-6 lg:grid-cols-1">
            {number ? (
              <div>
                <dt className={DT}>Reference</dt>
                <dd className={cn(DD, 'font-mono font-medium')}>{number}</dd>
              </div>
            ) : null}
            <div>
              <dt className={DT}>Type</dt>
              <dd className={DD}>{type}</dd>
            </div>
            {date ? (
              <div>
                <dt className={DT}>{dateLabelOf(article)}</dt>
                <dd className={DD}>
                  <time dateTime={dateTime}>{date}</time>
                </dd>
              </div>
            ) : null}
            {filedIn && filedIn.id !== top?.id ? (
              <div>
                <dt className={DT}>Filed in</dt>
                <dd className={DD}>
                  <Link href={contextHref(filedIn)} className="text-verdigris-700 hover:text-verdigris-800">
                    {filedIn.name}
                  </Link>
                  {parent && parent.id !== top?.id ? (
                    <span className="text-graphite-500"> · {parent.name}</span>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {byline ? (
              <div className="sm:col-span-2 lg:col-span-1">
                <dt className={DT}>{bylineLabelOf(article)}</dt>
                <dd className="mt-2">
                  <IntlByline byline={byline} />
                </dd>
              </div>
            ) : null}
            {citation ? (
              <div className="sm:col-span-2 lg:col-span-1">
                <dt className={DT}>Cite as</dt>
                <dd className={cn(DD, 'font-mono text-xs leading-relaxed text-graphite-700')}>{citation}</dd>
              </div>
            ) : null}
          </dl>
        </aside>

        <div className="min-w-0 max-w-3xl">
          {report && article.excerpt ? (
            <section aria-label="Summary" className="border-l-2 border-(--accent) bg-paper-100 px-5 py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-(--accent-ink)">Summary</p>
              <p className="mt-2 text-base leading-relaxed text-graphite-900">{article.excerpt}</p>
            </section>
          ) : null}

          {hero ? (
            <figure className={cn(report && article.excerpt ? 'mt-8' : '')}>
              <div className="border border-paper-200 bg-paper-100 p-1">
                <Image
                  src={hero.url}
                  alt={hero.alt}
                  width={hero.width}
                  height={hero.height}
                  sizes="(min-width: 1024px) 720px, 92vw"
                  priority
                  className="w-full"
                />
              </div>
              {hero.alt ? (
                <figcaption className="mt-2.5 text-xs text-graphite-500">
                  {report ? <span className="font-mono">Fig. 1 — </span> : null}
                  {hero.alt}
                </figcaption>
              ) : null}
            </figure>
          ) : null}

          <RichText
            tone="international"
            data={article.content}
            className={cn('text-[17px]', (hero || (report && article.excerpt)) && 'mt-8')}
          />

          <footer className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-paper-200 pt-6 text-sm font-medium">
            {filedIn && filedIn.id !== top?.id ? (
              <Link href={contextHref(filedIn)} className="text-verdigris-700 transition-colors hover:text-verdigris-800">
                ← {filedIn.name}
              </Link>
            ) : null}
            <Link
              href={top ? archiveHref(top) : '/'}
              className="text-verdigris-700 transition-colors hover:text-verdigris-800"
            >
              The Register
            </Link>
          </footer>
        </div>
      </div>
    </article>
  )
}
