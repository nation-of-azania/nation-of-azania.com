import { getWorld } from '@/lib/world'
import { WORLD_EVERY_S } from '@/maps/world'

/**
 * Every Towny town and nation on the Rulercraft map, for Azania Maps'
 * layer of the rest of the world (src/maps/world.ts):
 *
 *   { at, nations: [{ name, colour, capital, towns, residents, chunks }], towns: [...] }
 *
 * Read from the map's marker file and passed on; nothing is stored. The
 * CDN shares one copy among everyone for a quarter of an hour and keeps
 * answering with it while a fresh one is read, or while the map is down.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // One address, so every viewer shares the CDN's copy.
  if (new URL(request.url).search) return new Response('No query here.', { status: 400 })
  const world = await getWorld()
  if (!world) {
    return Response.json(
      { at: Date.now(), nations: [], towns: [], offline: true },
      { headers: { 'Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'max-age=60' } },
    )
  }
  return Response.json(world, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Vercel-CDN-Cache-Control': `max-age=${WORLD_EVERY_S}, stale-while-revalidate=86400, stale-if-error=86400`,
      'X-Robots-Tag': 'noindex',
    },
  })
}
