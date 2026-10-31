import { readPlayers, type LivePlayers } from '@/maps/players'
import { DYNMAP_URL, DYNMAP_WORLD } from '@/maps/source'

import { demoPlayers, warDemo } from './warDemo'

/**
 * Who is on the Rulercraft server and where, read from its map's live feed
 * for /maps/players (every three seconds) and /maps/players/live (the war
 * view's, every second): src/maps/players.ts. Nothing is stored. Each
 * route keeps its last reading for a little under its own beat, so within
 * one server a burst of misses shares one read, and the CDN shares each
 * answer among everyone watching.
 */

const FETCH_TIMEOUT_MS = 4000

async function read(): Promise<LivePlayers> {
  if (warDemo()) return demoPlayers(Date.now())
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

/** A reader that reads at most once per `everyMs` and shares a read in flight. */
export function playersReader(everyMs: number): () => Promise<LivePlayers> {
  let last: { at: number; body: LivePlayers } | null = null
  let pending: Promise<LivePlayers> | null = null
  return async () => {
    if (!last || Date.now() - last.at >= everyMs) {
      pending ??= read().finally(() => {
        pending = null
      })
      const body = await pending
      last = { at: Date.now(), body }
    }
    return last.body
  }
}

/** The answer, with the CDN told how long to share it: `live` while the map answers, `down` while it doesn't. */
export function playersResponse(body: LivePlayers, cdn: { live: string; down: string }): Response {
  return Response.json(body, {
    headers: {
      'Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': body.offline ? cdn.down : cdn.live,
      'X-Robots-Tag': 'noindex',
    },
  })
}
