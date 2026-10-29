import { worldReading } from '@/lib/snapshot'
import { packWorld, WORLD_EVERY_S } from '@/maps/world'

/**
 * Every Towny town and nation on the Rulercraft map, for Azania Maps'
 * layer of the rest of the world (src/maps/world.ts):
 *
 *   { at, nations: [{ name, colour, capital, towns, residents, chunks }], towns: [...] }
 *
 * with each town's claims packed as steps from corner to corner
 * (PackedOutline), which halves what a visit downloads. The address
 * changed with the packing, from /maps/world: a tab opened before then asks
 * the old one, finds nothing, and keeps the world it has.
 *
 * Read from the map's marker file and passed on. The CDN shares one copy
 * among everyone for a quarter of an hour and keeps answering with it
 * while a fresh one is read. While the map is down, the world as last
 * saved (src/lib/snapshot.ts) is sent instead, marked `offline` (its `at`
 * says when the map wrote it), and asked again after a minute; with none
 * saved either, a 503, so the CDN keeps the copy it has rather than taking
 * an empty world in its place.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // One address, so every viewer shares the CDN's copy.
  if (new URL(request.url).search) return new Response('No query here.', { status: 400 })
  const reading = await worldReading()
  if (!reading) {
    return Response.json(
      { at: Date.now(), nations: [], towns: [], offline: true },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } },
    )
  }
  if (reading.saved) {
    return Response.json(
      { ...packWorld(reading.value), offline: true },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Vercel-CDN-Cache-Control': 'max-age=60, stale-if-error=86400',
          'X-Robots-Tag': 'noindex',
        },
      },
    )
  }
  return Response.json(packWorld(reading.value), {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Vercel-CDN-Cache-Control': `max-age=${WORLD_EVERY_S}, stale-while-revalidate=86400, stale-if-error=86400`,
      'X-Robots-Tag': 'noindex',
    },
  })
}
