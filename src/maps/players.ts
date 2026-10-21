import { WORLD_LIMIT } from './geo'

/**
 * Who is on the Rulercraft server and where, as the map's live feed has it
 * (Dynmap's `up/world/<world>/<timestamp>`, which the Rulercraft map itself
 * polls every few seconds). Azania Maps passes it on through
 * /maps/players and keeps none of it: the positions live only in the
 * browser that asked. Players the server hides (vanished, invisible, in
 * another world) aren't in the feed, so they aren't here either.
 */

export type LivePlayer = {
  /** The Minecraft name; Bedrock players' start with ".". */
  name: string
  x: number
  y: number
  z: number
}

export type LivePlayers = {
  /** When the server answered, in ms since the epoch: the map's own clock. */
  at: number
  /** Everyone online, shown on the map or not. */
  online: number | null
  /** Those on the map, in the main world. */
  players: LivePlayer[]
  /** True when the map didn't answer; the list is then empty. */
  offline?: boolean
}

/** How often the map in the browser asks, and the CDN refreshes the answer. */
export const PLAYERS_EVERY_MS = 3000

type FeedPlayer = {
  type?: unknown
  world?: unknown
  account?: unknown
  name?: unknown
  x?: unknown
  y?: unknown
  z?: unknown
}

const isName = (value: unknown): value is string => typeof value === 'string' && /^\.?\w{3,16}$/.test(value)
const isCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= WORLD_LIMIT

/**
 * The feed trimmed to what the map draws: name and position, for players in
 * `world`. Health, armour and the rest stay behind; anything malformed is
 * dropped rather than trusted.
 */
export function readPlayers(feed: unknown, world: string): LivePlayers {
  const body = (feed ?? {}) as { timestamp?: unknown; currentcount?: unknown; players?: unknown }
  const players: LivePlayer[] = []
  for (const entry of Array.isArray(body.players) ? (body.players as FeedPlayer[]) : []) {
    if (entry?.type !== 'player' || entry.world !== world) continue
    const name = isName(entry.account) ? entry.account : isName(entry.name) ? entry.name : null
    if (!name || !isCoordinate(entry.x) || !isCoordinate(entry.z)) continue
    players.push({
      name,
      x: Math.round(entry.x),
      y: typeof entry.y === 'number' && Number.isFinite(entry.y) ? Math.round(entry.y) : 64,
      z: Math.round(entry.z),
    })
  }
  players.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  return {
    at: typeof body.timestamp === 'number' && Number.isFinite(body.timestamp) ? body.timestamp : Date.now(),
    online: typeof body.currentcount === 'number' ? body.currentcount : null,
    players,
  }
}
