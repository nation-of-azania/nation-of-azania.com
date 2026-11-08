import { nationKey, sameNation } from './abroad'
import type { BattleSide } from './battle'
import type { Fighter } from './fights'
import type { Siege } from './world'

/**
 * Which nations are allied, as far as Azania Maps can know: the Rulercraft
 * map doesn't say (its town and nation windows name no allies), yet
 * SiegeWar counts a mutual ally's soldiers for either side of a siege
 * (its SiegeSide.getPlayerSiegeSide: the besieged town's guards and its
 * nation's soldiers or their allies' defend, checked first; the attacking
 * nation's soldiers or their allies' attack; a town of no nation has no
 * allies to call on). So an alliance is known three ways:
 *
 * - `diplomacy`: Azania's own allies, as its diplomats set them (Settings →
 *   Azania Maps → Diplomacy, or a nation's panel on the map);
 * - `told`: alliances between other nations the diplomats know of
 *   (Settings → Azania Maps → Alliances);
 * - `seen`: the battle tracker saw it (src/lib/battleTracker.ts): a player
 *   of one nation fought for the other, as their play showed (a stay at the
 *   banner that took it or joined its holders, which SiegeWar wouldn't have
 *   counted otherwise; or deaths only the other side scored, in two battles
 *   or by two players, since one could be chance). Within ALLIANCE_DAYS of
 *   the last time, and not since the two fought each other.
 *
 * Pure, for the server and the map.
 */

/** A seen alliance lasts this long after it was last seen: alliances are locked six days after one is formed or ended (docs/war-rules.md). */
export const ALLIANCE_DAYS = 21

export type AllianceSource = 'diplomacy' | 'told' | 'seen'

export type Alliance = {
  /** The two nations, as the map spells them (or the settings, for one not seen). */
  nations: [string, string]
  /** Every way it's known, the most certain first. */
  sources: AllianceSource[]
  /** For one seen: in how many battles, the last of them, and the players who fought for the other nation. */
  seen?: { battles: number; last: string; players: string[] }
  /** The diplomats' line on it, if they gave one. */
  note?: string | null
}

/** A battle as the tracker saved it, as much as alliances are told from. */
export type AllianceBattle = {
  startedAt: string
  town: string | null
  attacker: string | null
  defender: string | null
  fighters: Pick<Fighter, 'name' | 'side' | 'ally' | 'by' | 'nation'>[] | null
}

/**
 * The nation defending a siege, whose allies may defend it: the besieged
 * town's nation; null for a town of no nation (SiegeWar marks the town
 * itself as the defender then, and no ally may help).
 */
export function defendingNation(siege: Pick<Siege, 'town' | 'townNation' | 'defender'>): string | null {
  if (siege.townNation?.trim()) return siege.townNation
  if (!siege.defender?.trim() || sameNation(siege.defender, siege.town)) return null
  return siege.defender
}

/**
 * The nation a side fights as, whose allies SiegeWar counts for it: the
 * attacker, or the besieged town's nation (defendingNation; null for a
 * town of no nation). What an ally's mark names: "ally of American
 * Syndicate", never the ally's own nation, which out of a siege's context
 * reads as the nation being someone's (Azania's) ally.
 */
export const nationOfSide = (siege: Pick<Siege, 'attacker' | 'town' | 'townNation' | 'defender'>, side: BattleSide): string | null =>
  side === 'attackers' ? siege.attacker || null : defendingNation(siege)

const pairKey = (a: string, b: string): string => [nationKey(a), nationKey(b)].sort().join('|')

type Evidence = { battle: string; at: string; by: 'banner' | 'kill'; player: string; nations: [string, string] }

/** The alliances the battles show, within ALLIANCE_DAYS of `now`. */
export function alliancesSeen(battles: AllianceBattle[], now: number): Alliance[] {
  const since = new Date(now - ALLIANCE_DAYS * 86_400_000).toISOString()
  const evidence = new Map<string, Evidence[]>()
  // When two nations last fought each other: no alliance seen before it counts.
  const foes = new Map<string, string>()
  for (const battle of battles) {
    if (battle.startedAt < since) continue
    const attacker = battle.attacker?.trim() || null
    const defender = defendingNation({ town: battle.town, townNation: null, defender: battle.defender ?? '' })
    if (attacker && defender) {
      const key = pairKey(attacker, defender)
      if ((foes.get(key) ?? '') < battle.startedAt) foes.set(key, battle.startedAt)
    }
    for (const fighter of battle.fighters ?? []) {
      if (!fighter.ally || (fighter.by !== 'banner' && fighter.by !== 'kill') || !fighter.nation?.trim()) continue
      const theirs = fighter.side === 'attackers' ? attacker : fighter.side === 'defenders' ? defender : null
      if (!theirs || sameNation(theirs, fighter.nation)) continue
      const key = pairKey(fighter.nation, theirs)
      const list = evidence.get(key) ?? []
      list.push({ battle: `${battle.startedAt}|${battle.town}`, at: battle.startedAt, by: fighter.by, player: fighter.name, nations: [theirs, fighter.nation] })
      evidence.set(key, list)
    }
  }
  const alliances: Alliance[] = []
  for (const [key, all] of evidence) {
    const foughtAt = foes.get(key) ?? ''
    const list = all.filter((one) => one.at > foughtAt)
    if (!list.length) continue
    const battles = new Set(list.map((one) => one.battle))
    const players = [...new Set(list.map((one) => one.player))]
    const kills = list.filter((one) => one.by === 'kill')
    const sure = list.some((one) => one.by === 'banner') || new Set(kills.map((one) => one.battle)).size >= 2 || new Set(kills.map((one) => one.player.toLowerCase())).size >= 2
    if (!sure) continue
    const last = list.reduce((latest, one) => (one.at > latest ? one.at : latest), '')
    alliances.push({ nations: list[list.length - 1].nations, sources: ['seen'], seen: { battles: battles.size, last, players: players.sort() } })
  }
  return alliances
}

const SOURCE_ORDER: AllianceSource[] = ['told', 'diplomacy', 'seen']

/**
 * Every alliance known, one for each pair of nations: Azania's allies
 * (`azania`, its nations' names, and `relations`, its diplomacy), the
 * diplomats' list of others' (`told`), and those the battles show (`seen`).
 */
export function alliancesOf({
  azania = [],
  relations = [],
  told = [],
  seen = [],
}: {
  azania?: string[]
  relations?: { nation?: string | null; stance?: string | null; note?: string | null }[]
  told?: { a?: string | null; b?: string | null; note?: string | null }[]
  seen?: Alliance[]
}): Alliance[] {
  const byPair = new Map<string, Alliance>()
  const add = (a: string | null | undefined, b: string | null | undefined, source: AllianceSource, extra: Partial<Alliance> = {}) => {
    if (!a?.trim() || !b?.trim() || sameNation(a, b)) return
    const key = pairKey(a, b)
    const known = byPair.get(key)
    if (!known) {
      byPair.set(key, { nations: [a.trim(), b.trim()], sources: [source], ...extra })
      return
    }
    if (!known.sources.includes(source)) known.sources.push(source)
    if (extra.seen) known.seen = extra.seen
    if (extra.note && !known.note) known.note = extra.note
  }
  const home = azania.find((name) => name?.trim())
  if (home) for (const relation of relations) if (relation.stance === 'ally') add(home, relation.nation, 'diplomacy', relation.note ? { note: relation.note } : {})
  for (const row of told) add(row.a, row.b, 'told', row.note ? { note: row.note } : {})
  for (const alliance of seen) add(alliance.nations[0], alliance.nations[1], 'seen', { seen: alliance.seen })
  const alliances = [...byPair.values()]
  for (const alliance of alliances) alliance.sources.sort((a, b) => SOURCE_ORDER.indexOf(a) - SOURCE_ORDER.indexOf(b))
  return alliances.sort((a, b) => a.nations[0].localeCompare(b.nations[0]) || a.nations[1].localeCompare(b.nations[1]))
}

/**
 * Several lists of alliances as one, each pair of nations once: the ways
 * each is known joined (the most certain first), what was seen kept (the
 * latest), the first note kept. For the map, which knows Azania's own
 * diplomacy before /maps/fighters has answered, and joins the two.
 */
export function mergeAlliances(...lists: Alliance[][]): Alliance[] {
  const byPair = new Map<string, Alliance>()
  for (const list of lists)
    for (const alliance of list) {
      const key = pairKey(alliance.nations[0], alliance.nations[1])
      const known = byPair.get(key)
      if (!known) {
        byPair.set(key, { ...alliance, nations: [alliance.nations[0], alliance.nations[1]], sources: [...alliance.sources] })
        continue
      }
      for (const source of alliance.sources) if (!known.sources.includes(source)) known.sources.push(source)
      if (alliance.seen && (!known.seen || alliance.seen.last > known.seen.last)) known.seen = alliance.seen
      if (alliance.note && !known.note) known.note = alliance.note
    }
  const merged = [...byPair.values()]
  for (const alliance of merged) alliance.sources.sort((a, b) => SOURCE_ORDER.indexOf(a) - SOURCE_ORDER.indexOf(b))
  return merged.sort((a, b) => a.nations[0].localeCompare(b.nations[0]) || a.nations[1].localeCompare(b.nations[1]))
}

/** A nation's alliances, each with the ally's name as the list spells it, for saying how each is known. */
export const alliancesWith = (nation: string | null | undefined, alliances: Alliance[]): { ally: string; alliance: Alliance }[] =>
  nation
    ? alliances.flatMap((alliance) =>
        sameNation(alliance.nations[0], nation)
          ? [{ ally: alliance.nations[1], alliance }]
          : sameNation(alliance.nations[1], nation)
            ? [{ ally: alliance.nations[0], alliance }]
            : [],
      )
    : []

/** Whether two nations are allied, by a list of alliances: a lookup made once. */
export type Allied = (a: string | null | undefined, b: string | null | undefined) => boolean

export function alliedBy(alliances: Pick<Alliance, 'nations'>[]): Allied {
  const pairs = new Set(alliances.map((alliance) => pairKey(alliance.nations[0], alliance.nations[1])))
  return (a, b) => Boolean(a?.trim() && b?.trim()) && !sameNation(a, b) && pairs.has(pairKey(a!, b!))
}

/** A nation's allies, by a list of alliances, as the list spells them. */
export const alliesOf = (nation: string | null | undefined, alliances: Pick<Alliance, 'nations'>[]): string[] =>
  nation
    ? alliances.flatMap((alliance) =>
        sameNation(alliance.nations[0], nation) ? [alliance.nations[1]] : sameNation(alliance.nations[1], nation) ? [alliance.nations[0]] : [],
      )
    : []

/**
 * The side a player's nation puts them on in a siege as an ally, SiegeWar's
 * way: allied with the besieged town's nation, they defend (checked first,
 * so one allied with both defends); allied with the attacker, they attack.
 * Null for one allied with neither, or with no nation; for a resident of
 * either side, see sideOf (src/maps/battle.ts).
 */
export function allySide(nation: string | null | undefined, siege: Pick<Siege, 'attacker' | 'defender' | 'town' | 'townNation'>, allied: Allied): BattleSide | null {
  if (!nation?.trim()) return null
  const defending = defendingNation(siege)
  if (defending && allied(nation, defending)) return 'defenders'
  if (allied(nation, siege.attacker)) return 'attackers'
  return null
}

/**
 * The other sieges a side of this one shares its fighters with: those in
 * which the same nation, or one allied with it, fights on either side,
 * when they're fought in the same session (a battle on). For each, which
 * side of it, and whether it's the nation itself or an ally.
 */
export function sharedSieges(
  siege: Siege,
  side: BattleSide,
  sieges: Siege[],
  allied: Allied,
): { siege: Siege; side: BattleSide; as: 'itself' | 'ally' }[] {
  const nation = side === 'attackers' ? siege.attacker : defendingNation(siege)
  if (!nation) return []
  const shared: { siege: Siege; side: BattleSide; as: 'itself' | 'ally' }[] = []
  for (const other of sieges) {
    if (other === siege || (other.townId === siege.townId && sameNation(other.attacker, siege.attacker)) || !other.battle) continue
    const defending = defendingNation(other)
    // SiegeWar's order: the defending side first.
    if (defending && sameNation(defending, nation)) shared.push({ siege: other, side: 'defenders', as: 'itself' })
    else if (sameNation(other.attacker, nation)) shared.push({ siege: other, side: 'attackers', as: 'itself' })
    else if (defending && allied(defending, nation)) shared.push({ siege: other, side: 'defenders', as: 'ally' })
    else if (allied(other.attacker, nation)) shared.push({ siege: other, side: 'attackers', as: 'ally' })
  }
  return shared
}
