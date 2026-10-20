import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PlacePanel } from '@/components/maps/panels/PlacePanel'
import { spoken } from '@/maps/data'
import { PLACE_CATEGORIES } from '@/maps/registry'
import { placeHref } from '@/maps/url'
import { findPlace, getArticlesAbout, getMapData } from '@/lib/maps'

import { mapsMetadata } from '../../metadata'

type Props = { params: Promise<{ id: string }> }

const idOf = (raw: string) => (/^\d{1,9}$/.test(raw) ? Number(raw) : null)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const data = await getMapData()
  const place = idOf(id) != null ? findPlace(data, idOf(id)!) : null
  if (!place) return { title: 'Not on the map' }
  const town = data.towns.find((candidate) => candidate.id === place.town)
  const description =
    place.description ??
    `${PLACE_CATEGORIES[place.category].label}${town ? ` in ${spoken(town.name)}` : ''}, at ${place.point[0]}, ${place.point[1]}.`
  return mapsMetadata({ title: place.name, description, path: placeHref(place.id), updatedAt: place.updatedAt })
}

export default async function PlacePage({ params }: Props) {
  const { id } = await params
  const data = await getMapData()
  const place = idOf(id) != null ? findPlace(data, idOf(id)!) : null
  if (!place) notFound()
  const articles = await getArticlesAbout('places', place.id)
  return <PlacePanel articles={articles} data={data} place={place} />
}
