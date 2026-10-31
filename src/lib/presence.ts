import { getCache } from '@vercel/functions'
import type { Payload } from 'payload'

import { DYNMAP_URL, DYNMAP_WORLD } from '../maps/source'

/**
 * Who is online on the Rulercraft server, recorded by the watch every five
 * minutes, for the fighters' usual hours (src/maps/presence.ts reads it).
 *
 * The watch mostly leaves the database asleep (src/lib/quietWatch.ts), so
 * what it sees is gathered in Vercel's runtime cache, one entry a day: for
 * each player online, a bit for each of the day's 288 five-minute slots.
 * A run that goes to the database anyway, which happens at least every six
 * hours and on the first run of a day, adds the cache's days to the
 * database's (Presence, src/collections/maps/PresenceDays.ts) and forgets
 * them. Should the cache lose an entry before then, those hours are missing
 * from the record, nothing worse.
 */

export const SLOT_MINUTES = 5
export const SLOTS = (24 * 60) / SLOT_MINUTES
const BYTES = SLOTS / 8
const KEY = (day: string) => `azania-maps:presence:${day}`
const DAYS_KEY = 'azania-maps:presence:days'
const TTL_S = 4 * 24 * 60 * 60
const FETCH_TIMEOUT_MS = 4000
/** A Minecraft name, or a Bedrock one (a dot first). */
const ACCOUNT = /^\.?[A-Za-z0-9_]{1,24}$/

export type DaySlots = Record<string, string>

export const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
export const slotOf = (ms: number): number => Math.floor((ms % 86_400_000) / (SLOT_MINUTES * 60_000))

export function bitsOf(packed: string | undefined): Uint8Array {
  const bytes = new Uint8Array(BYTES)
  if (!packed) return bytes
  try {
    const text = atob(packed)
    for (let i = 0; i < Math.min(BYTES, text.length); i++) bytes[i] = text.charCodeAt(i)
  } catch {
    // An unreadable entry counts as none.
  }
  return bytes
}

export function packBits(bytes: Uint8Array): string {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text)
}

export const hasSlot = (bytes: Uint8Array, slot: number): boolean => Boolean(bytes[slot >> 3] & (1 << (slot & 7)))

/** `day` with each of `names` online in `slot`. */
export function withSlot(day: DaySlots, names: string[], slot: number): DaySlots {
  const next = { ...day }
  for (const name of names) {
    const bytes = bitsOf(next[name])
    bytes[slot >> 3] |= 1 << (slot & 7)
    next[name] = packBits(bytes)
  }
  return next
}

/** Two records of one day as one: online in a slot in either. */
export function mergeDays(a: DaySlots, b: DaySlots): DaySlots {
  const next = { ...a }
  for (const [name, packed] of Object.entries(b)) {
    const bytes = bitsOf(next[name])
    const more = bitsOf(packed)
    for (let i = 0; i < BYTES; i++) bytes[i] |= more[i]
    next[name] = packBits(bytes)
  }
  return next
}

const isDay = (value: unknown): value is DaySlots =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.values(value as object).every((item) => typeof item === 'string')

/** Who is online now, from the map's live feed; null when it doesn't answer. */
export async function onlineNow(): Promise<string[] | null> {
  try {
    const response = await fetch(`${DYNMAP_URL}/up/world/${DYNMAP_WORLD}/${Date.now()}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
      headers: { 'User-Agent': 'AzaniaMaps (+https://nation-of-azania.vercel.app/maps)' },
    })
    if (!response.ok) return null
    // Every player the feed lists, whichever world they're in: online is online. By account, the name as typed (the
    // feed's `name` is the display name, colours and all).
    const body = (await response.json()) as { players?: { account?: unknown }[] }
    const names = (body.players ?? []).map((player) => player.account).filter((name): name is string => typeof name === 'string' && ACCOUNT.test(name))
    return [...new Set(names)]
  } catch {
    return null
  }
}

/** Notes who is online now in the cache's record of the day. */
export async function notePresence(now = Date.now(), names?: string[] | null): Promise<number | null> {
  const online = names ?? (await onlineNow())
  if (!online) return null
  const day = dayOf(now)
  try {
    const cache = getCache()
    const kept = await cache.get(KEY(day))
    await cache.set(KEY(day), withSlot(isDay(kept) ? kept : {}, online, slotOf(now)), { ttl: TTL_S, name: 'Azania Maps presence' })
    const days = await cache.get(DAYS_KEY)
    const list = Array.isArray(days) ? days.filter((item): item is string => typeof item === 'string') : []
    if (!list.includes(day)) await cache.set(DAYS_KEY, [...list, day].slice(-4), { ttl: TTL_S })
  } catch {
    return null
  }
  return online.length
}

/** Adds the cache's days to the database's and forgets them; for a run that has the database awake anyway. */
export async function flushPresence(payload: Payload): Promise<string[]> {
  const cache = getCache()
  const days = await cache.get(DAYS_KEY).catch(() => null)
  const list = Array.isArray(days) ? days.filter((item): item is string => typeof item === 'string') : []
  const flushed: string[] = []
  for (const day of list) {
    const kept = await cache.get(KEY(day)).catch(() => null)
    if (!isDay(kept) || Object.keys(kept).length === 0) continue
    const { docs } = await payload.find({ collection: 'presence-days', where: { day: { equals: day } }, limit: 1, depth: 0 })
    const stored = docs[0]
    const slots = mergeDays(isDay(stored?.slots) ? stored.slots : {}, kept)
    const data = { day, slots, players: Object.keys(slots).length }
    if (stored) await payload.update({ collection: 'presence-days', id: stored.id, data, depth: 0, overrideAccess: true })
    else await payload.create({ collection: 'presence-days', data, depth: 0, overrideAccess: true })
    flushed.push(day)
  }
  // Forget what's now in the database; today's record starts again from what's to come.
  for (const day of flushed) await cache.delete(KEY(day)).catch(() => {})
  await cache.set(DAYS_KEY, list.filter((day) => !flushed.includes(day)), { ttl: TTL_S }).catch(() => {})
  return flushed
}
