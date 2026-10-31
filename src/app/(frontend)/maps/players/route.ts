import { playersReader, playersResponse } from '@/lib/livePlayers'

/**
 * Who is on the Rulercraft server and where, for Azania Maps' players
 * layer (src/maps/players.ts):
 *
 *   { at, online: 5, players: [{ name: "Coug_", x: 4205, y: 77, z: -8706, health: 20, armor: 7 }, …] }
 *
 * The Rulercraft map's feed allows no other site to read it from the
 * browser, so it comes through here (src/lib/livePlayers.ts). Nothing is
 * stored: the CDN shares each answer among everyone watching for a
 * second, so the map server sees at most one request a second however
 * many people are looking, and none while nobody is. The war view asks
 * /maps/players/live, which is the same, more often.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** While the map doesn't answer, ask it again only this often. */
const OFFLINE_SECONDS = 15

/**
 * Shared by everyone at the CDN for one second, and never older: an answer
 * served stale while a fresher one was fetched (as this used to allow, for
 * five seconds more, on top of a reading this server kept for two and a
 * half) put the heads ten seconds behind the Rulercraft map's own. The map
 * server still sees at most one request a second however many are
 * looking, and none while nobody is; the browser asks every three
 * seconds (src/maps/players.ts). Kept for half a minute only when the map
 * fails to answer.
 */
const CDN = {
  live: 'max-age=1, stale-if-error=30',
  down: `max-age=${OFFLINE_SECONDS}`,
}

const players = playersReader(900)

export async function GET(request: Request) {
  // One address, so every viewer shares the CDN's copy; a query would only get around it.
  if (new URL(request.url).search) return new Response('No query here.', { status: 400 })
  return playersResponse(await players(), CDN)
}
