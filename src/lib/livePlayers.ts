import { readPlayers, type LivePlayers, type LiveSiege } from '@/maps/players'
import { DYNMAP_URL, DYNMAP_WORLD } from '@/maps/source'

import { demoPlayers, warDemo } from './warDemo'
import { siegeOf } from './world'

/**
 * Who is on the Rulercraft server and where, read from its map's live feed
 * for /maps/players (every three seconds) and /maps/players/live (the war
 * view's, every second and a half): src/maps/players.ts. Each route keeps
 * its last reading for under a second, so within one server a burst of
 * misses shares one read, and the CDN shares each answer among everyone
 * watching.
 *
 * The same feed carries every change to the map's markers since the time
 * it's asked from, and SiegeWar rewrites each siege's marker every fifteen
 * seconds with the whole of it: the score, the banner, the time left. So
 * each reading asks from where the last left off, keeps the latest of
 * every siege it has seen (in this server's memory, for a minute), and
 * passes them all on with the players. A browser that misses an answer
 * misses nothing, since every answer has every siege; one that asks often
 * has the battle fresh to fifteen seconds, without the 5 MB marker file
 * the war is otherwise read from (src/lib/world.ts).
 */

const FETCH_TIMEOUT_MS = 4000
/** How far back a reading asks when this server has no reading yet: past one rewrite of every siege's marker. */
const FIRST_LOOK_BACK_MS = 20_000
/** A siege not rewritten for this long has ended, or this server lost track: it's left out until it's seen again. */
const SIEGE_FORGOTTEN_MS = 60_000

const SIEGE_SET = 'siegewar.markerset'

type FeedUpdate = {
  type?: unknown
  msg?: unknown
  set?: unknown
  id?: unknown
  label?: unknown
  desc?: unknown
  icon?: unknown
  x?: unknown
  z?: unknown
  timestamp?: unknown
}

/** The sieges in a reading's updates, rewritten or ended, by the besieged town's Towny id. */
export function siegeUpdatesOf(updates: unknown): { rewritten: LiveSiege[]; ended: string[] } {
  const rewritten: LiveSiege[] = []
  const ended: string[] = []
  for (const update of Array.isArray(updates) ? (updates as FeedUpdate[]) : []) {
    if (update?.set !== SIEGE_SET || typeof update.id !== 'string') continue
    if (update.msg === 'markerdeleted') {
      ended.push(update.id)
      continue
    }
    if (update.msg !== 'markerupdated' && update.msg !== 'markercreated') continue
    const siege = siegeOf(
      update.id,
      {
        label: typeof update.label === 'string' ? update.label : undefined,
        desc: typeof update.desc === 'string' ? update.desc : undefined,
        icon: typeof update.icon === 'string' ? update.icon : undefined,
        x: typeof update.x === 'number' ? update.x : undefined,
        z: typeof update.z === 'number' ? update.z : undefined,
      },
      new Map(),
    )
    if (!siege) continue
    const markedAt = typeof update.timestamp === 'number' && Number.isFinite(update.timestamp) ? update.timestamp : Date.now()
    rewritten.push({ ...siege, markedAt })
  }
  return { rewritten, ended }
}

/** One feed, read from where it left off, keeping the latest of every siege it has carried; the battle tracker keeps its own. */
export function feed() {
  let since: number | null = null
  const sieges = new Map<string, LiveSiege>()
  return async function read(): Promise<LivePlayers> {
    if (warDemo()) return demoPlayers(Date.now())
    const now = Date.now()
    // From the last reading's time, never more than a little past one rewrite of the markers: the feed keeps no long backlog.
    const from = Math.max(since ?? 0, now - FIRST_LOOK_BACK_MS)
    try {
      const response = await fetch(`${DYNMAP_URL}/up/world/${DYNMAP_WORLD}/${from}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: 'no-store',
        headers: { 'User-Agent': 'AzaniaMaps (+https://nation-of-azania.vercel.app/maps)' },
      })
      if (!response.ok) throw new Error(`The map answered ${response.status}`)
      const body = (await response.json()) as { timestamp?: unknown; updates?: unknown }
      const reading = readPlayers(body, DYNMAP_WORLD)
      if (typeof body.timestamp === 'number' && Number.isFinite(body.timestamp)) since = body.timestamp
      const { rewritten, ended } = siegeUpdatesOf(body.updates)
      for (const siege of rewritten) {
        const kept = sieges.get(siege.townId)
        if (!kept || kept.markedAt <= siege.markedAt) sieges.set(siege.townId, siege)
      }
      for (const id of ended) sieges.delete(id)
      for (const [id, siege] of sieges) if (now - siege.markedAt > SIEGE_FORGOTTEN_MS) sieges.delete(id)
      return sieges.size ? { ...reading, sieges: [...sieges.values()] } : reading
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
