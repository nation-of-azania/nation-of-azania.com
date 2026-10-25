import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { AbroadOffline, AbroadTownPanel } from '@/components/maps/panels/AbroadPanel'
import { getAbroadTown } from '@/lib/abroad'
import { getMapData } from '@/lib/maps'
import { isOldSpawnTown, OLD_SPAWN_TOWN_LANDING, relationWith, type AbroadFacts, type NationSummary } from '@/maps/abroad'
import { spoken } from '@/maps/data'
import { incomeWords, isSiteKind, siteTitle } from '@/maps/sites'
import { isServerKind, serverSummary } from '@/maps/trading'
import { abroadHref, townHref } from '@/maps/url'

import { mapsMetadata } from '../../metadata'

/**
 * A town of another nation, or of none: /maps/abroad/<slug>, its slug from
 * its Towny name, or one of the server's own places, a trading outpost or
 * a landmark, its slug from the server's name for it. Cached for everyone
 * alike, a minute at a time (see ../../layout.tsx): none is built ahead,
 * each is rendered when first asked for and kept. A town that has since
 * joined Azania goes to its own page, and the server's old spawn town to
 * the map's front.
 */
export const revalidate = 60
export const dynamicParams = true
export const generateStaticParams = async () => []

type Props = { params: Promise<{ slug: string }> }

/** The line a link unfurls with: a town's nation and figures, a site's holder and pay, a trading outpost's trade. */
function describe(town: AbroadFacts, nation: NationSummary | null): string {
  const name = spoken(town.name)
  const of = nation ? spoken(nation.name) : null
  if (isServerKind(town.kind)) return serverSummary({ kind: town.kind, name })
  if (isSiteKind(town.kind)) {
    const title = siteTitle({ kind: town.kind, income: town.income, resource: town.resource, note: null }).toLowerCase()
    const pays = incomeWords(town.income)
    return `${name} on Azania Maps: ${title} held by ${of ?? 'nobody'}${pays ? `, paying ${pays}` : ''}.`
  }
  return `${name}, ${town.capital && of ? `capital of ${of}` : of ? `a town of ${of}` : 'a town of no nation'}, on Azania Maps: ${town.residents} resident${town.residents === 1 ? '' : 's'}, ${town.chunks} claimed chunks${town.ruler ? `, ruled by ${town.ruler}` : ''}.`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getAbroadTown(slug, await getMapData())
  if (page?.kind !== 'town') return { title: page?.kind === 'offline' ? 'Abroad' : 'Not on the map' }
  const { town, nation } = page
  return mapsMetadata({
    title: spoken(town.name),
    description: describe(town, nation),
    path: abroadHref(town.slug),
    updatedAt: null,
  })
}

export default async function AbroadPage({ params }: Props) {
  const { slug } = await params
  const data = await getMapData()
  const page = await getAbroadTown(slug, data)
  if (!page) {
    if (isOldSpawnTown(slug)) redirect(OLD_SPAWN_TOWN_LANDING)
    notFound()
  }
  if (page.kind === 'offline') return <AbroadOffline what="town" />
  if (page.kind === 'own') {
    const own = data.towns.find((town) => town.townyId === page.townyId)
    if (own) redirect(townHref(own.slug))
    notFound()
  }
  const relation = relationWith(page.nation?.name, data.relations)
  return (
    <AbroadTownPanel
      capital={page.capital}
      nation={page.nation}
      relation={relation}
      route={page.route}
      town={page.town}
      trading={page.trading}
    />
  )
}
