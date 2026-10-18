import Link from 'next/link'

import { PreviewTools } from '@/components/PreviewTools'
import { RichText } from '@/components/RichText'
import { contextHref } from '@/lib/site'

import type { PageProps } from '../types'

/** A standing page in the Times' dress. */
export function Page({ page, chain, draft }: PageProps) {
  const home = chain[chain.length - 1]
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      {draft ? <PreviewTools /> : null}
      <header>
        <h1 className="font-news text-4xl font-black leading-[1.03] text-news-900 md:text-5xl">
          {page.title}
        </h1>
        <div aria-hidden="true" className="mt-6 h-0.5 w-full bg-cinnabar-800" />
      </header>
      <RichText data={page.content} tone="times" className="mt-10" />
      <footer className="mt-14 border-t border-news-200 pt-6">
        <Link
          href={home ? contextHref(home) : '/'}
          className="text-sm font-semibold text-cinnabar-700 transition-colors hover:text-cinnabar-800"
        >
          ← {home?.name ?? 'Front Page'}
        </Link>
      </footer>
    </article>
  )
}
