import Link from 'next/link'

import { RichText } from '@/components/RichText'
import { InitiativeList } from '@/components/intl/InitiativeList'
import { IntlCredit } from '@/components/intl/IntlByline'
import { INTL_ACTION, IntlHeading } from '@/components/intl/IntlHeading'
import { RecordList, RecordRef } from '@/components/intl/IntlRecord'
import { FeedLink } from '@/components/site/FeedLink'
import { articleHref, formatDate, resolveByline } from '@/components/site/format'
import { archiveHref, feedHref } from '@/lib/site'

import type { HomeProps } from '../types'

/**
 * The International front page: a statement of what the ground is, the
 * standing notices (pinned records) beside it, the initiatives as tiles, and
 * the newest entries in the register as a ledger.
 */
export function Home({ top, sections, pages, pinned, latest }: HomeProps) {
  const archive = archiveHref(top)
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <section className="grid gap-10 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:gap-16">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-verdigris-700">
            The common register
          </p>
          <h1 className="mt-4 max-w-2xl text-balance font-record text-4xl font-medium leading-[1.1] tracking-tight text-graphite-900 md:text-5xl">
            What the nations agree, kept in one place.
          </h1>
          {top.intro ? (
            <RichText tone="international" data={top.intro} className="mt-6 max-w-2xl text-lg text-graphite-700" />
          ) : (
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-graphite-700">
              Member nations draft standards, pass resolutions and report what they built — in the
              open, on ground that is none of theirs. Azania hosts the register; what is entered in
              it belongs to the initiatives that wrote it.
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href={archive} className={INTL_ACTION}>
              Open the register →
            </Link>
            {pages.map((page) => (
              <Link key={page.href} href={page.href} className={INTL_ACTION}>
                {page.label}
              </Link>
            ))}
          </div>
        </div>

        {pinned.length > 0 ? (
          <aside aria-labelledby="standing-notices" className="border border-paper-200 bg-paper-100 p-6">
            <h2
              id="standing-notices"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite-500"
            >
              Standing {pinned.length === 1 ? 'notice' : 'notices'}
            </h2>
            <ul className="mt-2 divide-y divide-paper-200">
              {pinned.map((article) => {
                const byline = resolveByline(article)
                const date = formatDate(article.publishedAt ?? article.createdAt)
                return (
                  <li key={article.id} className="group relative py-4">
                    <RecordRef article={article} />
                    <h3 className="mt-2 font-record text-lg font-medium leading-snug text-graphite-900">
                      <Link
                        href={articleHref(article)}
                        className="transition-colors after:absolute after:inset-0 group-hover:text-verdigris-700"
                      >
                        {article.title}
                      </Link>
                    </h3>
                    {article.excerpt ? (
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-graphite-700">
                        {article.excerpt}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                      {byline ? <IntlCredit byline={byline} /> : <span />}
                      {date ? <span className="font-mono text-[11px] text-graphite-500">{date}</span> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </aside>
        ) : null}
      </section>

      {sections.length > 0 ? (
        <section aria-labelledby="initiatives" className="mt-16">
          <IntlHeading id="initiatives" label="Initiatives" />
          <div className="mt-6">
            <InitiativeList contexts={sections} chain={[top]} />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="recent-records" className="mt-16">
        <IntlHeading
          id="recent-records"
          label="Recent entries"
          action={
            <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <Link href={archive} className={INTL_ACTION}>
                The full register →
              </Link>
              <FeedLink href={feedHref(top)} className={INTL_ACTION} title={`${top.name} as an RSS feed`}>
                Feed
              </FeedLink>
            </span>
          }
        />
        <RecordList articles={latest} empty="Nothing has been entered in the register yet." />
      </section>
    </div>
  )
}
