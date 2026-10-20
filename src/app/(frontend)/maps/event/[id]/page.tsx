import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { EventPanel } from '@/components/maps/panels/EventPanel'
import { findEvent, getArticlesAbout, getMapData } from '@/lib/maps'
import type { Article } from '@/payload-types'

type Props = { params: Promise<{ id: string }> }

const idOf = (raw: string) => (/^\d{1,9}$/.test(raw) ? Number(raw) : null)

/** The article an event names as its announcement, if it's published. */
async function announcement(id: number | null): Promise<Article | null> {
  if (id == null) return null
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'articles',
      where: { and: [{ id: { equals: id } }, { _status: { equals: 'published' } }] },
      limit: 1,
      depth: 1,
    })
    return docs[0] ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const event = idOf(id) != null ? findEvent(await getMapData(), idOf(id)!) : null
  if (!event) return { title: 'Not on the map' }
  const when = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(event.startsAt))
  const description = `${when} UTC${event.host ? ` · ${event.host}` : ''}${event.description ? ` — ${event.description}` : ''}`
  return {
    title: event.title,
    description,
    openGraph: { title: event.title, description, url: `/maps/event/${event.id}` },
  }
}

export default async function EventPage({ params }: Props) {
  const { id } = await params
  const data = await getMapData()
  const event = idOf(id) != null ? findEvent(data, idOf(id)!) : null
  if (!event) notFound()
  const [article, articles] = await Promise.all([
    announcement(event.article),
    getArticlesAbout('events', event.id),
  ])
  return <EventPanel article={article} articles={articles} data={data} event={event} />
}
