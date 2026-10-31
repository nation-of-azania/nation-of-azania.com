import { playersReader, playersResponse } from '@/lib/livePlayers'

/**
 * The players feed of /maps/players, fresh to the second, for the war view
 * (src/maps/players.ts → LIVE_PLAYERS_EVERY_MS): in a fight a head three
 * seconds behind is in the wrong place. The CDN shares each answer for one
 * second and never serves an older one, so the map server sees at most one
 * request a second, and only while someone has the war view open; the
 * rest of the map stays on the three-second feed.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CDN = { live: 'max-age=1', down: 'max-age=10' }

const players = playersReader(900)

export async function GET(request: Request) {
  if (new URL(request.url).search) return new Response('No query here.', { status: 400 })
  return playersResponse(await players(), CDN)
}
