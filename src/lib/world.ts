import { outlinesChunks, type Outline, type Point } from '@/maps/geo'
import {
  CAPITAL_WAR_RADIUS,
  WAR_EVERY_S,
  WORLD_EVERY_S,
  type Siege,
  type War,
  type World,
  type WorldNation,
  type WorldTown,
} from '@/maps/world'

import { readMarkerFile, townsOf, type MarkerFile } from './dynmap'

/**
 * The world around Azania and its wars, read from the Rulercraft map's
 * marker file for /maps/world and /maps/war (types in src/maps/world.ts).
 * Nothing here touches the database. Each keeps the last good reading, so
 * a map that stops answering leaves the last known world on the page.
 */

const rounded = (outline: Outline): Outline => ({ x: outline.x.map(Math.round), z: outline.z.map(Math.round) })

/** Every town and nation on the map. */
export function worldOf(file: MarkerFile): World {
  const towns: WorldTown[] = [...townsOf(file).values()].map((town) => {
    const claims = town.outlines.map(rounded)
    return {
      id: town.id,
      name: town.name,
      nation: town.nation,
      kind: town.kind,
      capital: Boolean(town.capital),
      ruler: town.ruler,
      residents: town.residents.length,
      chunks: outlinesChunks(claims),
      founded: town.founded,
      publicSpawn: town.publicSpawn,
      income: town.income,
      resource: town.resource,
      home: town.home ? [Math.round(town.home.x), Math.round(town.home.z)] : null,
      claims,
      colour: town.colour ?? null,
    }
  })

  const nations = new Map<string, WorldNation & { colours: Map<string, number> }>()
  for (const town of towns) {
    if (!town.nation) continue
    const nation = nations.get(town.nation) ?? {
      name: town.nation,
      colour: null,
      capital: null,
      towns: 0,
      residents: 0,
      chunks: 0,
      colours: new Map<string, number>(),
    }
    nation.towns++
    nation.residents += town.residents
    nation.chunks += town.chunks
    if (town.capital && town.home) nation.capital = { town: town.name, home: town.home }
    if (town.colour) nation.colours.set(town.colour, (nation.colours.get(town.colour) ?? 0) + 1)
    nations.set(town.nation, nation)
  }
  return {
    at: file.timestamp ?? Date.now(),
    // The colour most of a nation's towns are drawn in is the nation's.
    nations: [...nations.values()]
      .map(({ colours, ...nation }) => ({
        ...nation,
        colour: [...colours].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      }))
      .sort((a, b) => b.residents - a.residents || a.name.localeCompare(b.name)),
    towns,
  }
}

/** Plain text out of a marker's HTML. */
const plain = (html: string): string =>
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

/** The war: sieges in progress and every nation's capital, with the reach of its war. */
export function warOf(file: MarkerFile): War {
  const towns = townsOf(file)
  const byId = new Map([...towns.values()].filter((town) => town.id).map((town) => [town.id!, town]))
  const sieges = Object.entries(file.sets?.['siegewar.markerset']?.markers ?? {})
    .map(([id, marker]) => siegeOf(id, marker, byId))
    .filter((siege): siege is Siege => siege !== null)
  const capitals = [...towns.values()]
    .filter((town) => town.capital && town.nation && town.home)
    .map((town) => ({
      nation: town.nation!,
      town: town.name,
      home: [Math.round(town.home!.x), Math.round(town.home!.z)] as Point,
    }))
    .sort((a, b) => a.nation.localeCompare(b.nation))
  return { at: file.timestamp ?? Date.now(), sieges, capitals, radius: CAPITAL_WAR_RADIUS }
}

/** One reading of each, rebuilt only when the file under it is new. */
function keeper<T>(maxAgeMs: number, build: (file: MarkerFile) => T) {
  let last: { file: MarkerFile; value: T } | null = null
  return async (): Promise<T | null> => {
    try {
      const file = await readMarkerFile(maxAgeMs)
      if (last?.file !== file) last = { file, value: build(file) }
    } catch {
      // The map isn't answering: the last reading stands, if there is one.
    }
    return last?.value ?? null
  }
}

/** The world, read a little more often than the CDN asks, so its copy is never older than it says. */
export const getWorld = keeper((WORLD_EVERY_S - 60) * 1000, worldOf)
export const getWar = keeper((WAR_EVERY_S - 30) * 1000, warOf)
