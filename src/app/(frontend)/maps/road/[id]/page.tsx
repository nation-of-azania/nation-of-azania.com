import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RoadPanel } from '@/components/maps/panels/RoadPanel'
import { pathLength, roadCourse } from '@/maps/geo'
import { ROAD_KINDS } from '@/maps/registry'
import { roadHref } from '@/maps/url'
import { findRoad, getMapData } from '@/lib/maps'

import { mapsMetadata } from '../../metadata'

type Props = { params: Promise<{ id: string }> }

const idOf = (raw: string) => (/^\d{1,9}$/.test(raw) ? Number(raw) : null)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const road = idOf(id) != null ? findRoad(await getMapData(), idOf(id)!) : null
  if (!road) return { title: 'Not on the map' }
  const title = road.name ?? 'Unnamed road'
  // Measured along the course as drawn, bends included.
  const length = Math.round(pathLength(roadCourse(road.line, road.shape, road.corners)))
  const description = `${ROAD_KINDS[road.kind].label} on Azania Maps, ${length.toLocaleString('en-GB')} blocks long.`
  return mapsMetadata({ title, description, path: roadHref(road.id), updatedAt: road.updatedAt })
}

export default async function RoadPage({ params }: Props) {
  const { id } = await params
  const data = await getMapData()
  const road = idOf(id) != null ? findRoad(data, idOf(id)!) : null
  if (!road) notFound()
  return <RoadPanel data={data} road={road} />
}
