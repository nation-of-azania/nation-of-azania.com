import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { ClassLegend, ChangeLog, ListEntries, rollOf } from '@/blocks/components/Sanctions/parts'
import { PlayerRoll } from '@/blocks/components/Sanctions/Roll'
import { cardImageFor } from '@/components/og'
import { formatDate } from '@/components/site/format'
import { getListChanges, getSanctionList } from '@/lib/sanctions'
import { contextHref, getSiteTree } from '@/lib/site'

/**
 * /<top>/sanctions/<slug>: a public sanction list (src/collections/Lists.ts)
 * in the publication it belongs to, the way the Gazette keeps a register:
 * what the list is and asks, everyone on it rendered down to players (the
 * page's purpose: a mayor enforcing it copies the outlaw commands here), what
 * it names, what its classes mean, and its changelog. Only a list whose
 * context lies under this top-level context is found here; any other is a
 * 404. The chrome is the context's design's, from [top]/layout.tsx.
 */

export const revalidate = 120

type Props = { params: Promise<{ top: string; slug: string }> }

const load = cache(async (topSlug: string, slug: string) => {
  const list = await getSanctionList({ slug: decodeURIComponent(slug) })
  if (!list || list.context == null) return null
  const tree = await getSiteTree()
  const chain = tree.ancestors(list.context)
  const top = chain[0]
  if (!top || top.slug !== topSlug) return null
  return { list, top, context: chain[chain.length - 1] ?? top }
})

const plural = (n: number, word: string) => `${n.toLocaleString('en-GB')} ${word}${n === 1 ? '' : 's'}`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { top, slug } = await params
  const loaded = await load(top, slug)
  if (!loaded) return { title: 'Not found' }
  const { list } = loaded
  const description = `${plural(list.players.length, 'player')} on ${list.name}, as the record stands.`
  const image = { ...cardImageFor(`/${loaded.top.slug}`, loaded.top.updatedAt), alt: `${list.name} · ${loaded.top.name}` }
  return {
    title: list.name,
    description,
    openGraph: { type: 'website', siteName: loaded.top.name, title: list.name, description, url: `/${loaded.top.slug}/sanctions/${list.slug}`, images: [image] },
    twitter: { card: 'summary_large_image', title: list.name, description, images: [image.url] },
  }
}

const EYEBROW = 'font-label text-[11px] uppercase tracking-[0.2em]'

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-14">
      <div className="border-t-[3px] border-(--design-ink)" />
      <div className="mt-[2px] h-px bg-(--design-accent)" />
      <p className={`mt-5 ${EYEBROW} text-(--design-accent)`}>{eyebrow}</p>
      <h2 className="mt-1.5 font-(family-name:--design-display) font-(--design-weight) text-2xl text-(--design-ink) md:text-3xl" id={id}>
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  )
}

export default async function SanctionListPage({ params }: Props) {
  const { top: topSlug, slug } = await params
  const loaded = await load(topSlug, slug)
  if (!loaded) notFound()
  const { list, top, context } = loaded
  const changes = await getListChanges(list.id, { limit: 60 })
  const lastChange = changes[0]?.at ?? list.rosterAt ?? list.updatedAt
  const places = list.entries.filter((entry) => entry.kind !== 'player').length
  const named = list.entries.length - places
  const namesLine =
    [named ? plural(named, 'player') : null, places ? `${places} ${places === 1 ? 'town or nation' : 'towns or nations'}` : null]
      .filter(Boolean)
      .join(', ') || 'Nobody yet'

  return (
    <article className="mx-auto max-w-5xl px-6 py-16 md:py-20">
      <header className="max-w-3xl">
        <p className={`${EYEBROW} text-(--seal-ink)`}>
          Sanction list · <Link className="hover:underline" href={contextHref(context)}>{context.name}</Link>
        </p>
        <h1 className="mt-4 text-balance font-(family-name:--design-display) font-(--design-weight) text-4xl leading-[1.08] text-(--design-ink) md:text-5xl">
          {list.name}
        </h1>
        {list.description ? (
          <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-(--design-muted)">{list.description}</p>
        ) : null}
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
          {[
            ['On the list', plural(list.players.length, 'player')],
            ['Names', namesLine],
            ['Last changed', formatDate(lastChange) ?? '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className={`${EYEBROW} text-(--design-muted)`}>{label}</dt>
              <dd className="mt-1 font-(family-name:--design-display) text-xl text-(--design-ink)">{value}</dd>
            </div>
          ))}
        </dl>
        {list.classes.length ? <ClassLegend className="mt-8" list={list} /> : null}
      </header>

      <Section eyebrow="The register" id="players" title="Who is on the list">
        <p className="mb-5 max-w-3xl text-sm leading-relaxed text-(--design-muted)">
          Everyone the list names, and every resident of the towns and nations it names, for as long as they live
          there. Mayors enforce it with Towny’s outlaw command, one name at a time: copy the commands and paste them in
          game.
        </p>
        <PlayerRoll players={rollOf(list)} />
      </Section>

      <Section eyebrow="Its terms" id="entries" title="What the list names">
        <ListEntries list={list} />
      </Section>

      <Section eyebrow="The record" id="changes" title="Changelog">
        <ChangeLog changes={changes} list={list} />
      </Section>

      <footer className="mt-14 border-t border-(--design-ink)/15 pt-6">
        <Link className="text-sm font-medium text-(--design-link) hover:underline" href={contextHref(top)}>
          ← {top.name}
        </Link>
      </footer>
    </article>
  )
}
