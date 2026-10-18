import Link from 'next/link'

import { PreviewTools } from '@/components/PreviewTools'
import { RichText } from '@/components/RichText'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { contextHref } from '@/lib/site'

import type { PageProps } from '../types'

/** A standing page in the Times' dress, with the way back up when it sits on a desk. */
export function Page({ page, chain, draft }: PageProps) {
  const home = chain[chain.length - 1]
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      {draft ? <PreviewTools /> : null}
      <header>
        {chain.length > 1 ? (
          <Breadcrumb
            chain={chain}
            current={page.title}
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-news-500"
            linkClassName="transition-colors hover:text-cinnabar-700"
            separatorClassName="text-news-300"
          />
        ) : null}
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
