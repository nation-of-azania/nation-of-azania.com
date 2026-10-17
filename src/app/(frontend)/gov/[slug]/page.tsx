import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { RichText } from '@/components/RichText'
import { DoubleRule } from '@/components/site/SectionHeading'
import { getAllPageSlugs, getPageBySlug } from '@/lib/queries'

export const revalidate = 120

type Props = {
  // Next 16: params is a Promise and must be awaited.
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = await getAllPageSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getPageBySlug(slug)
  if (!page) return { title: 'Record not found' }
  return { title: page.title }
}

export default async function StandingPage({ params }: Props) {
  const { slug } = await params
  const page = await getPageBySlug(slug)
  if (!page) notFound()

  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:py-20">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold-600">
          The Nation of Condoria
        </p>
        <h1 className="mt-4 text-balance font-display text-4xl leading-[1.08] text-pine-950 md:text-5xl">
          {page.title}
        </h1>
        <DoubleRule className="mt-7" />
      </header>

      <RichText data={page.content} className="mt-10" />

      <footer className="mt-14 border-t border-parchment-300 pt-6">
        <Link
          href="/gov"
          className="text-sm font-medium text-pine-700 transition-colors hover:text-pine-600"
        >
          ← The Gazette
        </Link>
      </footer>
    </article>
  )
}
