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

import { readMarkerFile, townsOf, type MarkerFile, type Town } from './dynmap'

/**
 * The world around Azania and its wars, read from the Rulercraft map's
 * marker file for /maps/world and /maps/war (types in src/maps/world.ts).
 * Nothing here touches the database. Each keeps the last good reading, so
 * a map that stops answering leaves the last known world on the page.
 */

const rounded = (outline: Outline): Outline => ({ x: outline.x.map(Math.round), z: outline.z.map(Math.round) })

/** Whether a point lies inside an outline (even–odd). */
function inside([x, z]: Point, outline: Outline): boolean {
  let within = false
  for (let i = 0, j = outline.x.length - 1; i < outline.x.length; j = i++) {
    const [xi, zi, xj, zj] = [outline.x[i], outline.z[i], outline.x[j], outline.z[j]]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) within = !within
  }
  return within
}

/** The server's own markers (its "Markers" set): its trading posts (icon "trading"), its landmarks, its quarries' signs. */
const serverMarkers = (file: MarkerFile) =>
  Object.entries(file.sets?.markers?.markers ?? {}).flatMap(([id, marker]) =>
    marker.label?.trim() && typeof marker.x === 'number' && typeof marker.z === 'number'
      ? [{ id, label: plain(marker.label), icon: marker.icon ?? '', at: [marker.x, marker.z] as Point }]
      : [],
  )

/**
 * The server's spawn town (RulerSpawn) is no town: Towny's way of holding
 * the server's trading outposts, scattered across the world, with its home
 * block on the one far out in the Pacific. Each of its claims is a place on
 * its own, named by the server's marker standing in it ("Sahara Trading
 * Outpost", "Baltic Sea Trading Ship", "Aztec Temple"), its home where that
 * marker stands. A claim no marker names is a trading outpost all the same.
 * Null for a town that isn't the spawn town: one of the server's (a bot for
 * a ruler) whose claims hold its trading posts.
 */
function spawnPlaces(town: Town, markers: ReturnType<typeof serverMarkers>): WorldTown[] | null {
  if (!town.ruler || !/^Ruler\d+$/.test(town.ruler)) return null
  const claims = town.outlines.map(rounded)
  const named = claims.map((claim) => markers.find((marker) => inside(marker.at, claim)) ?? null)
  if (!named.some((marker) => marker?.icon === 'trading')) return null
  return claims.map((claim, i) => {
    const marker = named[i]
    const xs = claim.x
    const zs = claim.z
    const middle: Point = [
      Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
      Math.round((Math.min(...zs) + Math.max(...zs)) / 2),
    ]
    return {
      id: `${town.id ?? town.name}/${marker?.id ?? middle.join(',')}`,
      name: marker?.label ?? 'Trading outpost',
      nation: null,
      kind: !marker || marker.icon === 'trading' ? 'trading' : 'landmark',
      capital: false,
      ruler: null,
      residents: 0,
      chunks: outlinesChunks([claim]),
      founded: null,
      publicSpawn: null,
      income: null,
      resource: null,
      home: marker ? [Math.round(marker.at[0]), Math.round(marker.at[1])] : middle,
      claims: [claim],
      colour: town.colour ?? null,
    }
  })
}

/** Every town and nation on the map, the spawn town's places each on its own. */
export function worldOf(file: MarkerFile): World {
  const markers = serverMarkers(file)
  const towns: WorldTown[] = [...townsOf(file).values()].flatMap((town): WorldTown[] => {
    const places = spawnPlaces(town, markers)
    if (places) return places
    const claims = town.outlines.map(rounded)
    return [{
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
    }]
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
