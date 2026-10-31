import { playersReader, playersResponse } from '@/lib/livePlayers'
import { PLAYERS_EVERY_MS } from '@/maps/players'

/**
 * Who is on the Rulercraft server and where, for Azania Maps' players
 * layer (src/maps/players.ts):
 *
 *   { at, online: 5, players: [{ name: "Coug_", x: 4205, y: 77, z: -8706, health: 20, armor: 7 }, …] }
 *
 * The Rulercraft map's feed allows no other site to read it from the
 * browser, so it comes through here (src/lib/livePlayers.ts). Nothing is
 * stored: the CDN shares each answer among everyone watching for a few
 * seconds, so the map server sees one request every few seconds however
 * many people are looking, and none while nobody is. The war view asks
 * /maps/players/live instead, which is fresher.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** While the map doesn't answer, ask it again only this often. */
const OFFLINE_SECONDS = 15

const seconds = Math.round(PLAYERS_EVERY_MS / 1000)
const CDN = {
  live: `max-age=${seconds}, stale-while-revalidate=${seconds + 2}, stale-if-error=30`,
  down: `max-age=${OFFLINE_SECONDS}`,
}

const players = playersReader(PLAYERS_EVERY_MS - 500)

export async function GET(request: Request) {
  // One address, so every viewer shares the CDN's copy; a query would only get around it.
  if (new URL(request.url).search) return new Response('No query here.', { status: 400 })
  return playersResponse(await players(), CDN)
}
