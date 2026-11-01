import type { Payload } from 'payload'

import { abroadOf, homeNationOf, type Abroad } from '../maps/abroad'
import { nearestEnd, scheduleOf, SESSION_MS, timeLeftMs } from '../maps/sessions'
import type { HomeSide } from '../maps/sieges'
import { abroadHref, MAPS_PATH, townHref } from '../maps/url'
import { postWebhook, siteUrl } from './discord'
import { FRESH_MS, readMarkerFile, townsOf, type MarkerFile } from './dynmap'
import { syncLists } from './lists'
import type { SiegeAlertSettings } from './siegeAlerts'
import { alertHeadline, alertMessage, planSieges, untold, watchFrom, type SiegeAlert } from './siegeWatch'
import { pruneTracks, reworkBattles } from './battleTracker'
import { flushPresence, notePresence } from './presence'
import { dayOf, interestOf, marksOf, quietDecision, readNote, writeNote, type Marks, type QuietNote } from './quietWatch'
import { saveSnapshot } from './snapshot'
import { syncTowns, type SyncResult } from './towns'
import { getWorld, warOf } from './world'

/**
 * The watch on the Rulercraft map (/maps/watch), run every five minutes by
 * a job at cron-job.org (and, as a fallback, a GitHub schedule,
 * .github/workflows/watch.yml): one reading of the map's marker file, from
 * which Azania's towns are brought up to date when the last reading is ten
 * minutes old (src/lib/towns.ts, which refreshes the pages when anything
 * changed), the lists with a town or a nation on them are held against who
 * lives where now, for their changelogs (src/lib/lists.ts), the sieges are
 * held against the last run's, for the siege alerts in Discord
 * (src/lib/siegeWatch.ts), and the world and the war are saved every
 * quarter of an hour, for when the map is down (src/lib/snapshot.ts).
 *
 * Anyone may ask: it runs at most every few minutes however often it's
 * asked, and each thing is told once. While the map isn't answering, or
 * its file is old, nothing about the sieges changes, so an outage ends no
 * siege.
 *
 * Most runs find nothing changed, and those leave the database asleep: a
 * note in Vercel's runtime cache from the last full run says, from the map
 * alone, whether there's anything to do (src/lib/quietWatch.ts).
 */

/** However often it's asked, the watch runs at most this often. */
const WATCH_EVERY_MS = 4 * 60 * 1000
/** A marker file older than this says nothing of the sieges now: the map's server isn't writing it. */
const STALE_FILE_MS = 15 * 60 * 1000
/** Told in one run at most; the rest wait for the next, so a war breaking out doesn't trip Discord's limits. */
const MOST_PER_RUN = 8
/** A session seen ending this near a set time agrees with it. */
const SESSION_SLACK_MS = 5 * 60 * 1000

const utc = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })
const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })

/**
 * A battle session running on the map, held against the times set: any
 * siege's mark says how long the session has left. Null between sessions,
 * or with no siege to say.
 */
function sessionSeen(sieges: { battleTimeLeft: string | null }[], settings: SiegeAlertSettings, now: Date): string | null {
  const left = sieges.map((siege) => timeLeftMs(siege.battleTimeLeft)).find((ms) => ms !== null)
  if (left == null) return null
  const end = Math.round((now.getTime() + left) / 60_000) * 60_000
  const seen = `On ${day(end)} a session ran ${utc(end - SESSION_MS)}–${utc(end)} UTC`
  const schedule = scheduleOf(settings.sessionTimes, settings.sessionZone)
  if (!schedule) return `${seen}. No times are set to check it against.`
  const { start, off } = nearestEnd(end, schedule)
  return Math.abs(off) <= SESSION_SLACK_MS
    ? `${seen}, as the times set say.`
    : `${seen}, which the times set don’t have (by them, ${utc(start)}–${utc(start + SESSION_MS)} UTC). Check the times and the time zone.`
}

export type WatchResult = {
  status: 'watched' | 'skipped' | 'offline'
  note: string
  towns?: SyncResult
  /** The lists whose players changed with this reading, each with what changed. */
  lists?: string[] | 'unknown'
  sieges?: { onMap: number; told: string[]; failed: string[] } | 'unknown'
  /** Whether this run saved the world and the war for an outage. */
  snapshot?: boolean
  /** Why the run went to the database, or why it didn't (src/lib/quietWatch.ts). */
  database?: string
  /** Sieges with a battle on, and sieges at all, by this reading: the route then keeps reading for the battle tracker (src/lib/battleTracker.ts). */
  battles?: number
  siegesOnMap?: number
  /** Players online, noted for their usual hours (src/lib/presence.ts); null when the feed didn't answer. */
  online?: number | null
}

type StoredWatch = { claimedAt?: unknown } & Record<string, unknown>

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The fingerprints of a reading (src/lib/quietWatch.ts), by what the database last said; null when the reading can't say. */
function marksNow(file: MarkerFile, fresh: boolean, interest: QuietNote['interest'], day: string): Marks | null {
  if (!fresh || !file.sets?.['siegewar.markerset']) return null
  // All from the one file this run read, as the towns, the lists (worldOf) and the sieges (warOf) are.
  const towns = townsOf(file)
  const world = [...towns.values()].map((town) => ({
    name: town.name,
    nation: town.nation,
    residents: town.residents.length,
    people: town.kind === 'town' ? town.residents : [],
  }))
  return marksOf({ towns, world, sieges: warOf(file).sieges }, interest, day)
}

/**
 * The watch. `payloadOf` gives Payload when a run needs the database, and
 * only then: Payload's database adapter connects as it starts, and a
 * connection is enough to wake the database, so a quiet run must never
 * start it.
 */
export async function watchMap(payloadOf: () => Promise<Payload>, { force = false }: { force?: boolean } = {}): Promise<WatchResult> {
  const now = new Date()
  const note = await readNote()
  if (!force && note && now.getTime() - note.claimedAt < WATCH_EVERY_MS) {
    return { status: 'skipped', note: 'The map was watched a moment ago.', database: 'not asked' }
  }
  // Claim the run in the note before the slow part, so requests arriving meanwhile skip without waking the database.
  if (note) await writeNote({ ...note, claimedAt: now.getTime() })

  const file = await readMarkerFile(FRESH_MS).catch(() => null)
  if (!file) return { status: 'offline', note: 'The Rulercraft map didn’t answer; nothing changed.', database: 'not asked' }
  const fresh = typeof file.timestamp === 'number' && now.getTime() - file.timestamp < STALE_FILE_MS
  const day = dayOf(now.getTime())
  // Who's online, for their usual hours (kept in the cache, written on a full run), and whether a battle is on.
  const online = await notePresence(now.getTime()).catch(() => null)
  const onMap = fresh ? warOf(file).sieges : []
  const battles = onMap.filter((siege) => siege.battle).length
  const siegesOnMap = onMap.length

  if (!force && note) {
    const decision = quietDecision(note, now.getTime(), marksNow(file, fresh, note.interest, day))
    if (decision.quiet) {
      await writeNote({ ...note, claimedAt: now.getTime(), seenAt: now.getTime() })
      return {
        status: 'watched',
        note: 'Nothing the site keeps or tells has changed on the map.',
        database: `left asleep: ${decision.why}`,
        battles,
        siegesOnMap,
        online,
      }
    }
    return { ...(await fullRun(await payloadOf(), now, file, fresh, day, note, false, `asked: ${decision.why}`)), battles, siegesOnMap, online }
  }
  return { ...(await fullRun(await payloadOf(), now, file, fresh, day, note, force, force ? 'asked: forced' : 'asked: no note from a full run')), battles, siegesOnMap, online }
}

/** What a full run leaves for the note: which fingerprints it brought up to date, and whether it left anything pending. */
type Outcome = { towns: boolean; lists: boolean; sieges: boolean; pending: boolean }

/** A run that goes to the database: the watch as it always was, then the note for the quiet runs after it. */
async function fullRun(
  payload: Payload,
  now: Date,
  file: MarkerFile,
  fresh: boolean,
  day: string,
  note: QuietNote | null,
  force: boolean,
  database: string,
): Promise<WatchResult> {
  const outcome: Outcome = { towns: false, lists: false, sieges: false, pending: false }
  const result = await watchFully(payload, now, file, fresh, note, force, outcome)
  if (result.status !== 'skipped') {
    // The note for the runs after this one, with what the database says now (it's awake for it anyway). A fingerprint
    // this run didn't bring up to date keeps the last one, so the next run comes back to it.
    // From an old file there are no fingerprints to take: the last ones stand, and the quiet runs say nothing
    // can be told until the file is fresh again (src/lib/quietWatch.ts → quietDecision).
    const interest = await interestOf(payload).catch(() => null)
    if (interest) {
      const marks = marksNow(file, fresh, interest, day)
      const kept = note?.marks ?? { towns: '', lists: '', sieges: '' }
      await writeNote({
        claimedAt: now.getTime(),
        fullAt: now.getTime(),
        seenAt: now.getTime(),
        day,
        marks: {
          towns: marks && outcome.towns ? marks.towns : kept.towns,
          lists: marks && outcome.lists ? marks.lists : kept.lists,
          sieges: marks && outcome.sieges ? marks.sieges : kept.sieges,
        },
        interest,
        pending: outcome.pending,
      })
    }
    // With the database awake anyway: who was online, from the cache into the database, battles' readings past their
    // keeping let go, and battles an older analysis worked out worked out again.
    await flushPresence(payload).catch((error: unknown) => payload.logger.error({ err: error, msg: 'Presence: saving failed' }))
    await pruneTracks(payload).catch((error: unknown) => payload.logger.error({ err: error, msg: 'Battle tracker: letting old readings go failed' }))
    // And battles an older analysis worked out, worked out again from their readings (a few a run).
    await reworkBattles(payload)
      .then((count) => count && console.info(`[battles] worked out again by the analysis's latest: ${count}`))
      .catch((error: unknown) => payload.logger.error({ err: error, msg: 'Battle tracker: working battles out again failed' }))
  }
  return { ...result, database }
}

async function watchFully(
  payload: Payload,
  now: Date,
  file: MarkerFile,
  fresh: boolean,
  note: QuietNote | null,
  force: boolean,
  outcome: Outcome,
): Promise<WatchResult> {
  const settings = await payload.findGlobal({ slug: 'azania-maps', depth: 0 })
  const stored = (settings.siegeWatch ?? null) as StoredWatch | null
  const claimed = typeof stored?.claimedAt === 'string' ? Date.parse(stored.claimedAt) : 0
  // Two full runs at once (two callers reading the note before either claimed, or no note): the second skips, as ever.
  if (!force && now.getTime() - claimed < WATCH_EVERY_MS) return { status: 'skipped', note: 'The map was watched a moment ago.' }
  // Claim the run before the slow part, so requests arriving meanwhile skip; what the
  // record holds stays as it was, the first run's having none.
  const save = (value: Record<string, unknown>) =>
    payload.updateGlobal({ slug: 'azania-maps', data: { siegeWatch: { ...value, claimedAt: now.toISOString() } }, depth: 0 })
  await save(stored ?? {})

  // Azania's towns first, so the sieges are judged by the latest reading of them.
  const towns = await syncTowns(payload).catch((error: unknown): SyncResult => {
    payload.logger.error({ err: error, msg: 'Azania Maps: reading the towns failed' })
    return { status: 'offline', note: 'Reading the towns failed.' }
  })
  outcome.towns = towns.status === 'synced'

  // Who lives where, for the lists: only from a fresh reading, so an old file moves nobody on or off a list.
  const listed = fresh ? await getWorld() : null
  const lists = listed && !listed.offline
    ? (await syncLists(payload, listed.towns).catch((error: unknown) => {
        payload.logger.error({ err: error, msg: 'Lists: bringing them up to date failed' })
        return null
      }))?.changed ?? 'unknown'
    : 'unknown'
  outcome.lists = Array.isArray(lists)
  const listNote = Array.isArray(lists) && lists.length ? ` Lists: ${lists.join('; ')}.` : ''

  if (!file.sets?.['siegewar.markerset'] || !fresh) {
    return { status: 'watched', note: `Towns: ${towns.note}${listNote} Sieges: can’t be told from this reading.`, towns, lists, sieges: 'unknown' }
  }

  const { docs: ours } = await payload.find({
    collection: 'towns',
    where: { and: [{ azanian: { equals: true } }, { present: { equals: true } }] },
    pagination: false,
    depth: 0,
    select: { name: true, slug: true, townyId: true, nation: true },
  })
  const home: HomeSide = { nation: homeNationOf(ours.map((town) => ({ nation: town.nation ?? null }))), towns: ours.map((town) => ({ name: town.name, townyId: town.townyId })) }
  const discord = await payload.findGlobal({ slug: 'discord', depth: 0 })
  const alertSettings = (discord.sieges ?? {}) as SiegeAlertSettings
  const war = warOf(file)
  const { sieges } = war
  // Azania's allies, as its diplomacy has them (Settings → Azania Maps, or a nation's panel on the map).
  const allies = (settings.relations ?? []).filter((relation) => relation.stance === 'ally' && relation.nation?.trim()).map((relation) => relation.nation.trim())
  // The quiet runs since the last full one saw every siege still on the map: they were last seen then, not at that run.
  const previous = watchFrom(stored)
  const seenAt = note && note.seenAt > note.fullAt ? new Date(note.seenAt).toISOString() : null
  if (previous && seenAt) {
    previous.sieges = previous.sieges.map((entry) => (entry.missing || entry.lastSeen >= seenAt ? entry : { ...entry, lastSeen: seenAt }))
  }
  const { watch, alerts } = planSieges(previous, sieges, home, alertSettings, now, allies)

  // The world and the war as read now, saved every quarter of an hour for when the map is down (src/lib/snapshot.ts).
  const world = await getWorld()
  const snapshot = world
    ? await saveSnapshot(payload, world, war, now).catch((error: unknown) => {
        payload.logger.error({ err: error, msg: 'Azania Maps: saving the world for an outage failed' })
        return false
      })
    : false

  // The session times, checked whenever the map shows a session running.
  const seen = sessionSeen(sieges, alertSettings, now)
  if (seen && seen !== alertSettings.sessionsSeen) {
    await payload.updateGlobal({ slug: 'discord', data: { sieges: { sessionsSeen: seen } }, depth: 0 })
  }

  // Where an alert leads: the besieged town's page, Azania's or abroad, its siege's card opened.
  let abroad: Abroad | null | undefined
  const hrefFor = async (alert: SiegeAlert): Promise<string> => {
    const id = alert.siege.townId
    const own = ours.find((town) => town.townyId === id)
    let path = own ? townHref(own.slug) : null
    if (!path) {
      if (abroad === undefined) {
        const world = await getWorld()
        abroad = world ? abroadOf(world, ours) : null
      }
      const town = abroad?.towns.find((candidate) => candidate.id === id)
      path = town ? abroadHref(town.slug) : MAPS_PATH
    }
    return `${siteUrl()}${path}${alert.kind === 'ended' ? '' : `?siege=${encodeURIComponent(id)}`}`
  }

  let kept = watch
  const told: string[] = []
  const failed: string[] = []
  const url = alertSettings.webhookUrl?.trim()
  for (const [index, alert] of alerts.entries()) {
    const headline = alertHeadline(alert)
    if (!url || index >= MOST_PER_RUN) {
      kept = untold(kept, alert)
      continue
    }
    if (index) await pause(500)
    const ok = await postWebhook(url, alertMessage(alert, await hrefFor(alert), alertSettings, now))
      .then((response) => {
        if (!response.ok) payload.logger.warn(`[discord] "${headline}" wasn't posted: Discord answered ${response.status}`)
        return response.ok
      })
      .catch((error: unknown) => {
        payload.logger.warn(`[discord] "${headline}" wasn't posted: ${(error as Error).message}`)
        return false
      })
    if (ok) {
      told.push(headline)
      payload.logger.info(`[discord] siege alert: ${headline}`)
    } else {
      failed.push(headline)
      kept = untold(kept, alert)
    }
  }
  await save(kept)
  outcome.sieges = true
  // A siege gone from the map has its end told minutes later; an alert put back is tried again: the next runs must be full.
  outcome.pending = kept.sieges.some((entry) => Boolean(entry.missing)) || alerts.length > told.length

  const onMap = sieges.length
  const saying = [`${onMap} on the map`, told.length ? `${told.length} told` : null, failed.length ? `${failed.length} to try again` : null]
  return {
    status: 'watched',
    note: `Towns: ${towns.note}${listNote} Sieges: ${saying.filter(Boolean).join(', ')}.${seen ? ` Battle session: ${seen}` : ''}${snapshot ? ' The world and the war saved for an outage.' : ''}`,
    towns,
    lists,
    sieges: { onMap, told, failed },
    snapshot,
  }
}
