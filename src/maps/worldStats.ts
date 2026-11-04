import { nationKey, sameNation, worldSlug } from './abroad'
import { beliefsOf, type Beliefs, type Share } from './beliefs'
import { continentAt, CONTINENTS, LAND_CHUNKS, type ContinentId } from './continents'
import type { Point } from './geo'
import type { World, WorldKind, WorldTown } from './world'

/**
 * The Rulercraft world in numbers, for Azania Maps' world view
 * (/maps/world): how many towns, people and chunks each continent holds,
 * the nations ranked, the towns that stand out, where Azania stands, what
 * the world believes, and when the towns standing today were founded.
 *
 * Worked out in the browser from the world the map has already fetched
 * (/maps/world.json, shared by the CDN), so it costs the server nothing.
 * Pure: give it the world, Azania's nation and the time.
 *
 * People are the residents of players' towns. The server's own sites
 * (quarries, wastelands, treasure ships, the odd other one) each have one
 * resident, a bot, and are counted apart, as are the trading outposts and
 * the landmarks, which nobody holds.
 */

/** The server's resource sites, which pay the nation holding them. */
const RESOURCE_KINDS: ReadonlySet<WorldKind> = new Set(['quarry', 'wasteland', 'ship'])

export type Tally = { towns: number; residents: number; chunks: number }

/** A town as the world view names it. */
export type TownRow = {
  /** Its Towny id: how the map's own indexes find it (a town of Azania's has a page of its own, /maps/town/<slug>). */
  id: string | null
  name: string
  /** Its slug abroad (/maps/abroad/<slug>), as abroadOf gives it unless another town shares its name. */
  slug: string
  nation: string | null
  continent: ContinentId
  residents: number
  chunks: number
  /** The day Towny says it was founded, YYYY-MM-DD; null when it doesn't say. */
  founded: string | null
  bank: number | null
  home: Point | null
}

export type NationRow = Tally & {
  name: string
  slug: string
  colour: string | null
  /** Its capital and the continent it's on; null for a nation without one. */
  capital: { town: string; continent: ContinentId } | null
  /** Where its towns are, the most residents first. */
  continents: (Tally & { id: ContinentId })[]
  /** Its place among the nations, 1 the first, by each measure (ties share a place). */
  rank: { residents: number; towns: number; chunks: number }
  /** The server's resource sites it holds. */
  sites: number
  home: boolean
}

export type ContinentStats = Tally & {
  id: ContinentId
  name: string
  short: string
  /** Its part of the world's towns, residents and chunks, 0 to 1. */
  share: { towns: number; residents: number; chunks: number }
  /** The nations with a town here, the most residents here first. */
  nations: (Tally & { name: string; slug: string; colour: string | null; capital: boolean })[]
  /** How many nations have their capital here. */
  capitals: number
  /** Towns of no nation, and their residents. */
  nationless: { towns: number; residents: number }
  /** Its land in chunks as the map measures it, and how much of it the towns claim (0 to 1). */
  land: { chunks: number; claimed: number }
  /** The town with the most residents (the most chunks, between equals). */
  largest: TownRow | null
  /** The town founded last, and the oldest standing. */
  newest: TownRow | null
  oldest: TownRow | null
  /** Towns founded in the last 30 days. */
  recent: number
  /** The server's places here: trading outposts, resource sites (and who holds them), landmarks. */
  server: { trading: number; resources: { name: string; slug: string; kind: WorldKind; holder: string | null; resource: string | null }[]; landmarks: number }
  /** The culture and religion most of its people's towns chose (those with none left out); null when none chose. */
  culture: Share | null
  religion: Share | null
}

export type WorldStats = {
  /** When the map wrote the world these come from. */
  at: number
  offline: boolean
  totals: Tally & {
    nations: number
    nationless: { towns: number; residents: number }
    /** Residents per town: the mean and the median. */
    perTown: { mean: number; median: number }
    /** Towns with nobody left in them. */
    empty: number
    /** Towns founded in the last 30 days. */
    recent: number
    trading: number
    resources: number
    landmarks: number
  }
  /** Every continent, the most residents first (then the most towns). */
  continents: ContinentStats[]
  /** Every nation, the most residents first. */
  nations: NationRow[]
  /** The towns that stand out, ten of each at most. */
  towns: { largest: TownRow[]; widest: TownRow[]; newest: TownRow[]; oldest: TownRow[]; richest: TownRow[] }
  /** Azania's standing among the nations, and its part of the world; null when the map has no Azania. */
  home: { nation: NationRow; of: number; share: { towns: number; residents: number; chunks: number } } | null
  /** What the world's towns believe (src/maps/beliefs.ts). */
  beliefs: Beliefs
  /** The towns standing today by the month they were founded (YYYY-MM), oldest first, each month in between included. */
  founded: { month: string; towns: number; residents: number }[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 10 2026", as Towny writes it, as 2026-10-10; null if it isn't that. */
export function foundedDay(raw: string | null | undefined): string | null {
  const match = /^([A-Z][a-z]{2})\s+(\d{1,2}),?\s+(\d{4})$/.exec(raw?.trim() ?? '')
  const month = match ? MONTHS.indexOf(match[1]) : -1
  if (!match || month < 0) return null
  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[2].padStart(2, '0')}`
}

/** Where a town is: its home block, else the first corner of its claims. */
const spotOf = (town: WorldTown): Point | null =>
  town.home ?? (town.claims[0]?.x.length ? [town.claims[0].x[0], town.claims[0].z[0]] : null)

const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0)
const tally = (): Tally => ({ towns: 0, residents: 0, chunks: 0 })
const add = (into: Tally, town: Pick<WorldTown, 'residents' | 'chunks'>) => {
  into.towns += 1
  into.residents += town.residents
  into.chunks += town.chunks
}
const byResidents = (a: Tally, b: Tally) => b.residents - a.residents || b.towns - a.towns || b.chunks - a.chunks
const byTownSize = (a: TownRow, b: TownRow) => b.residents - a.residents || b.chunks - a.chunks || a.name.localeCompare(b.name)
/** Places, 1 the first, ties sharing one. */
function places<T>(rows: T[], value: (row: T) => number): Map<T, number> {
  const sorted = [...rows].sort((a, b) => value(b) - value(a))
  const place = new Map<T, number>()
  sorted.forEach((row, index) => place.set(row, index > 0 && value(sorted[index - 1]) === value(row) ? place.get(sorted[index - 1])! : index + 1))
  return place
}
/** The culture or religion most chose, of those that chose one. */
const leading = (shares: Share[]): Share | null => shares.find((one) => one.name !== null) ?? null
const monthsBetween = (from: string, to: string): string[] => {
  const months: string[] = []
  let [year, month] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  while (year < toYear || (year === toYear && month <= toMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return months
}

export function worldStats(world: World, { home = null, now = Date.now() }: { home?: string | null; now?: number } = {}): WorldStats {
  const recentFrom = new Date(now - 30 * 86_400_000).toISOString().slice(0, 10)
  const all = world.towns.map((town) => {
    const spot = spotOf(town)
    return { town, continent: spot ? continentAt(spot) : null }
  })
  const rowOf = (town: WorldTown, continent: ContinentId): TownRow => ({
    id: town.id,
    name: town.name,
    slug: worldSlug(town.name),
    nation: town.nation,
    continent,
    residents: town.residents,
    chunks: town.chunks,
    founded: foundedDay(town.founded),
    bank: town.bank,
    home: town.home,
  })
  const towns = all.flatMap(({ town, continent }) => (town.kind === 'town' && continent ? [{ town, row: rowOf(town, continent) }] : []))
  const rows = towns.map(({ row }) => row)

  // The world.
  const totals = tally()
  for (const { town } of towns) add(totals, town)
  const sizes = towns.map(({ town }) => town.residents).sort((a, b) => a - b)
  const median = sizes.length ? (sizes.length % 2 ? sizes[(sizes.length - 1) / 2] : (sizes[sizes.length / 2 - 1] + sizes[sizes.length / 2]) / 2) : 0
  const nationlessTowns = towns.filter(({ town }) => !town.nation?.trim())

  // The nations, from their players' towns (the map's own counts take in the bots of the sites they hold).
  const nationInfo = new Map(world.nations.map((nation) => [nationKey(nation.name), nation]))
  const nationTowns = new Map<string, { name: string; towns: { town: WorldTown; continent: ContinentId }[]; sites: number }>()
  for (const { town, continent } of all) {
    if (!town.nation?.trim() || !continent) continue
    const key = nationKey(town.nation)
    const entry = nationTowns.get(key) ?? { name: nationInfo.get(key)?.name ?? town.nation, towns: [], sites: 0 }
    if (town.kind === 'town') entry.towns.push({ town, continent })
    else if (RESOURCE_KINDS.has(town.kind)) entry.sites += 1
    nationTowns.set(key, entry)
  }
  const nationRows: NationRow[] = [...nationTowns.values()]
    .filter((entry) => entry.towns.length)
    .map((entry) => {
      const info = nationInfo.get(nationKey(entry.name))
      const sum = tally()
      const where = new Map<ContinentId, Tally>()
      for (const { town, continent } of entry.towns) {
        add(sum, town)
        const here = where.get(continent) ?? tally()
        add(here, town)
        where.set(continent, here)
      }
      const capital = info?.capital ? { town: info.capital.town, continent: continentAt(info.capital.home) } : null
      return {
        ...sum,
        name: entry.name,
        slug: worldSlug(entry.name),
        colour: info?.colour ?? null,
        capital,
        continents: [...where].map(([id, here]) => ({ id, ...here })).sort(byResidents),
        rank: { residents: 0, towns: 0, chunks: 0 },
        sites: entry.sites,
        home: sameNation(entry.name, home),
      }
    })
    .sort((a, b) => byResidents(a, b) || a.name.localeCompare(b.name))
  for (const measure of ['residents', 'towns', 'chunks'] as const) {
    const place = places(nationRows, (row) => row[measure])
    for (const row of nationRows) row.rank[measure] = place.get(row)!
  }

  // The continents.
  const continents: ContinentStats[] = CONTINENTS.map(({ id, name, short }) => {
    const here = towns.filter(({ row }) => row.continent === id)
    const sum = tally()
    for (const { town } of here) add(sum, town)
    const nations = nationRows
      .flatMap((nation) => {
        const there = nation.continents.find((one) => one.id === id)
        return there ? [{ name: nation.name, slug: nation.slug, colour: nation.colour, capital: nation.capital?.continent === id, towns: there.towns, residents: there.residents, chunks: there.chunks }] : []
      })
      .sort((a, b) => byResidents(a, b) || a.name.localeCompare(b.name))
    const dated = here.map(({ row }) => row).filter((row) => row.founded).sort((a, b) => a.founded!.localeCompare(b.founded!) || byTownSize(a, b))
    const nationless = here.filter(({ town }) => !town.nation?.trim())
    const server = all.filter(({ town, continent }) => continent === id && town.kind !== 'town')
    const beliefs = beliefsOf(here.map(({ town }) => town))
    return {
      id,
      name,
      short,
      ...sum,
      share: { towns: share(sum.towns, totals.towns), residents: share(sum.residents, totals.residents), chunks: share(sum.chunks, totals.chunks) },
      nations,
      capitals: nationRows.filter((nation) => nation.capital?.continent === id).length,
      nationless: { towns: nationless.length, residents: nationless.reduce((n, { town }) => n + town.residents, 0) },
      land: { chunks: LAND_CHUNKS[id], claimed: share(sum.chunks, LAND_CHUNKS[id]) },
      largest: here.map(({ row }) => row).sort(byTownSize)[0] ?? null,
      newest: dated.at(-1) ?? null,
      oldest: dated[0] ?? null,
      recent: dated.filter((row) => row.founded! >= recentFrom).length,
      server: {
        trading: server.filter(({ town }) => town.kind === 'trading').length,
        resources: server
          .filter(({ town }) => RESOURCE_KINDS.has(town.kind))
          .map(({ town }) => ({ name: town.name, slug: worldSlug(town.name), kind: town.kind, holder: town.nation?.trim() || null, resource: town.resource }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        landmarks: server.filter(({ town }) => town.kind === 'landmark').length,
      },
      culture: leading(beliefs.cultures),
      religion: leading(beliefs.religions),
    }
  }).sort((a, b) => byResidents(a, b) || a.name.localeCompare(b.name))

  // The towns that stand out.
  const dated = rows.filter((row) => row.founded)
  const top = (sorted: TownRow[]) => sorted.slice(0, 10)
  const standout = {
    largest: top([...rows].sort(byTownSize)),
    widest: top([...rows].sort((a, b) => b.chunks - a.chunks || byTownSize(a, b))),
    newest: top([...dated].sort((a, b) => b.founded!.localeCompare(a.founded!) || byTownSize(a, b))),
    oldest: top([...dated].sort((a, b) => a.founded!.localeCompare(b.founded!) || byTownSize(a, b))),
    richest: top(rows.filter((row) => (row.bank ?? 0) > 0).sort((a, b) => (b.bank ?? 0) - (a.bank ?? 0) || byTownSize(a, b))),
  }

  // When the towns standing today were founded.
  const byMonth = new Map<string, { towns: number; residents: number }>()
  for (const row of dated) {
    const month = row.founded!.slice(0, 7)
    const entry = byMonth.get(month) ?? { towns: 0, residents: 0 }
    entry.towns += 1
    entry.residents += row.residents
    byMonth.set(month, entry)
  }
  const months = [...byMonth.keys()].sort()
  const founded = months.length ? monthsBetween(months[0], months.at(-1)!).map((month) => ({ month, ...(byMonth.get(month) ?? { towns: 0, residents: 0 }) })) : []

  const homeRow = nationRows.find((nation) => nation.home) ?? null
  return {
    at: world.at,
    offline: Boolean(world.offline),
    totals: {
      ...totals,
      nations: nationRows.length,
      nationless: { towns: nationlessTowns.length, residents: nationlessTowns.reduce((n, { town }) => n + town.residents, 0) },
      perTown: { mean: share(totals.residents, totals.towns), median },
      empty: towns.filter(({ town }) => town.residents === 0).length,
      recent: dated.filter((row) => row.founded! >= recentFrom).length,
      trading: all.filter(({ town }) => town.kind === 'trading').length,
      resources: all.filter(({ town }) => RESOURCE_KINDS.has(town.kind)).length,
      landmarks: all.filter(({ town }) => town.kind === 'landmark').length,
    },
    continents,
    nations: nationRows,
    towns: standout,
    home: homeRow
      ? {
          nation: homeRow,
          of: nationRows.length,
          share: { towns: share(homeRow.towns, totals.towns), residents: share(homeRow.residents, totals.residents), chunks: share(homeRow.chunks, totals.chunks) },
        }
      : null,
    beliefs: beliefsOf(towns.map(({ town }) => town)),
    founded,
  }
}

/** How many of a list of spots (players online, sieges) are on each continent: for the live counts beside the world's. */
export function countByContinent(spots: Point[]): Record<ContinentId, number> {
  const counts = Object.fromEntries(CONTINENTS.map(({ id }) => [id, 0])) as Record<ContinentId, number>
  for (const spot of spots) counts[continentAt(spot)] += 1
  return counts
}
