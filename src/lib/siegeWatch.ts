import { sameNation } from '../maps/abroad'
import { spoken } from '../maps/data'
import { nextSessions, scheduleOf, timeLeftMs, type SessionSchedule } from '../maps/sessions'
import {
  azaniaSide,
  balanceWords,
  bannerWords,
  chestWords,
  pointsOf,
  progressWords,
  siegeKind,
  siegeTitle,
  type HomeSide,
  type SiegeSide,
} from '../maps/sieges'
import type { Siege } from '../maps/world'
import { clip } from './discord'
import { ALLY_COLOUR, alliesWanted, roleId, SIEGE_COLOUR, type SiegeAlertSettings } from './siegeAlerts'

/**
 * What the siege alerts say, and when: each run of the watch (src/lib/watch.ts)
 * holds the sieges on the Rulercraft map against the record of the last
 * (Azania Maps' settings, `siegeWatch`), and tells each thing once.
 *
 *   laid     a siege first seen against one of Azania's towns (its fire,
 *            from the moment the banner is placed, before any fighting), or,
 *            as the admins choose, one Azania lays, and one an ally is in
 *            (a nation Azania's diplomacy calls allied, besieged or
 *            besieging); with when it's fought, as Discord timestamps
 *            (whenLines);
 *   battle   fighting started at its banner (SiegeWar's crossed swords, in
 *            place of the quiet fire), once a battle session;
 *   ended    its mark gone from the map, in two readings minutes apart, so
 *            that the map restarting, which clears SiegeWar's marks for a
 *            moment, ends nothing. SiegeWar marks a siege only while it's in
 *            progress and says nothing of how it ended, so neither does this.
 *
 * A siege is its town and its attacker: SiegeWar marks it by the town, and
 * the same town besieged by another is a new siege, the last one over.
 *
 * Every siege is recorded whether or not anything is posted, so alerts
 * switched on later don't tell old sieges as new, and the first run of all
 * only learns what's there. Pure: the run posts what this plans, and puts
 * back (`untold`) what Discord didn't take, to try again next time, for an
 * hour at most.
 */

/** An ally in a siege Azania isn't in: the allied nation, and its side. */
export type AllySide = { nation: string; side: 'defending' | 'attacking' }

/**
 * Whose siege an alert is about, and on which side: Azania's own (`ally`
 * null), or an ally's, by the nation's name as Azania's diplomacy has it.
 */
export type Party = { side: 'defending' | 'attacking'; ally: string | null }

/** A siege as the watch last saw it. */
export type WatchedSiege = {
  townId: string
  attacker: string
  /** Azania's side in it when last seen. */
  side: SiegeSide
  /** An ally's side in it when last seen, when Azania has none; absent in a record from before allies were told. */
  ally?: AllySide | null
  /** When it was first seen. */
  since: string
  /** Its first alert is done: posted, or not wanted when the siege was first seen. */
  told: boolean
  /** The battle sessions (by sessions fought before them) whose battle here is done. */
  battles: number[]
  /** When its mark was first missing from the map, while it is. */
  missing: string | null
  /** The siege as last seen, and when, for the alert when it ends. */
  last: Siege
  lastSeen: string
}

export type SiegeWatch = { checkedAt: string | null; sieges: WatchedSiege[] }

export type SiegeAlert =
  | { kind: 'laid'; siege: Siege; party: Party }
  | { kind: 'battle'; siege: Siege; party: Party; session: number }
  | { kind: 'ended'; siege: Siege; party: Party; lastSeen: string; entry: WatchedSiege }

/** A siege gone from the map in readings this far apart has ended. */
export const ENDED_AFTER_MS = 4 * 60 * 1000
/** What Discord didn't take is tried again for so long, then let go. */
export const TELL_WITHIN_MS = 60 * 60 * 1000

/** The record as stored, whatever the settings hold; null when there's none yet. */
export function watchFrom(value: unknown): SiegeWatch | null {
  const watch = value as SiegeWatch | null
  if (!watch || typeof watch !== 'object' || !Array.isArray(watch.sieges)) return null
  return {
    checkedAt: typeof watch.checkedAt === 'string' ? watch.checkedAt : null,
    sieges: watch.sieges.filter((entry) => entry && typeof entry.townId === 'string' && entry.last),
  }
}

/** Whether the alerts post at all: switched on, with a webhook. */
export const alertsOn = (settings: SiegeAlertSettings): boolean =>
  settings.enabled !== false && Boolean(settings.webhookUrl?.trim())

/**
 * An ally's side in a siege, from the nations Azania's diplomacy calls
 * allied: its town besieged, or its banner laid; the nation named as the
 * map spells it. Null when no ally is in it.
 */
export function allyIn(siege: Siege, allies: string[]): AllySide | null {
  const ally = (name: string | null) => (name && allies.some((candidate) => sameNation(name, candidate)) ? name : null)
  const defending = ally(siege.townNation) ?? ally(siege.defender)
  if (defending) return { nation: defending, side: 'defending' }
  const attacking = ally(siege.attacker)
  return attacking ? { nation: attacking, side: 'attacking' } : null
}

/** Whose siege it is, Azania's before an ally's; null for one neither is in. */
const partyOf = (side: SiegeSide, ally: AllySide | null | undefined): Party | null =>
  side ? { side, ally: null } : ally ? { side: ally.side, ally: ally.nation } : null

/** Whether a siege is told at all, by whose it is and the settings. */
function wanted(party: Party | null, settings: SiegeAlertSettings): party is Party {
  if (!party) return false
  if (party.ally === null) return party.side === 'defending' || Boolean(settings.laidByAzania)
  const allies = alliesWanted(settings)
  return allies === 'involved' || (allies === 'besieged' && party.side === 'defending')
}

const keyOf = (siege: { townId: string; attacker: string }) => `${siege.townId}|${siege.attacker.toLowerCase()}`

/** The battle session a siege is in: sessions fought before it. */
const sessionOf = (siege: Siege): number => siege.progress?.done ?? -1

/**
 * The next record and what to tell, from the last record (null: the first
 * run of all), the sieges now on the map, and Azania's allies by name.
 */
export function planSieges(
  previous: SiegeWatch | null,
  sieges: Siege[],
  home: HomeSide,
  settings: SiegeAlertSettings,
  now: Date,
  allies: string[] = [],
): { watch: SiegeWatch; alerts: SiegeAlert[] } {
  const at = now.toISOString()
  const first = previous === null
  const on = alertsOn(settings) && !first
  const alerts: SiegeAlert[] = []
  // A siege is its town and its attacker: the same town besieged by another is another siege, the last one ended.
  const before = new Map((previous?.sieges ?? []).map((entry) => [keyOf(entry), entry]))
  const next: WatchedSiege[] = []
  const age = (since: string) => now.getTime() - Date.parse(since)

  for (const siege of sieges) {
    const key = keyOf(siege)
    if (next.some((entry) => keyOf(entry) === key)) continue
    const known = before.get(key)
    before.delete(key)
    const side = azaniaSide(siege, home)
    const ally = side ? null : allyIn(siege, allies)
    const party = partyOf(side, ally)
    const entry: WatchedSiege = known
      ? { ...known, side, ally, missing: null, last: siege, lastSeen: at }
      : { townId: siege.townId, attacker: siege.attacker, side, ally, since: at, told: !on, battles: [], missing: null, last: siege, lastSeen: at }
    let laid = false
    if (!entry.told) {
      entry.told = true
      if (on && wanted(party, settings) && age(entry.since) < TELL_WITHIN_MS) {
        alerts.push({ kind: 'laid', siege, party })
        laid = true
      }
    }
    const session = sessionOf(siege)
    if (siege.battle && !entry.battles.includes(session)) {
      // Kept short: a siege runs a handful of sessions.
      entry.battles = [...entry.battles, session].slice(-12)
      // A siege told just now says its battle in the same breath.
      if (on && !laid && settings.battles && wanted(party, settings)) alerts.push({ kind: 'battle', siege, party, session })
    }
    next.push(entry)
  }

  for (const entry of before.values()) {
    const missing = entry.missing ?? at
    const party = partyOf(entry.side, entry.ally)
    if (age(missing) < ENDED_AFTER_MS) next.push({ ...entry, missing })
    else if (on && settings.ended && wanted(party, settings) && age(missing) < TELL_WITHIN_MS) {
      alerts.push({ kind: 'ended', siege: entry.last, party, lastSeen: entry.lastSeen, entry })
    }
  }

  return { watch: { checkedAt: at, sieges: next }, alerts }
}

/** The record with an alert Discord didn't take put back, to be tried again on the next run. */
export function untold(watch: SiegeWatch, alert: SiegeAlert): SiegeWatch {
  if (alert.kind === 'ended') return { ...watch, sieges: [...watch.sieges, alert.entry] }
  return {
    ...watch,
    sieges: watch.sieges.map((entry) =>
      keyOf(entry) !== keyOf(alert.siege)
        ? entry
        : alert.kind === 'laid'
          ? { ...entry, told: false }
          : { ...entry, battles: entry.battles.filter((session) => session !== alert.session) },
    ),
  }
}

/** "Cape Town", or "a town" when SiegeWar didn't say. */
const townName = (siege: Siege) => (siege.town ? spoken(siege.town) : 'a town')

/** The alert's line, which Discord also shows in its notification. */
export function alertHeadline(alert: SiegeAlert): string {
  const town = townName(alert.siege)
  const { side, ally } = alert.party
  const allied = ally ? `our ally ${spoken(ally)}` : null
  switch (alert.kind) {
    case 'laid':
      if (allied) return side === 'defending' ? `${cap(allied)} is under siege at ${town}` : `${cap(allied)} is besieging ${town}`
      return side === 'defending' ? `${town} is under siege` : `Azania is besieging ${town}`
    case 'battle':
      if (allied) return side === 'defending' ? `Fighting has started at ${town}, held by ${allied}` : `Fighting has started at ${spoken(ally!)}’s siege of ${town}`
      return `Fighting has started at ${side === 'defending' ? town : `Azania’s siege of ${town}`}`
    case 'ended':
      return allied && side === 'defending' ? `The siege of ${town}, held by ${allied}, has ended` : `The siege of ${town} has ended`
  }
}

const cap = (words: string) => words.charAt(0).toUpperCase() + words.slice(1)

/**
 * Only what calls for defenders pings: a siege against Azania, and fighting
 * started at one; and the same for an ally besieged, when the admins choose.
 */
export const pings = (alert: SiegeAlert, settings: SiegeAlertSettings): boolean =>
  alert.party.side === 'defending' && alert.kind !== 'ended' && (alert.party.ally === null || Boolean(settings.pingAllies))

type Field = { name: string; value: string; inline?: boolean }

/** The siege's figures, those SiegeWar gave, as the map's card says them. */
function figures(siege: Siege, kind: SiegeAlert['kind']): Field[] {
  const points = pointsOf(siege)
  const fields: (Field | null)[] = [
    { name: 'Attacker', value: spoken(siege.attacker), inline: true },
    { name: 'Defender', value: spoken(siege.defender), inline: true },
    kind === 'battle' && points
      ? { name: 'Battle points', value: `${spoken(siege.attacker)} ${points.attacker} · ${spoken(siege.defender)} ${points.defender}` }
      : null,
    progressWords(siege) ? { name: 'Progress', value: progressWords(siege)!, inline: true } : null,
    balanceWords(siege) ? { name: 'Siege balance', value: balanceWords(siege)!, inline: true } : null,
    bannerWords(siege) ? { name: 'Banner', value: bannerWords(siege)!, inline: true } : null,
    kind !== 'ended' && chestWords(siege) ? { name: 'War chest', value: chestWords(siege)!, inline: true } : null,
    { name: 'Banner at', value: `X ${siege.at[0]} · Z ${siege.at[1]}`, inline: true },
  ]
  return fields.filter((field): field is Field => field !== null).map((field) => ({ ...field, value: clip(field.value, 1024) }))
}

const stamp = (ms: number, style: 't' | 'f' | 'F' | 'R') => `<t:${Math.round(ms / 1000)}:${style}>`

/** Battle sessions a siege may still have, at most: it's fought over the sessions SiegeWar counts out. */
const MOST_SESSIONS_SAID = 5

/**
 * When to fight, as Discord timestamps, which each reader sees in their own
 * time: the session on now, until when (the map says how long it has
 * left), and the sessions to come that the siege still has, by the times
 * set (src/maps/sessions.ts). Nothing to come when no times are set.
 */
export function whenLines(siege: Siege, schedule: SessionSchedule | null, now: Date): string[] {
  const left = timeLeftMs(siege.battleTimeLeft)
  const lines: string[] = []
  let after = now.getTime()
  let count = siege.progress ? Math.max(0, siege.progress.of - siege.progress.done) : 1
  if (left !== null) {
    const ends = now.getTime() + left
    lines.push(`**Battle session on now**, until ${stamp(ends, 't')} (${stamp(ends, 'R')})`)
    after = ends
    count -= 1
  }
  if (!schedule || count <= 0) return lines
  const coming = nextSessions(after, schedule, Math.min(count, MOST_SESSIONS_SAID))
  if (!coming.length) return lines
  if (left === null) {
    const [next, ...then] = coming
    lines.push(`**Next battle session:** ${stamp(next, 'F')} (${stamp(next, 'R')})`)
    if (then.length) lines.push(`Then ${then.map((start) => stamp(start, 'f')).join(' · ')}`)
  } else {
    lines.push(`Next ${coming.map((start) => stamp(start, 'f')).join(' · ')}`)
  }
  return lines
}

/** What the embed says beneath its title. */
function description(alert: SiegeAlert, href: string, schedule: SessionSchedule | null, now: Date): string {
  const see = `[See it on Azania Maps](${href})`
  const when = whenLines(alert.siege, schedule, now).join('\n')
  switch (alert.kind) {
    case 'laid':
      return [siegeKind(alert.siege), when, see].filter(Boolean).join('\n\n')
    case 'battle': {
      const of = alert.siege.progress ? ` of ${alert.siege.progress.of}` : ''
      return [`Fighting at the banner, in battle session ${alert.session + 1}${of}.`, when, see].filter(Boolean).join('\n\n')
    }
    case 'ended': {
      const seen = Math.round(Date.parse(alert.lastSeen) / 1000)
      return `SiegeWar no longer marks it on the Rulercraft map. As it stood when last seen, <t:${seen}:R>:\n\n${see}`
    }
  }
}

/**
 * The message for an alert: its line (with the role, when it pings) and an
 * embed of the siege, linking to `href` on Azania Maps.
 */
export function alertMessage(alert: SiegeAlert, href: string, settings: SiegeAlertSettings, now: Date) {
  const role = pings(alert, settings) ? roleId(settings.role) : null
  return {
    content: clip(`${role ? `<@&${role}> ` : ''}**${alertHeadline(alert)}**`, 2000),
    allowed_mentions: role ? { parse: [], roles: [role] } : { parse: [] },
    embeds: [
      {
        title: clip(siegeTitle(alert.siege), 256),
        url: href,
        description: clip(description(alert, href, scheduleOf(settings.sessionTimes, settings.sessionZone), now), 4096),
        color: alert.party.ally ? ALLY_COLOUR : SIEGE_COLOUR,
        fields: figures(alert.siege, alert.kind),
        footer: { text: 'Azania Maps · read off the Rulercraft map' },
        timestamp: now.toISOString(),
      },
    ],
  }
}
