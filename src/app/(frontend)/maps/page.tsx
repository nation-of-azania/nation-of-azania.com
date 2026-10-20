import { HomePanel } from '@/components/maps/panels/HomePanel'
import { getMapData, getNationCensus } from '@/lib/maps'

/** Cached for everyone alike, a minute at a time (see ../layout.tsx). */
export const revalidate = 60

/** The map's front: the nation at a glance, what's on, the towns. */
export default async function MapsPage() {
  const [data, census] = await Promise.all([getMapData(), getNationCensus()])
  return <HomePanel census={census} data={data} />
}
