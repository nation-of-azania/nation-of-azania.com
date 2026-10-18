import Link from 'next/link'

import { PreviewTools } from '@/components/PreviewTools'
import { RichText } from '@/components/RichText'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { accentStyle } from '@/components/site/format'
import { accentOf, contextHref } from '@/lib/site'

import type { PageProps } from '../types'

/** A standing page in the International registry's dress. */
export function Page({ page, chain, draft }: PageProps) {
  const home = chain[chain.length - 1]
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 md:py-16" style={accentStyle(accentOf(chain), 'slate')}>
      {draft ? <PreviewTools /> : null}
      <Breadcrumb
        chain={chain}
        current={page.title}
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-graphite-500"
        linkClassName="transition-colors hover:text-graphite-900"
        separatorClassName="text-paper-300"
      />
      <header className="mt-6 border-b-2 border-(--accent) pb-7">
        <h1 className="text-balance font-record text-4xl font-medium leading-[1.1] tracking-tight text-graphite-900 md:text-5xl">
          {page.title}
        </h1>
      </header>
      <RichText tone="international" data={page.content} className="mt-10 text-[17px]" />
      <footer className="mt-14 border-t border-paper-200 pt-6">
        <Link
          href={home ? contextHref(home) : '/'}
          className="text-sm font-medium text-verdigris-700 transition-colors hover:text-verdigris-800"
        >
          ← {home?.name ?? 'Overview'}
        </Link>
      </footer>
    </article>
  )
}
