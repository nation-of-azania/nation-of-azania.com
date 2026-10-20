import type { Metadata } from 'next'

import { HomePanel } from '@/components/maps/panels/HomePanel'
import { getMapData, getNationCensus } from '@/lib/maps'

import { mapsMetadata } from './metadata'

/** The front's card shows the heartland with every town's claims, so it turns over with the latest town reading. */
export async function generateMetadata(): Promise<Metadata> {
  const data = await getMapData()
  const latest = data.towns.map((town) => town.updatedAt).sort().at(-1)
  return mapsMetadata({
    title: 'Azania Maps',
    description: 'The Nation of Azania, charted: its towns, places, roads and events on the Rulercraft map.',
    path: '/maps',
    updatedAt: latest,
  })
}

/** The map's front: the nation at a glance, what's on, the towns. */
export default async function MapsPage() {
  const [data, census] = await Promise.all([getMapData(), getNationCensus()])
  return <HomePanel census={census} data={data} />
}
