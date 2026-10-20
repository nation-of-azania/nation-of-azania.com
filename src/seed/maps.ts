import type { Payload } from 'payload'

import { syncTowns } from '../lib/towns'
import { log, seedStats } from './helpers'

type Ids = { admin: number; casi: number }

/** Find by a unique-enough field, or create. */
async function ensure<T extends 'places' | 'roads' | 'events' | 'map-views'>(
  payload: Payload,
  collection: T,
  where: Record<string, { equals: string }>,
  data: Record<string, unknown>,
): Promise<number> {
  const { docs } = await payload.find({ collection, where, limit: 1, depth: 0 })
  if (docs[0]) return docs[0].id as number
  const doc = await payload.create({ collection, data: data as never, depth: 0 })
  seedStats.created++
  log(`${collection}: ${(data.name ?? data.title) as string}`)
  return doc.id as number
}

/** Days from now, at 18:00 UTC: events stay upcoming whenever the seed runs. */
const inDays = (days: number) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  date.setUTCHours(18, 0, 0, 0)
  return date.toISOString()
}

/**
 * Azania Maps: the towns from the live Rulercraft map (when it answers), and
 * a few places, roads, events and a map view around GirlieTown and Oasis,
 * at their real coordinates, so /maps has something on it.
 */
export async function seedMaps(payload: Payload, ids: Ids): Promise<void> {
  const settings = await payload.findGlobal({ slug: 'azania-maps', depth: 0 })
  if (!settings.nations?.length && !settings.towns?.length) {
    await payload.updateGlobal({
      slug: 'azania-maps',
      data: { nations: [{ name: 'Canada' }], towns: [{ name: 'Patown' }, { name: 'GirlieTown' }] },
      depth: 0,
    })
  }
  const reading = await syncTowns(payload, { force: true })
  log(`Azania Maps: ${reading.note}`)

  const girlie = (await payload.find({ collection: 'towns', where: { slug: { equals: 'girlietown' } }, depth: 0 })).docs[0]
  if (girlie) {
    const casi = await payload.findByID({ collection: 'users', id: ids.casi, depth: 0 })
    if (!casi.mayorOf?.length) {
      await payload.update({ collection: 'users', id: ids.casi, data: { mayorOf: [girlie.id] }, depth: 0 })
    }
  } else {
    log('Azania Maps: the map didn’t answer, so casi isn’t a mayor yet; re-run the seed later.')
  }

  const byCasi = { createdBy: ids.casi, updatedBy: ids.casi }
  const byAdmin = { createdBy: ids.admin, updatedBy: ids.admin }

  const tearoom = await ensure(payload, 'places', { name: { equals: 'Blossom Tea Room' } }, {
    name: 'Blossom Tea Room',
    category: 'cafe',
    description: 'Where GirlieTea is brewed: cherry blossom tea, pink cakes and strong opinions.',
    point: { x: 4296, z: 4938 },
    outline: [[4288, 4930], [4304, 4930], [4304, 4944], [4288, 4944]],
    ...byCasi,
  })
  await ensure(payload, 'places', { name: { equals: 'GirlieTown Hall' } }, {
    name: 'GirlieTown Hall',
    category: 'townhall',
    point: { x: 4296, y: 64, z: 4952 },
    ...byCasi,
  })
  await ensure(payload, 'places', { name: { equals: 'Cherry Grove' } }, {
    name: 'Cherry Grove',
    category: 'park',
    description: 'Cherry trees in rows; the petals drift onto Petal Lane.',
    point: { x: 4315, z: 4925 },
    outline: [[4302, 4915], [4330, 4915], [4330, 4935], [4302, 4935]],
    ...byCasi,
  })
  await ensure(payload, 'places', { name: { equals: 'Oasis Market' } }, {
    name: 'Oasis Market',
    category: 'market',
    point: { x: 3416, z: 5090 },
    ...byAdmin,
  })
  await ensure(payload, 'roads', { name: { equals: 'Petal Lane' } }, {
    name: 'Petal Lane',
    kind: 'street',
    line: [[4262, 4950], [4296, 4950], [4330, 4950]],
    ...byCasi,
  })
  await ensure(payload, 'roads', { name: { equals: 'Blossom Bend' } }, {
    name: 'Blossom Bend',
    kind: 'path',
    shape: 'curved',
    line: [[4270, 4975], [4285, 4962], [4300, 4970], [4318, 4958], [4330, 4945]],
    ...byCasi,
  })
  await ensure(payload, 'roads', { name: { equals: 'Coast Road' } }, {
    name: 'Coast Road',
    kind: 'highway',
    line: [[4296, 4952], [4100, 4990], [3900, 5010], [3650, 5060], [3416, 5096]],
    ...byAdmin,
  })
  await ensure(payload, 'events', { title: { equals: 'GirlieTea Live' } }, {
    title: 'GirlieTea Live',
    description: 'The column, read aloud, with tea. Bring a pink opinion.',
    startsAt: inDays(5),
    endsAt: inDays(5).replace('T18:', 'T20:'),
    place: tearoom,
    host: 'DefinitelyCasi',
    ...byCasi,
  })
  await ensure(payload, 'events', { title: { equals: 'Coast Road Ride' } }, {
    title: 'Coast Road Ride',
    description: 'A boat-and-horse convoy from GirlieTown to Oasis, opening the Coast Road.',
    startsAt: inDays(12),
    point: { x: 4296, z: 4952 },
    host: 'The Government of Azania',
    ...byAdmin,
  })
  await ensure(payload, 'map-views', { title: { equals: 'Petal Lane to the Tea Room' } }, {
    title: 'Petal Lane to the Tea Room',
    centre: { x: 4296, z: 4945 },
    span: 160,
    aspect: 'wide',
    layers: ['towns', 'places', 'roads'],
    drawings: [
      { kind: 'line', points: [[4264, 4952], [4280, 4951], [4292, 4946]], ink: 'rose', weight: 2, arrow: true },
      { kind: 'text', at: [4266, 4958], ink: 'ink', text: 'Walk up Petal Lane' },
      { kind: 'area', points: [[4286, 4928], [4306, 4928], [4306, 4946], [4286, 4946]], ink: 'rose', label: 'Tea here' },
    ],
    ...byCasi,
  })
}
