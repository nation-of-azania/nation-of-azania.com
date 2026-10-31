import { WORLD_LIMIT } from './geo'

/**
 * Who is on the Rulercraft server and where, as the map's live feed has it
 * (Dynmap's `up/world/<world>/<timestamp>`, which the Rulercraft map itself
 * polls every three seconds, and which the server rewrites about every one
 * and a half). Azania Maps passes it on through /maps/players and keeps
 * none of it: the positions live only in the browser that asked. Players
 * the server hides (vanished, invisible, in another world) aren't in the
 * feed, so they aren't here either.
 */

export type LivePlayer = {
  /** The Minecraft name; Bedrock players' start with ".". */
  name: string
  x: number
  y: number
  z: number
  /** Health, 0 to 20 (two to a heart), to the half; null when the feed doesn't say. */
  health: number | null
  /** Armour points, 0 to 20 (two to an armour icon); null when the feed doesn't say. */
  armor: number | null
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

/**
 * How often the war view asks instead, from /maps/players/live, which the
 * CDN refreshes every second: in a fight, a head three seconds behind is a
 * head in the wrong place. The server writes a reading about every 1.5 s.
 */
export const LIVE_PLAYERS_EVERY_MS = 1500

/** The highest health and armour the feed gives: 20 each, ten hearts and ten chestplate icons. */
export const MAX_HEALTH = 20
export const MAX_ARMOR = 20

/** A move further than this between two readings is a teleport (`/t spawn`), and a head jumps rather than glides. */
export const TELEPORT_BLOCKS = 300

/** Bedrock players' names start with a dot; the skin service has no head for them. */
export const isBedrockName = (name: string): boolean => name.startsWith('.')

/**
 * The town a player is a resident of, among the nation's, by name as Towny
 * lists residents; null for anyone who isn't Azanian. Case doesn't matter,
 * since the feed and the marker file don't always agree on it.
 */
export function townOfPlayer<T extends { names: string[] }>(name: string, towns: T[]): T | null {
  const wanted = name.toLowerCase()
  return towns.find((town) => town.names.some((resident) => resident.toLowerCase() === wanted)) ?? null
}

type FeedPlayer = {
  type?: unknown
  world?: unknown
  account?: unknown
  name?: unknown
  x?: unknown
  y?: unknown
  z?: unknown
  health?: unknown
  armor?: unknown
}

const isName = (value: unknown): value is string => typeof value === 'string' && /^\.?\w{3,16}$/.test(value)
const isCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= WORLD_LIMIT

/** A stat of the feed's, 0 to `max`, to the half; null when it isn't one. */
const statOf = (value: unknown, max: number): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value * 2) / 2)) : null

/**
 * The feed trimmed to what the map draws: name, position, health and
 * armour, for players in `world`. The rest stays behind; anything
 * malformed is dropped rather than trusted.
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
      health: statOf(entry.health, MAX_HEALTH),
      armor: statOf(entry.armor, MAX_ARMOR),
    })
  }
  players.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  return {
    at: typeof body.timestamp === 'number' && Number.isFinite(body.timestamp) ? body.timestamp : Date.now(),
    online: typeof body.currentcount === 'number' ? body.currentcount : null,
    players,
  }
}
