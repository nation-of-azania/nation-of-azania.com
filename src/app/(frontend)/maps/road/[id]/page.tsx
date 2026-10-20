import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RoadPanel } from '@/components/maps/panels/RoadPanel'
import { roadLength } from '@/maps/data'
import { ROAD_KINDS } from '@/maps/registry'
import { findRoad, getMapData } from '@/lib/maps'

/**
 * Cached for everyone alike, a minute at a time (see ../layout.tsx): none
 * is built ahead, each is rendered when first asked for and kept.
 */
export const revalidate = 60
export const dynamicParams = true
export const generateStaticParams = async () => []

type Props = { params: Promise<{ id: string }> }

const idOf = (raw: string) => (/^\d{1,9}$/.test(raw) ? Number(raw) : null)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const road = idOf(id) != null ? findRoad(await getMapData(), idOf(id)!) : null
  if (!road) return { title: 'Not on the map' }
  const title = road.name ?? 'Unnamed road'
  const description = `${ROAD_KINDS[road.kind].label} on Azania Maps, ${Math.round(roadLength(road)).toLocaleString('en-GB')} blocks long.`
  return { title, description, openGraph: { title, description, url: `/maps/road/${road.id}` } }
}

export default async function RoadPage({ params }: Props) {
  const { id } = await params
  const data = await getMapData()
  const road = idOf(id) != null ? findRoad(data, idOf(id)!) : null
  if (!road) notFound()
  return <RoadPanel data={data} road={road} />
}
