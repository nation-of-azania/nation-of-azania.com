import { feedReader, siegeUpdatesOf } from '@/maps/feed'
import type { LivePlayers } from '@/maps/players'
import { DYNMAP_URL, DYNMAP_WORLD } from '@/maps/source'

import { demoPlayers, warDemo } from './warDemo'

/**
 * Who is on the Rulercraft server and where, read from its map's live feed
 * on the server (src/maps/feed.ts): for the battle tracker, at its own pace,
 * and for /maps/players and /maps/players/live, which only the war demo on
 * one's own machine still asks. The map in the browser reads the feed itself,
 * through the /maps/feed rewrite (next.config.ts), so watching it costs this
 * site's functions nothing (src/components/maps/live.ts).
 */

const FETCH_TIMEOUT_MS = 4000

export { siegeUpdatesOf }

/** One feed, read from where it left off, keeping the latest of every siege it has carried (src/maps/feed.ts); the battle tracker keeps its own. */
export function feed() {
  const reader = feedReader(DYNMAP_WORLD)
  return async function read(): Promise<LivePlayers> {
    if (warDemo()) return demoPlayers(Date.now())
    const now = Date.now()
    try {
      const response = await fetch(`${DYNMAP_URL}/up/world/${DYNMAP_WORLD}/${reader.since(now)}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: 'no-store',
        headers: { 'User-Agent': 'AzaniaMaps (+https://nation-of-azania.vercel.app/maps)' },
      })
      if (!response.ok) throw new Error(`The map answered ${response.status}`)
      return reader.take(await response.json(), now)
    } catch {
      return { at: now, online: null, players: [], offline: true }
    }
  }
}

/** A reader that reads at most once per `everyMs` and shares a read in flight. */
export function playersReader(everyMs: number): () => Promise<LivePlayers> {
  const read = feed()
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
