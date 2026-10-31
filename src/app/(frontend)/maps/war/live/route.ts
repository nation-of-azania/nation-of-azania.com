import { warResponse } from '@/lib/warResponse'
import { WAR_LIVE_EVERY_S } from '@/maps/world'

/**
 * The war of /maps/war, fresh to half a minute, for the war view while a
 * battle is on (src/maps/world.ts → WAR_LIVE_EVERY_S): the score moves
 * every 20 seconds. The marker file it comes from is some 5 MB, so the CDN
 * shares each answer for half a minute, and the map server sees one read
 * per half minute only while someone has the war view open on a battle.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (new URL(request.url).search) return new Response('No query here.', { status: 400 })
  return warResponse({ live: true, everyS: WAR_LIVE_EVERY_S, staleS: 15 })
}
