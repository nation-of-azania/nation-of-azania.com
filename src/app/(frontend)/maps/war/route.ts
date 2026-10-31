import { warResponse } from '@/lib/warResponse'
import { WAR_EVERY_S } from '@/maps/world'

/**
 * The war on the Rulercraft server, for Azania Maps (src/maps/world.ts):
 * sieges in progress as SiegeWar marks them on the map, and every nation's
 * capital with the reach of its war.
 *
 *   { at, sieges: [{ attacker, defender, town, at: [x, z], battle, … }], capitals: [...], radius: 12320 }
 *
 * Read from the map's marker file and passed on. The CDN shares one copy
 * among everyone for three minutes (a siege moves by the battle session),
 * so the map server sees one read every few minutes while anyone is
 * looking and none otherwise. While the map is down, the war as last saved
 * (src/lib/snapshot.ts), marked `offline`; with none saved either, a 503.
 * The war view, during a battle, asks /maps/war/live instead.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (new URL(request.url).search) return new Response('No query here.', { status: 400 })
  return warResponse({ live: false, everyS: WAR_EVERY_S, staleS: 600 })
}
