import type { Payload } from 'payload'

import { abroadOf, homeNationOf, type Abroad } from '../maps/abroad'
import { nearestEnd, scheduleOf, SESSION_MS, timeLeftMs } from '../maps/sessions'
import type { HomeSide } from '../maps/sieges'
import { abroadHref, MAPS_PATH, townHref } from '../maps/url'
import { postWebhook, siteUrl } from './discord'
import { FRESH_MS, readMarkerFile } from './dynmap'
import type { SiegeAlertSettings } from './siegeAlerts'
import { alertHeadline, alertMessage, planSieges, untold, watchFrom, type SiegeAlert } from './siegeWatch'
import { saveSnapshot } from './snapshot'
import { syncTowns, type SyncResult } from './towns'
import { getWorld, warOf } from './world'

/**
 * The watch on the Rulercraft map (/maps/watch), run every five minutes by
 * a job at cron-job.org (and, as a fallback, a GitHub schedule,
 * .github/workflows/watch.yml): one reading of the map's marker file, from
 * which Azania's towns are brought up to date when the last reading is ten
 * minutes old (src/lib/towns.ts, which refreshes the pages when anything
 * changed), the sieges are held against the last run's, for the siege
 * alerts in Discord (src/lib/siegeWatch.ts), and the world and the war are
 * saved every quarter of an hour, for when the map is down (src/lib/snapshot.ts).
 *
 * Anyone may ask: it runs at most every few minutes however often it's
 * asked, and each thing is told once. While the map isn't answering, or
 * its file is old, nothing about the sieges changes, so an outage ends no
 * siege.
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
  sieges?: { onMap: number; told: string[]; failed: string[] } | 'unknown'
  /** Whether this run saved the world and the war for an outage. */
  snapshot?: boolean
}

type StoredWatch = { claimedAt?: unknown } & Record<string, unknown>

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function watchMap(payload: Payload, { force = false }: { force?: boolean } = {}): Promise<WatchResult> {
  const now = new Date()
  const settings = await payload.findGlobal({ slug: 'azania-maps', depth: 0 })
  const stored = (settings.siegeWatch ?? null) as StoredWatch | null
  const claimed = typeof stored?.claimedAt === 'string' ? Date.parse(stored.claimedAt) : 0
  if (!force && now.getTime() - claimed < WATCH_EVERY_MS) {
    return { status: 'skipped', note: 'The map was watched a moment ago.' }
  }
  // Claim the run before the slow part, so requests arriving meanwhile skip; what the
  // record holds stays as it was, the first run's having none.
  const save = (value: Record<string, unknown>) =>
    payload.updateGlobal({ slug: 'azania-maps', data: { siegeWatch: { ...value, claimedAt: now.toISOString() } }, depth: 0 })
  await save(stored ?? {})

  const file = await readMarkerFile(FRESH_MS).catch(() => null)
  if (!file) return { status: 'offline', note: 'The Rulercraft map didn’t answer; nothing changed.' }

  // Azania's towns first, so the sieges are judged by the latest reading of them.
  const towns = await syncTowns(payload).catch((error: unknown): SyncResult => {
    payload.logger.error({ err: error, msg: 'Azania Maps: reading the towns failed' })
    return { status: 'offline', note: 'Reading the towns failed.' }
  })

  const fresh = typeof file.timestamp === 'number' && now.getTime() - file.timestamp < STALE_FILE_MS
  if (!file.sets?.['siegewar.markerset'] || !fresh) {
    return { status: 'watched', note: `Towns: ${towns.note} Sieges: can’t be told from this reading.`, towns, sieges: 'unknown' }
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
  const { watch, alerts } = planSieges(watchFrom(stored), sieges, home, alertSettings, now, allies)

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

  const onMap = sieges.length
  const saying = [`${onMap} on the map`, told.length ? `${told.length} told` : null, failed.length ? `${failed.length} to try again` : null]
  return {
    status: 'watched',
    note: `Towns: ${towns.note} Sieges: ${saying.filter(Boolean).join(', ')}.${seen ? ` Battle session: ${seen}` : ''}${snapshot ? ' The world and the war saved for an outage.' : ''}`,
    towns,
    sieges: { onMap, told, failed },
    snapshot,
  }
}
