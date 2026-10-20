import Link from 'next/link'

import { RichText } from '@/components/RichText'
import { InitiativeList } from '@/components/intl/InitiativeList'
import { INTL_ACTION, IntlHeading } from '@/components/intl/IntlHeading'
import { IntlMark } from '@/components/intl/IntlMark'
import { RecordList } from '@/components/intl/IntlRecord'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { Emblem } from '@/components/site/Emblem'
import { FeedLink } from '@/components/site/FeedLink'
import { archiveHref, emblemOf, feedHref } from '@/lib/site'

import type { SectionProps } from '../types'

/**
 * An initiative at any depth (Transport Catalogue › Road Initiative › Case
 * Studies): the way back up, the emblem it carries or inherits, what sits
 * inside it, and its records as a ledger.
 */
export function Section({ context, chain, subContexts, pages, pinned, latest }: SectionProps) {
  const top = chain[0]
  const ancestors = chain.slice(0, -1)
  const parent = ancestors[ancestors.length - 1]
  const level = ancestors.length > 1 && parent ? `Within ${parent.name}` : 'Initiative'

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <Breadcrumb
        chain={ancestors}
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite-500"
        linkClassName="transition-colors hover:text-graphite-900"
        separatorClassName="text-paper-300"
      />
      <header className="mt-6 flex flex-col gap-6 border-b-2 border-(--accent) pb-8 sm:flex-row sm:items-start sm:gap-8">
        <Emblem
          media={emblemOf(chain)}
          size={96}
          className="border border-paper-200 bg-(--accent-wash) p-2"
          fallback={<IntlMark className="h-11 w-11 text-(--accent-ink)" />}
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-(--accent-ink)">{level}</p>
          <h1 className="mt-2 text-balance font-record text-4xl font-medium leading-[1.1] tracking-tight text-graphite-900 md:text-5xl">
            {context.name}
          </h1>
          {context.tagline ? (
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-graphite-700">{context.tagline}</p>
          ) : null}
        </div>
      </header>

      {context.intro ? (
        <RichText tone="international" data={context.intro} className="mt-8 max-w-3xl" />
      ) : null}

      {subContexts.length > 0 ? (
        <section aria-labelledby="within" className="mt-12">
          <IntlHeading id="within" label={`Within ${context.name}`} />
          <div className="mt-6">
            <InitiativeList contexts={subContexts} chain={chain} />
          </div>
        </section>
      ) : null}

      {pages.length > 0 ? (
        <nav aria-label="Pages" className="mt-8 flex flex-wrap gap-2">
          {pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="inline-flex items-center border border-paper-300 bg-paper-50 px-3.5 py-1.5 text-sm font-medium text-graphite-700 transition-colors hover:border-(--accent) hover:text-graphite-900"
            >
              {page.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {pinned.length > 0 ? (
        <section aria-labelledby="pinned" className="mt-12">
          <IntlHeading id="pinned" label="Pinned" />
          <RecordList articles={pinned} within={context.id} empty="" />
        </section>
      ) : null}

      <section aria-labelledby="records" className="mt-12">
        <IntlHeading
          id="records"
          label="Records"
          action={
            <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              {top ? (
                <Link href={archiveHref(top)} className={INTL_ACTION}>
                  The full register →
                </Link>
              ) : null}
              <FeedLink href={feedHref(context)} className={INTL_ACTION} title={`${context.name} as an RSS feed`}>
                Feed
              </FeedLink>
            </span>
          }
        />
        <RecordList
          articles={latest}
          within={context.id}
          empty={`Nothing has been entered under ${context.name} yet.`}
        />
      </section>
    </div>
  )
}
