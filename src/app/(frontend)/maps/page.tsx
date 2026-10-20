import { HomePanel } from '@/components/maps/panels/HomePanel'
import { getMapData, getNationCensus } from '@/lib/maps'

/** The map's front: the nation at a glance, what's on, the towns. */
export default async function MapsPage() {
  const [data, census] = await Promise.all([getMapData(), getNationCensus()])
  return <HomePanel census={census} data={data} />
}
