import type { Point } from './geo'
import { readPlayers, type LivePlayers, type LiveSiege } from './players'
import type { Siege } from './world'

/**
 * The Rulercraft map's live feed (Dynmap's `up/world/<world>/<since>`),
 * read the same way by the server (the battle tracker, src/lib/livePlayers.ts)
 * and by the browser (the players layer, src/components/maps/live.ts, through
 * the site's /maps/feed rewrite: the map sends no CORS header, so a page
 * can't read it from another site, but a rewrite is the same site to the
 * browser and runs no function of ours). Pure.
 *
 * The feed carries who is online and where, and every change to the map's
 * markers since the time it's asked from; SiegeWar rewrites each siege's
 * marker every fifteen seconds with the whole of it (the score, the banner,
 * the time left). So a reader asks from where the last reading left off,
 * keeps the latest of every siege it has seen, and passes them all on with
 * the players.
 */

/** How far back a reader's first reading asks: past one rewrite of every siege's marker. */
export const FIRST_LOOK_BACK_MS = 20_000
/** A siege not rewritten for this long has ended, or the reader lost track: it's left out until it's seen again. */
export const SIEGE_FORGOTTEN_MS = 60_000

const SIEGE_SET = 'siegewar.markerset'

/** Plain text out of a marker's HTML. */
export const plain = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * A siege out of SiegeWar's map marker (its Dynmap integration): keyed by
 * the besieged town's Towny id, labelled "Siege: <attacker> vs <defender>",
 * a crossed-swords icon while a battle is on and a fire while it's quiet,
 * standing at the siege banner, its description lines of "Label: value"
 * ("Town: …", "Siege Progress: 2/7", "Siege Balance: -40", …). Null for a
 * marker that isn't one.
 */
export function siegeOf(
  townId: string,
  marker: { label?: string; desc?: string; icon?: string; x?: number; z?: number },
  towns: Map<string, { name: string; nation: string | null }>,
): Siege | null {
  const title = /^Siege:\s*(.+?)\s+vs\.?\s+(.+)$/i.exec(plain(marker.label ?? ''))
  if (!title || typeof marker.x !== 'number' || typeof marker.z !== 'number') return null
  const lines = (marker.desc ?? '')
    .split(/<br\s*\/?>|<hr\s*\/?>/i)
    .map(plain)
    .map((line) => /^([^:]{1,40}):\s*(.*)$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null && match[1].trim().toLowerCase() !== 'siege')
    .map((match) => ({ label: match[1].trim(), value: match[2].trim() }))
  const value = (label: string) =>
    lines.find((line) => line.label.toLowerCase() === label)?.value || null
  const progress = /(\d+)\s*\/\s*(\d+)/.exec(value('siege progress') ?? '')
  const balance = Number.parseInt(value('siege balance') ?? '', 10)
  const points = /^(.+?)\s*\/\s*(.+)$/.exec(value('battle points') ?? '')
  const known = towns.get(townId)
  return {
    townId,
    town: value('town') ?? known?.name ?? null,
    townNation: known?.nation ?? null,
    attacker: title[1].trim(),
    defender: title[2].trim(),
    at: [Math.round(marker.x), Math.round(marker.z)] as Point,
    battle: marker.icon === 'siegewar.battle',
    type: value('type'),
    status: value('siege status'),
    progress: progress ? { done: Number(progress[1]), of: Number(progress[2]) } : null,
    balance: Number.isFinite(balance) ? balance : null,
    bannerControl: value('banner control'),
    battlePoints: points ? { attacker: points[1].trim(), defender: points[2].trim() } : null,
    battleTimeLeft: value('battle time left'),
    warChest: value('war chest'),
    lines,
  }
}


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

/**
 * One reader of the feed: `since(now)` is the time to ask it from (where the
 * last reading left off, by the map's own clock, never more than a little
 * past one rewrite of the markers, since the feed keeps no long backlog), and
 * `take(body, now)` makes a reading of its answer, the sieges it has carried
 * so far with it.
 */
export function feedReader(world: string) {
  let since: number | null = null
  const sieges = new Map<string, LiveSiege>()
  return {
    since: (now: number): number => Math.max(since ?? 0, now - FIRST_LOOK_BACK_MS),
    take(body: unknown, now: number): LivePlayers {
      const answer = (body ?? {}) as { timestamp?: unknown; updates?: unknown }
      const reading = readPlayers(answer, world)
      if (typeof answer.timestamp === 'number' && Number.isFinite(answer.timestamp)) since = answer.timestamp
      const { rewritten, ended } = siegeUpdatesOf(answer.updates)
      for (const siege of rewritten) {
        const kept = sieges.get(siege.townId)
        if (!kept || kept.markedAt <= siege.markedAt) sieges.set(siege.townId, siege)
      }
      for (const id of ended) sieges.delete(id)
      for (const [id, siege] of sieges) if (now - siege.markedAt > SIEGE_FORGOTTEN_MS) sieges.delete(id)
      return sieges.size ? { ...reading, sieges: [...sieges.values()] } : reading
    },
  }
}
