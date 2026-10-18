import Link from 'next/link'

import { RichText } from '@/components/RichText'
import { ArticleCard } from '@/components/site/ArticleCard'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { Crest } from '@/components/site/Crest'
import { DocumentCard } from '@/components/site/DocumentCard'
import { Emblem } from '@/components/site/Emblem'
import { FlagTick } from '@/components/site/FlagTick'
import { SectionHeading } from '@/components/site/SectionHeading'
import { dress } from '@/components/styles'
import { archiveHref, contextHref, emblemOf } from '@/lib/site'

import type { SectionProps } from '../types'

/**
 * An office of state (a ministry, the Chancellery) at any depth, set like a
 * letterhead: the way back up, its emblem — or the crest — beside its name,
 * the double rule, what sits inside it, its standing documents and its
 * latest dispatches. An office in a style keeps all of that in the style's
 * colours and faces, with the style's mark in the frame when it has no emblem.
 */
export function Section({ context, chain, style, subContexts, pages, pinned, latest }: SectionProps) {
  const top = chain[0]
  const { attrs, Mark } = dress('gazette', style)
  const ancestors = chain.slice(0, -1)
  const parent = ancestors[ancestors.length - 1]
  const level = ancestors.length > 1 && parent ? `Within ${parent.name}` : 'An office of state'
  const within = [
    ...subContexts.map((child) => ({ href: contextHref(child), label: child.name })),
    ...pages,
  ]
  // Nothing between the letterhead and the latest dispatches: one rule serves both.
  const sparse = !context.intro && within.length === 0 && pinned.length === 0

  return (
    <div {...attrs} className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <header>
        <Breadcrumb
          chain={ancestors}
          className="font-label text-[11px] uppercase tracking-[0.2em] text-(--accent-ink)"
          linkClassName="text-sea-700 transition-colors hover:text-sea-600"
          separatorClassName="text-sand-300"
        />
        <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <Emblem
            media={emblemOf(chain)}
            size={104}
            className="border border-sand-300 bg-(--accent-wash) p-2"
            fallback={
              Mark ? (
                <Mark className="h-14 w-14 text-(--accent-ink)" />
              ) : (
                <Crest className="h-14 w-auto text-(--accent-ink)" />
              )
            }
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2.5 font-label text-[11px] uppercase tracking-[0.2em] text-(--accent-ink)">
              <FlagTick />
              {level}
            </p>
            <h1 className="mt-3 text-balance font-display text-4xl text-sea-950 md:text-5xl">
              {context.name}
            </h1>
            {context.tagline ? (
              <p className="mt-3 max-w-2xl text-lg text-ink-500">{context.tagline}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-8" aria-hidden="true">
          <div className="h-[3px] bg-sea-800" />
          <div className="mt-[2px] h-px bg-(--accent)" />
        </div>
      </header>

      {context.intro ? <RichText data={context.intro} className="mt-10 max-w-3xl" /> : null}

      {within.length > 0 ? (
        <nav aria-label={`Within ${context.name}`} className="mt-10">
          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-(--accent-ink)">Within this office</p>
          <ul className="mt-3 flex flex-wrap gap-3">
            {within.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-block border border-sand-300 bg-sand-50 px-4 py-2 text-sm text-sea-800 transition-colors hover:border-(--accent)"
                >
                  {link.label} →
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {pinned.length > 0 ? (
        <section aria-labelledby="section-documents" className="mt-14">
          <SectionHeading id="section-documents" eyebrow="Standing Record" title="Documents" />
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {pinned.map((article) => (
              <DocumentCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="section-latest" className={sparse ? 'mt-4' : 'mt-16'}>
        <SectionHeading
          id="section-latest"
          eyebrow={context.name}
          title="Latest"
          rule={!sparse}
          action={
            top ? (
              <Link
                href={archiveHref(top)}
                className="text-sm font-medium text-sea-700 transition-colors hover:text-sea-600"
              >
                The whole Gazette →
              </Link>
            ) : null
          }
        />
        {latest.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center border border-sand-300 bg-sand-100/60 px-6 py-14 text-center">
            <Crest className="h-12 w-auto text-sand-300" />
            <p className="mt-5 font-display text-xl text-ink-700">
              {context.name} has entered nothing into the record yet.
            </p>
            <p className="mt-2 text-sm text-ink-500">
              When its first dispatch is published, it will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
