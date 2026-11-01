import { getCache } from '@vercel/functions'
import type { Payload } from 'payload'

import { sameNation } from '../maps/abroad'
import { alliedBy, allySide, type Allied } from '../maps/alliances'
import { RULES, bannerOf, secondsLeftOf, sideOf } from '../maps/battle'
import {
  FAR,
  KEEP_WITHIN,
  attended,
  coverageOf,
  fighterOf,
  mergeMoments,
  mergeTimes,
  packMoments,
  packTimes,
  unpackMoments,
  unpackTimes,
  type Allegiance,
  type FighterSide,
  type Mark,
  type Moment,
} from '../maps/fights'
import type { LiveSiege } from '../maps/players'
import { pointsOf } from '../maps/sieges'
import type { Siege, World, WorldTown } from '../maps/world'
import { FOLLOW_MS, diedBetween, followed, type Fix, type Follow } from '../maps/motion'
import { knownAlliances } from './alliances'
import { feed } from './livePlayers'
import { getWorld } from './world'

/**
 * The battle tracker: through a battle session, the map's live feed read
 * every few seconds, and for every siege with a battle on, each player near
 * its banner kept, reading by reading (src/maps/fights.ts says what's made
 * of it). Run by the watch (src/lib/watch.ts, /maps/watch), which the cron
 * job asks every five minutes: when the map shows a battle, the watch
 * answers and then keeps reading for most of the five minutes, and the next
 * ask picks up where it stopped, so a session is read end to end with gaps
 * of seconds. At the end of each stint it adds what it read to the battle's
 * row (Battles, src/collections/maps/Battles.ts), the database being awake
 * through a battle anyway.
 *
 * What it costs: a function kept alive through battle sessions, a small
 * read of the map every three seconds (about as often as the Rulercraft
 * map's own page reads it), and a write every five minutes. Held to
 * MONTHLY_HOURS of reading a month, a third of what the free plan's
 * memory-time allows, so it can't crowd out the rest of the site.
 */

/** A reading this often: SiegeWar looks every 20 seconds, so this sees every look and most of what happens between. */
export const READ_EVERY_MS = 3000
/** At most this many hours of reading a month (reset each month, UTC). */
export const MONTHLY_HOURS = 60
/** The readings are kept this long for working a battle out again; what was made of them, for good. */
const TRACK_KEPT_DAYS = 60

const LEASE_KEY = 'azania-maps:tracker:lease'
/** Dead fighters still being followed for their first teleport, carried from one stint to the next. */
const FOLLOWS_KEY = 'azania-maps:tracker:follows'

/** A dead fighter followed, and the battle they died in. */
type Following = Follow & { battle: string }
/** What a follow came to: when they died (ms), and how long after it they first teleported (s; null: not within a quarter of an hour). */
export type Respawn = { name: string; died: number; teleport: number | null }

async function loadFollows(): Promise<Map<string, Following>> {
  try {
    const kept = (await getCache().get(FOLLOWS_KEY)) as [string, Following][] | null
    return new Map(Array.isArray(kept) ? kept : [])
  } catch {
    return new Map()
  }
}

async function keepFollows(follows: Map<string, Following>): Promise<void> {
  try {
    await getCache().set(FOLLOWS_KEY, [...follows], { ttl: 3600 })
  } catch {
    // Lost: those follows end without a teleport seen.
  }
}
const budgetKey = (now: number) => `azania-maps:tracker:budget:${new Date(now).toISOString().slice(0, 7)}`

type Battle = {
  key: string
  siege: Siege
  start: number
  readings: number[]
  players: Map<string, Moment[]>
  marks: Mark[]
  online: Set<string>
}

/** When a battle's session began, from its marker's time left: to the minute, so every stint names the same session. */
export function sessionStartOf(siege: Pick<Siege, 'battleTimeLeft'>, at: number, sessionMinutes = 60): number | null {
  const left = secondsLeftOf(siege.battleTimeLeft)
  if (left === null) return null
  return Math.round((at + left * 1000 - sessionMinutes * 60_000) / 60_000) * 60_000
}

const battleKey = (siege: Pick<Siege, 'townId' | 'attacker'>, start: number) => `${siege.townId}|${siege.attacker}|${new Date(start).toISOString()}`

const markOf = (siege: LiveSiege | Siege, t: number): Mark => {
  const banner = bannerOf(siege)
  const points = pointsOf(siege)
  return { t, banner: banner.side, holders: banner.holders, attacker: points?.attacker ?? 0, defender: points?.defender ?? 0 }
}

/** A player's town, by the world's resident lists. */
function townOf(name: string, world: World | null): WorldTown | null {
  const wanted = name.toLowerCase()
  return world?.towns.find((town) => town.people.some((person) => person.toLowerCase() === wanted)) ?? null
}

const fighterSide = (name: string, siege: Siege, world: World | null): FighterSide => sideOf(townOf(name, world), siege)

/**
 * Who a player fought for as far as is known before their play: their own
 * side (`side`, by where they lived when first read), or for one of
 * neither, the side an alliance of their nation's puts them on; and their
 * nation, kept with the battle so alliances can be told from it later.
 */
function allegianceOf(name: string, side: FighterSide, siege: Siege, world: World | null, allied: Allied): Allegiance {
  const nation = townOf(name, world)?.nation ?? null
  return { side, nation, allied: side === 'other' ? allySide(nation, siege, allied) : null }
}

/** Whether a lease lets this stint read: none running, or the last one's ended. Not airtight; two stints at once only read twice. */
async function takeLease(until: number): Promise<boolean> {
  try {
    const cache = getCache()
    const lease = (await cache.get(LEASE_KEY)) as { until?: number } | null
    if (lease?.until && lease.until > Date.now() + 5000) return false
    await cache.set(LEASE_KEY, { until }, { ttl: 600 })
    return true
  } catch {
    return true
  }
}

async function budgetLeft(now: number): Promise<number> {
  try {
    const used = Number(await getCache().get(budgetKey(now))) || 0
    return MONTHLY_HOURS * 3600 - used
  } catch {
    return MONTHLY_HOURS * 3600
  }
}

async function spend(now: number, seconds: number): Promise<void> {
  try {
    const cache = getCache()
    const used = Number(await cache.get(budgetKey(now))) || 0
    await cache.set(budgetKey(now), used + seconds, { ttl: 40 * 24 * 60 * 60 })
  } catch {
    // Unmetered this time.
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type TrackResult = { status: 'tracked' | 'busy' | 'over budget' | 'no battle'; battles: string[]; readings: number }

/**
 * Reads the map until `until` (a time), keeping every battle's players near
 * its banner, then adds what it read to the battles' rows. `sieges` are
 * the sieges as the watch read them; the feed's own marker updates take
 * over from there. `payloadOf` gives Payload when there's something to
 * save, and only then (starting it connects to the database).
 */
export async function trackBattles(payloadOf: () => Promise<Payload>, sieges: Siege[], until: number): Promise<TrackResult> {
  const began = Date.now()
  // Sieges with no battle on yet are read too: the feed's marker updates say when one starts (the file can be a minute behind).
  if (!sieges.length) return { status: 'no battle', battles: [], readings: 0 }
  if ((await budgetLeft(began)) <= 0) return { status: 'over budget', battles: [], readings: 0 }
  if (!(await takeLease(until))) return { status: 'busy', battles: [], readings: 0 }

  const read = feed()
  const battles = new Map<string, Battle>()
  const latest = new Map<string, Siege>(sieges.map((siege) => [siege.townId, siege]))
  let readings = 0
  // Each player's last reading, to tell deaths and teleports; dead fighters followed for their first teleport.
  const lastFix = new Map<string, Fix>()
  const follows = await loadFollows()
  const done: (Respawn & { battle: string })[] = []

  while (Date.now() < until) {
    const askedAt = Date.now()
    const reading = await read()
    if (!reading.offline) {
      readings++
      for (const siege of reading.sieges ?? []) latest.set(siege.townId, siege)
      for (const siege of latest.values()) {
        if (!siege.battle) continue
        const at = 'markedAt' in siege && typeof siege.markedAt === 'number' ? (siege.markedAt as number) : reading.at
        const start = sessionStartOf(siege, at)
        if (start === null) continue
        const key = battleKey(siege, start)
        let battle = battles.get(key)
        if (!battle) {
          battle = { key, siege, start, readings: [], players: new Map(), marks: [], online: new Set() }
          battles.set(key, battle)
        }
        battle.siege = siege
        const t = Math.round((reading.at - start) / 1000)
        if (t < 0 || t > 2 * 3600) continue
        battle.readings.push(t)
        const markT = Math.round((at - start) / 1000)
        if (!battle.marks.some((mark) => mark.t === markT)) battle.marks.push(markOf(siege, markT))
        const [bx, bz] = siege.at
        for (const player of reading.players) {
          battle.online.add(player.name)
          const d = Math.hypot(player.x - bx, player.z - bz)
          const moments = battle.players.get(player.name)
          if (d <= KEEP_WITHIN) {
            const list = moments ?? []
            list.push({ t, d: Math.round(d), h: player.health, a: player.armor })
            battle.players.set(player.name, list)
          } else if (moments?.length && moments[moments.length - 1].d !== FAR) {
            moments.push({ t, d: FAR, h: player.health, a: player.armor })
          }
        }
      }
      // Deaths in a battle's siege zone, and how long until the dead first teleport: what the lock after a death is.
      for (const player of reading.players) {
        const fix: Fix = { at: reading.at, x: player.x, z: player.z, health: player.health }
        const before = lastFix.get(player.name)
        lastFix.set(player.name, fix)
        const following = follows.get(player.name)
        if (before && diedBetween(before, fix)) {
          const battle = [...battles.values()].find((one) => Math.hypot(before.x - one.siege.at[0], before.z - one.siege.at[1]) <= RULES.siegeZoneRadius)
          if (battle) {
            follows.set(player.name, { died: before.at, last: fix, teleport: null, battle: battle.key })
            continue
          }
        }
        if (!following) continue
        const next = followed(following, fix)
        if (next.teleport !== null) {
          done.push({ name: player.name, died: next.died, teleport: Math.round((next.teleport - next.died) / 1000), battle: following.battle })
          follows.delete(player.name)
        } else follows.set(player.name, { ...next, battle: following.battle })
      }
      for (const [name, following] of follows) {
        if (reading.at - following.died > FOLLOW_MS) {
          done.push({ name, died: following.died, teleport: null, battle: following.battle })
          follows.delete(name)
        }
      }
    }
    await pause(Math.max(250, READ_EVERY_MS - (Date.now() - askedAt)))
  }
  await spend(began, (Date.now() - began) / 1000)
  await keepFollows(follows)

  const world = await getWorld()
  const saved: string[] = []
  // Payload (and with it the database) only now, with something to save: a battle wakes the database anyway.
  const payload = battles.size || done.length ? await payloadOf() : null
  // The alliances known (src/lib/alliances.ts), for those who fought for a side they don't live with.
  const allied = payload && battles.size ? alliedBy(await knownAlliances(payload).catch(() => [])) : alliedBy([])
  for (const battle of battles.values()) {
    if (!payload) break
    try {
      await saveBattle(payload, battle, world, done.filter((respawn) => respawn.battle === battle.key), allied)
      saved.push(battle.key)
    } catch (error) {
      payload.logger.error({ err: error, msg: `Battle tracker: saving ${battle.key} failed` })
    }
  }
  // Follows that end after their battle's last stint: added to its row on their own.
  for (const key of new Set(done.filter((respawn) => !battles.has(respawn.battle)).map((respawn) => respawn.battle))) {
    if (!payload) break
    await addRespawns(payload, key, done.filter((respawn) => respawn.battle === key)).catch((error: unknown) =>
      payload.logger.error({ err: error, msg: `Battle tracker: saving the respawns of ${key} failed` }),
    )
  }
  return { status: 'tracked', battles: saved, readings }
}

const withRespawns = (stored: unknown, more: Respawn[]): Respawn[] => {
  const kept = Array.isArray(stored) ? (stored as Respawn[]) : []
  const seen = new Set(kept.map((respawn) => `${respawn.name}|${respawn.died}`))
  return [...kept, ...more.filter((respawn) => !seen.has(`${respawn.name}|${respawn.died}`)).map(({ name, died, teleport }) => ({ name, died, teleport }))]
}

async function addRespawns(payload: Payload, key: string, more: Respawn[]): Promise<void> {
  const { docs } = await payload.find({ collection: 'battles', where: { key: { equals: key } }, limit: 1, depth: 0, select: { respawns: true } })
  if (!docs[0]) return
  await payload.update({ collection: 'battles', id: docs[0].id, data: { respawns: withRespawns(docs[0].respawns, more) }, depth: 0, overrideAccess: true })
}

type StoredTrack = { readings?: string; marks?: Mark[]; players?: Record<string, { side?: FighterSide; moments?: string }> }

/** Adds a stint's readings to the battle's row and works the battle out again from all of them. */
async function saveBattle(payload: Payload, battle: Battle, world: World | null, respawns: Respawn[] = [], allied: Allied = alliedBy([])): Promise<void> {
  const { docs } = await payload.find({ collection: 'battles', where: { key: { equals: battle.key } }, limit: 1, depth: 0 })
  const stored = docs[0]
  const track = (stored?.track ?? {}) as StoredTrack
  const readings = mergeTimes(unpackTimes(track.readings ?? ''), battle.readings)
  const marks = [...new Map([...(track.marks ?? []), ...battle.marks].map((mark) => [mark.t, mark])).values()].sort((a, b) => a.t - b.t)
  const players = new Map<string, { side: FighterSide; moments: Moment[] }>()
  for (const [name, kept] of Object.entries(track.players ?? {})) {
    players.set(name, { side: kept.side ?? 'other', moments: unpackMoments(kept.moments ?? '') })
  }
  for (const [name, moments] of battle.players) {
    const kept = players.get(name)
    // A side once found stays: a player who leaves their town mid-battle fought for the side they were on.
    const side = kept?.side && kept.side !== 'other' ? kept.side : fighterSide(name, battle.siege, world)
    players.set(name, { side, moments: mergeMoments(kept?.moments ?? [], moments) })
  }
  const fighters = [...players]
    .map(([name, { side, moments }]) => fighterOf(name, allegianceOf(name, side, battle.siege, world, allied), readings, moments, marks))
    .filter((fighter) => fighter.first !== null)
  // Who could have fought: the two sides' residents online during the battle.
  const before = (stored?.sides ?? {}) as { attackers?: string[]; defenders?: string[] }
  const residentsOf = (nation: string | null | undefined) =>
    nation ? new Set((world?.towns ?? []).filter((town) => sameNation(town.nation, nation) || sameNation(town.name, nation)).flatMap((town) => town.people)) : new Set<string>()
  const attackerResidents = residentsOf(battle.siege.attacker)
  const defenderResidents = new Set([...residentsOf(battle.siege.defender), ...(world?.towns.find((town) => town.id === battle.siege.townId)?.people ?? [])])
  const sides = {
    attackers: [...new Set([...(before.attackers ?? []), ...[...battle.online].filter((name) => attackerResidents.has(name))])].sort(),
    defenders: [...new Set([...(before.defenders ?? []), ...[...battle.online].filter((name) => defenderResidents.has(name))])].sort(),
  }
  const last = marks[marks.length - 1]
  const data = {
    key: battle.key,
    title: `${battle.siege.town ?? 'A town'}: ${battle.siege.attacker} vs ${battle.siege.defender}, ${new Date(battle.start).toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    startedAt: new Date(battle.start).toISOString(),
    town: battle.siege.town,
    townId: battle.siege.townId,
    attacker: battle.siege.attacker,
    defender: battle.siege.defender,
    session: battle.siege.progress?.done ?? null,
    coverage: Math.round(coverageOf(readings) * 1000) / 1000,
    fought: fighters.filter(attended).length,
    trackKeptUntil: new Date(battle.start + TRACK_KEPT_DAYS * 86_400_000).toISOString(),
    banner: battle.siege.at,
    result: last ? { banner: last.banner, holders: last.holders, attacker: last.attacker, defender: last.defender } : null,
    sides,
    fighters,
    respawns: withRespawns(stored?.respawns, respawns),
    track: {
      readings: packTimes(readings),
      marks,
      players: Object.fromEntries([...players].map(([name, { side, moments }]) => [name, { side, moments: packMoments(moments) }])),
    },
  }
  if (stored) await payload.update({ collection: 'battles', id: stored.id, data, depth: 0, overrideAccess: true })
  else await payload.create({ collection: 'battles', data, depth: 0, overrideAccess: true })
}

/** The readings of battles past their keeping, let go; what was made of them stays. For a run with the database awake. */
export async function pruneTracks(payload: Payload, now = Date.now()): Promise<number> {
  const { docs } = await payload.find({
    collection: 'battles',
    where: { and: [{ trackKeptUntil: { less_than: new Date(now).toISOString() } }, { track: { exists: true } }] },
    limit: 50,
    depth: 0,
    select: { key: true },
  })
  for (const doc of docs) await payload.update({ collection: 'battles', id: doc.id, data: { track: null }, depth: 0, overrideAccess: true })
  return docs.length
}
