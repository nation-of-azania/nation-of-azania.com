import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { AbroadOffline, AbroadTownPanel } from '@/components/maps/panels/AbroadPanel'
import { getAbroadTown } from '@/lib/abroad'
import { getMapData } from '@/lib/maps'
import { spoken } from '@/maps/data'
import { incomeWords, siteTitle } from '@/maps/sites'
import { abroadHref, townHref } from '@/maps/url'

import { mapsMetadata } from '../../metadata'

/**
 * A town of another nation, or of none: /maps/abroad/<slug>, its slug from
 * its Towny name. Cached for everyone alike, a minute at a time (see
 * ../../layout.tsx): none is built ahead, each is rendered when first asked
 * for and kept. A town that has since joined Azania goes to its own page.
 */
export const revalidate = 60
export const dynamicParams = true
export const generateStaticParams = async () => []

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getAbroadTown(slug, await getMapData())
  if (page?.kind !== 'town') return { title: page?.kind === 'offline' ? 'Abroad' : 'Not on the map' }
  const { town, nation } = page
  const name = spoken(town.name)
  const of = nation ? spoken(nation.name) : null
  const description =
    town.kind === 'town'
      ? `${name}, ${town.capital && of ? `capital of ${of}` : of ? `a town of ${of}` : 'a town of no nation'}, on Azania Maps: ${town.residents} resident${town.residents === 1 ? '' : 's'}, ${town.chunks} claimed chunks${town.ruler ? `, ruled by ${town.ruler}` : ''}.`
      : `${name} on Azania Maps: ${siteTitle({ kind: town.kind, income: town.income, resource: town.resource, note: null }).toLowerCase()} held by ${of ?? 'nobody'}${incomeWords(town.income) ? `, paying ${incomeWords(town.income)}` : ''}.`
  return mapsMetadata({ title: name, description, path: abroadHref(town.slug), updatedAt: null })
}

export default async function AbroadPage({ params }: Props) {
  const { slug } = await params
  const data = await getMapData()
  const page = await getAbroadTown(slug, data)
  if (!page) notFound()
  if (page.kind === 'offline') return <AbroadOffline what="town" />
  if (page.kind === 'own') {
    const own = data.towns.find((town) => town.townyId === page.townyId)
    if (own) redirect(townHref(own.slug))
    notFound()
  }
  return <AbroadTownPanel nation={page.nation} route={page.route} town={page.town} />
}
