import Link from 'next/link'

import { RichText } from '@/components/RichText'
import { TimesCard } from '@/components/times/TimesCard'
import { contextHref } from '@/lib/site'

import type { SectionProps } from '../types'

/** A desk of the Times (Markets, Opinion…) at any depth. */
export function Section({ context, chain, subContexts, pages, pinned, latest }: SectionProps) {
  const stories = [...pinned, ...latest]
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:py-12">
      <header className="border-b-2 border-cinnabar-800 pb-6">
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-news-500">
          {chain.slice(0, -1).map((ancestor) => (
            <span key={ancestor.id} className="flex items-center gap-x-2">
              <Link href={contextHref(ancestor)} className="hover:text-cinnabar-700">
                {ancestor.name}
              </Link>
              <span aria-hidden="true">›</span>
            </span>
          ))}
        </p>
        <h1 className="mt-2 font-news text-4xl font-black uppercase tracking-tight text-cinnabar-800 md:text-5xl">
          {context.name}
        </h1>
        {context.tagline ? <p className="mt-2 text-news-700">{context.tagline}</p> : null}
      </header>
      {context.intro ? (
        <RichText data={context.intro} tone="times" className="mt-8 max-w-3xl" />
      ) : null}
      {subContexts.length > 0 || pages.length > 0 ? (
        <nav aria-label="Within this desk" className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-cinnabar-800">
          {subContexts.map((child) => (
            <Link key={child.id} href={contextHref(child)} className="hover:text-lagoon-600">
              {child.name}
            </Link>
          ))}
          {pages.map((page) => (
            <Link key={page.href} href={page.href} className="hover:text-lagoon-600">
              {page.label}
            </Link>
          ))}
        </nav>
      ) : null}
      {stories.length > 0 ? (
        <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((article) => (
            <TimesCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-news-500">No stories have been filed on this desk yet.</p>
      )}
    </div>
  )
}
