import Link from 'next/link'

import { RichText } from '@/components/RichText'
import { ArticleCard } from '@/components/site/ArticleCard'
import { DocumentCard } from '@/components/site/DocumentCard'
import { DoubleRule, SectionHeading } from '@/components/site/SectionHeading'
import { contextHref } from '@/lib/site'

import type { SectionProps } from '../types'

/** A sub-context of Government (a ministry, an office) at any depth. */
export function Section({ context, chain, subContexts, pages, pinned, latest }: SectionProps) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <header>
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 text-[11px] uppercase tracking-[0.2em] text-saffron-600">
            {chain.slice(0, -1).map((ancestor) => (
              <li key={ancestor.id} className="flex items-center gap-x-2">
                <Link href={contextHref(ancestor)} className="text-sea-700 hover:text-sea-600">
                  {ancestor.name}
                </Link>
                <span aria-hidden="true">›</span>
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="mt-3 font-display text-4xl text-sea-950 md:text-5xl">{context.name}</h1>
        {context.tagline ? (
          <p className="mt-4 max-w-2xl text-lg text-ink-500">{context.tagline}</p>
        ) : null}
        <DoubleRule className="mt-8" />
      </header>

      {context.intro ? <RichText data={context.intro} className="mt-10 max-w-3xl" /> : null}

      {subContexts.length > 0 || pages.length > 0 ? (
        <ul className="mt-10 flex flex-wrap gap-3">
          {[
            ...subContexts.map((child) => ({ href: contextHref(child), label: child.name })),
            ...pages,
          ].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="inline-block border border-sand-300 px-4 py-2 text-sm text-sea-800 transition-colors hover:border-saffron-400"
              >
                {link.label} →
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {pinned.length > 0 ? (
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {pinned.map((article) => (
            <DocumentCard key={article.id} article={article} />
          ))}
        </div>
      ) : null}

      <section aria-labelledby="section-latest" className="mt-16">
        <SectionHeading id="section-latest" eyebrow={context.name} title="Latest" />
        {latest.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-sm italic text-ink-500">Nothing has been published here yet.</p>
        )}
      </section>
    </div>
  )
}
