import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SitePanel } from '@/components/maps/panels/SitePanel'
import { TownPanel } from '@/components/maps/panels/TownPanel'
import { spoken } from '@/maps/data'
import { siteFacts, siteSummary } from '@/maps/sites'
import { townHref } from '@/maps/url'
import { findTown, getArticlesAbout, getMapData, getTownCensus, getTownRecord } from '@/lib/maps'

import { mapsMetadata } from '../../metadata'

/**
 * Cached for everyone alike, a minute at a time (see ../layout.tsx): none
 * is built ahead, each is rendered when first asked for and kept. A site
 * the server runs and Azania holds has the same address as a town and its
 * own panel.
 */
export const revalidate = 60
export const dynamicParams = true
export const generateStaticParams = async () => []

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const town = findTown(await getMapData(), slug)
  if (!town) return { title: 'Not on the map' }
  const name = spoken(town.name)
  const site = siteFacts(town)
  const description = site
    ? `${name} on Azania Maps: ${siteSummary(site)}.`
    : `${name} on Azania Maps: ${town.residents} resident${town.residents === 1 ? '' : 's'}, ${town.chunks} claimed chunks${town.ruler ? `, ruled by ${town.ruler}` : ''}.`
  return mapsMetadata({ title: name, description, path: townHref(town.slug), updatedAt: town.updatedAt })
}

export default async function TownPage({ params }: Props) {
  const { slug } = await params
  const data = await getMapData()
  const town = findTown(data, slug)
  if (!town) notFound()
  const site = siteFacts(town)
  if (site) {
    // No census for a site: its bot and fixed claims aren't growth.
    const [record, articles] = await Promise.all([getTownRecord(town.id), getArticlesAbout('towns', town.id)])
    return <SitePanel articles={articles} data={data} facts={site} record={record} town={town} />
  }
  const [record, census, articles] = await Promise.all([
    getTownRecord(town.id),
    getTownCensus(town.id),
    getArticlesAbout('towns', town.id),
  ])
  return <TownPanel articles={articles} census={census} data={data} record={record} town={town} />
}
