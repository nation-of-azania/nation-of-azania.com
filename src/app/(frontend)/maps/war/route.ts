import { getWar } from '@/lib/world'
import { CAPITAL_WAR_RADIUS, WAR_EVERY_S } from '@/maps/world'

/**
 * The war on the Rulercraft server, for Azania Maps (src/maps/world.ts):
 * sieges in progress as SiegeWar marks them on the map, and every nation's
 * capital with the reach of its war.
 *
 *   { at, sieges: [{ attacker, defender, town, at: [x, z], battle, … }], capitals: [...], radius: 12320 }
 *
 * Read from the map's marker file and passed on; nothing is stored. The
 * CDN shares one copy among everyone for three minutes (a siege moves by
 * the battle session), so the map server sees one read every few minutes
 * while anyone is looking and none otherwise.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (new URL(request.url).search) return new Response('No query here.', { status: 400 })
  const war = await getWar()
  if (!war) {
    return Response.json(
      { at: Date.now(), sieges: [], capitals: [], radius: CAPITAL_WAR_RADIUS, offline: true },
      { headers: { 'Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'max-age=60' } },
    )
  }
  return Response.json(war, {
    headers: {
      'Cache-Control': 'public, max-age=60',
      'Vercel-CDN-Cache-Control': `max-age=${WAR_EVERY_S}, stale-while-revalidate=600, stale-if-error=86400`,
      'X-Robots-Tag': 'noindex',
    },
  })
}
