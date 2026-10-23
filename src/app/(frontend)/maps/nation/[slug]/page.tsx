import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { AbroadOffline, NationPanel } from '@/components/maps/panels/AbroadPanel'
import { getAbroadNation } from '@/lib/abroad'
import { getMapData } from '@/lib/maps'
import { homeNationOf, worldSlug } from '@/maps/abroad'
import { spoken } from '@/maps/data'
import { MAPS_PATH, nationHref } from '@/maps/url'

import { mapsMetadata } from '../../metadata'

/**
 * Another nation: /maps/nation/<slug>, its slug from its Towny name. Cached
 * for everyone alike, a minute at a time (see ../../layout.tsx), each
 * rendered when first asked for. Azania's own nation is the map's front.
 */
export const revalidate = 60
export const dynamicParams = true
export const generateStaticParams = async () => []

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getAbroadNation(slug, await getMapData())
  if (page?.kind !== 'nation') return { title: page?.kind === 'offline' ? 'A nation' : 'Not on the map' }
  const { nation } = page
  const name = spoken(nation.name)
  const description = `${name} on Azania Maps: ${nation.towns} town${nation.towns === 1 ? '' : 's'}, ${nation.residents} resident${nation.residents === 1 ? '' : 's'}${nation.capital ? `, its capital ${spoken(nation.capital.name)}` : ''}.`
  return mapsMetadata({ title: name, description, path: nationHref(nation.slug), updatedAt: null })
}

export default async function NationPage({ params }: Props) {
  const { slug } = await params
  const data = await getMapData()
  const home = homeNationOf(data.towns)
  if (home && worldSlug(home) === slug) redirect(MAPS_PATH)
  const page = await getAbroadNation(slug, data)
  if (!page) notFound()
  if (page.kind === 'offline') return <AbroadOffline what="nation" />
  return <NationPanel fit={page.fit} members={page.members} nation={page.nation} />
}
