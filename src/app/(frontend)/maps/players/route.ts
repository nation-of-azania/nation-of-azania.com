import { PLAYERS_EVERY_MS, readPlayers, type LivePlayers } from '@/maps/players'
import { DYNMAP_URL, DYNMAP_WORLD } from '@/maps/source'

/**
 * Who is on the Rulercraft server and where, for Azania Maps' players
 * layer (src/maps/players.ts):
 *
 *   { at, online: 5, players: [{ name: "Coug_", x: 4205, y: 77, z: -8706 }, …] }
 *
 * The Rulercraft map's feed allows no other site to read it from the
 * browser, so it comes through here. Nothing is stored: the CDN shares each
 * answer among everyone watching for a few seconds, so the map server sees
 * one request every few seconds however many people are looking, and none
 * while nobody is. Within one server, a burst of misses shares one read too.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FETCH_TIMEOUT_MS = 4000
/** While the map doesn't answer, ask it again only this often. */
const OFFLINE_SECONDS = 15

const seconds = Math.round(PLAYERS_EVERY_MS / 1000)
const LIVE = `max-age=${seconds}, stale-while-revalidate=${seconds + 2}, stale-if-error=30`
const DOWN = `max-age=${OFFLINE_SECONDS}`

let last: { at: number; body: LivePlayers } | null = null
let pending: Promise<LivePlayers> | null = null

async function read(): Promise<LivePlayers> {
  try {
    // A timestamp of now asks for no backlog of tile updates, only the players.
    const response = await fetch(`${DYNMAP_URL}/up/world/${DYNMAP_WORLD}/${Date.now()}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
      headers: { 'User-Agent': 'AzaniaMaps (+https://nation-of-azania.vercel.app/maps)' },
    })
    if (!response.ok) throw new Error(`The map answered ${response.status}`)
    return readPlayers(await response.json(), DYNMAP_WORLD)
  } catch {
    return { at: Date.now(), online: null, players: [], offline: true }
  }
}

export async function GET(request: Request) {
  // One address, so every viewer shares the CDN's copy; a query would only get around it.
  if (new URL(request.url).search) return new Response('No query here.', { status: 400 })
  if (!last || Date.now() - last.at >= PLAYERS_EVERY_MS - 500) {
    pending ??= read().finally(() => {
      pending = null
    })
    const body = await pending
    last = { at: Date.now(), body }
  }
  return Response.json(last.body, {
    headers: {
      'Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': last.body.offline ? DOWN : LIVE,
      'X-Robots-Tag': 'noindex',
    },
  })
}
