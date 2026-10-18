import Link from 'next/link'

import { PreviewTools } from '@/components/PreviewTools'
import { RichText } from '@/components/RichText'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { DoubleRule } from '@/components/site/SectionHeading'
import { contextHref } from '@/lib/site'

import type { PageProps } from '../types'

/**
 * A standing page (About, …) in the Gazette's dress. Pages inside an office
 * show the way back up the tree; those directly under Government carry the
 * nation's name instead.
 */
export function Page({ page, chain, draft }: PageProps) {
  const home = chain[chain.length - 1]
  const nested = chain.length > 1

  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:py-20">
      {draft ? <PreviewTools /> : null}
      <header>
        {nested ? (
          <Breadcrumb
            chain={chain}
            current={page.title}
            className="text-[11px] uppercase tracking-[0.2em] text-saffron-600"
            linkClassName="text-sea-700 transition-colors hover:text-sea-600"
            separatorClassName="text-sand-300"
          />
        ) : (
          <p className="text-[11px] uppercase tracking-[0.2em] text-saffron-600">
            The Nation of Azania
          </p>
        )}
        <h1 className="mt-4 text-balance font-display text-4xl leading-[1.08] text-sea-950 md:text-5xl">
          {page.title}
        </h1>
        <DoubleRule className="mt-7" />
      </header>

      <RichText data={page.content} className="mt-10" />

      <footer className="mt-14 border-t border-sand-300 pt-6">
        <Link
          href={home ? contextHref(home) : '/'}
          className="text-sm font-medium text-sea-700 transition-colors hover:text-sea-600"
        >
          ← {home?.name ?? 'Home'}
        </Link>
      </footer>
    </article>
  )
}
