import { sameNation } from './abroad'
import { spoken, type MapTown } from './data'
import type { Siege } from './world'

/**
 * Sieges as Azania Maps says them (src/maps/world.ts → Siege, from
 * SiegeWar's marker): who Azania is in one, and its figures in plain
 * words — sessions fought, who's ahead, who holds the banner, the battle's
 * points and time — for the card on the map, the panels and the front.
 * Pure functions, so every place says a siege the same way.
 */

/** Azania's side in a siege: its town besieged or itself the defender, itself the attacker, or neither. */
export type SiegeSide = 'defending' | 'attacking' | null

/** What a siege is measured against: Azania's Towny nation and its towns. */
export type HomeSide = { nation: string | null; towns: Pick<MapTown, 'name' | 'townyId'>[] }

/** A side's name as SiegeWar gives it (a nation, or a town of none) is Azania's. */
const isOurs = (name: string | null, home: HomeSide): boolean =>
  Boolean(name) &&
  (sameNation(name, home.nation) || home.towns.some((town) => town.name.toLowerCase() === name!.toLowerCase()))

export function azaniaSide(siege: Siege, home: HomeSide): SiegeSide {
  const ourTown = home.towns.some((town) => town.townyId && town.townyId === siege.townId)
  if (ourTown || isOurs(siege.defender, home) || sameNation(siege.townNation, home.nation)) return 'defending'
  if (isOurs(siege.attacker, home)) return 'attacking'
  return null
}

/** "Cape Agulhas", or "a town" when SiegeWar didn't say. */
const townWords = (siege: Siege) => (siege.town ? spoken(siege.town) : 'a town')

/** The siege in a line, as the front and the alert say it. */
export function siegeHeadline(siege: Siege, side: SiegeSide): string {
  if (side === 'defending') return `${townWords(siege)} is under siege`
  if (side === 'attacking') return `Azania is besieging ${townWords(siege)}`
  return `${spoken(siege.attacker)} is besieging ${townWords(siege)}`
}

/** "Siege: The Balkan Kingdom vs Azania", as SiegeWar titles it, spoken. */
export const siegeTitle = (siege: Siege): string => `Siege: ${spoken(siege.attacker)} vs ${spoken(siege.defender)}`

/** What kind of siege it is, in a sentence; null for one SiegeWar didn't type. */
export function siegeKind(siege: Siege): string | null {
  const attacker = spoken(siege.attacker)
  const defender = spoken(siege.defender)
  switch (siege.type?.trim().toLowerCase()) {
    case 'conquest':
      return `A conquest: ${attacker} means to take ${townWords(siege)}.`
    case 'revolt':
      return `A revolt: ${townWords(siege)} is rising against ${defender}.`
    case 'suppression':
      return `A suppression: ${attacker} is putting down ${townWords(siege)}’s revolt.`
    case 'liberation':
      return `A liberation: ${attacker} means to free ${townWords(siege)} from its occupier.`
    default:
      return siege.type ? `${siege.type}.` : null
  }
}

/** Who holds the banner, and how many of them stand at it: "Attackers (3)" from SiegeWar. */
export function bannerWords(siege: Siege): string | null {
  const raw = siege.bannerControl?.trim()
  if (!raw) return null
  const match = /^(attackers|defenders|nobody)\b(?:\s*\((\d+)\))?/i.exec(raw)
  if (!match) return raw
  const side = match[1].toLowerCase()
  if (side === 'nobody') return 'Nobody holds the banner'
  const who = side === 'attackers' ? spoken(siege.attacker) : spoken(siege.defender)
  const count = match[2] ? Number(match[2]) : null
  return `${who} holds the banner${count ? `, ${count} at it` : ''}`
}

/** Who's ahead by the siege balance (positive favours the attacker), and by how much. */
export function balanceWords(siege: Siege): string | null {
  if (siege.balance == null) return null
  if (siege.balance === 0) return 'Even'
  const ahead = siege.balance > 0 ? siege.attacker : siege.defender
  return `${spoken(ahead)} ahead by ${Math.abs(siege.balance).toLocaleString('en-GB')}`
}

/** "2 of 7 battle sessions fought". */
export const progressWords = (siege: Siege): string | null =>
  siege.progress
    ? `${siege.progress.done} of ${siege.progress.of} battle session${siege.progress.of === 1 ? '' : 's'} fought`
    : null

/** A battle's points, a side each, as numbers ("+260" is 260). */
export function pointsOf(siege: Siege): { attacker: number; defender: number } | null {
  if (!siege.battlePoints) return null
  const read = (value: string) => Number.parseInt(value.replace(/[^\d-]/g, ''), 10)
  const attacker = read(siege.battlePoints.attacker)
  const defender = read(siege.battlePoints.defender)
  return Number.isFinite(attacker) && Number.isFinite(defender) ? { attacker, defender } : null
}

/** How long this battle has left, or that none is on: a quiet siege burns, a battle has its clock. */
export function timeWords(siege: Siege): string {
  if (!siege.battle) return 'Quiet: no battle on just now'
  const left = siege.battleTimeLeft?.trim()
  return left ? `${left} left in this battle` : 'A battle is on'
}

/** "$2,500 in the war chest", as SiegeWar formats the sum. */
export const chestWords = (siege: Siege): string | null =>
  siege.warChest ? `${siege.warChest.replace(/\.00$/, '')} in the war chest` : null

/** Sieges in the order they matter here: Azania's own first (defending, then attacking), battles before quiet ones. */
export function bySiegeWeight<T extends { siege: Siege; side: SiegeSide }>(entries: T[]): T[] {
  const rank = (side: SiegeSide) => (side === 'defending' ? 0 : side === 'attacking' ? 1 : 2)
  return [...entries].sort(
    (a, b) => rank(a.side) - rank(b.side) || Number(b.siege.battle) - Number(a.siege.battle),
  )
}
