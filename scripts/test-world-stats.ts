/**
 * The world in numbers (src/maps/worldStats.ts) and the continent under a
 * spot (src/maps/continents.ts), checked without a browser: the continents
 * at their borders (the Bosporus, the Urals, Suez, Panama, New Guinea,
 * French Guiana, the Canaries); a small world's tallies, with the server's
 * sites and their bots kept out of the people; nations ranked, ties
 * sharing a place; Azania's standing; founding months with the gaps
 * filled; Towny's dates read.
 *
 *   pnpm test:world-stats                  the checks
 *   pnpm test:world-stats path/to/world.json  and a summary of a copy of /maps/world.json
 */
import { readFileSync } from 'node:fs'

import { continentAt, CONTINENTS, LAND_CHUNKS, type ContinentId } from '../src/maps/continents'
import type { Point } from '../src/maps/geo'
import { unpackWorld, type PackedWorld, type World, type WorldKind, type WorldTown } from '../src/maps/world'
import { countByContinent, foundedDay, worldStats } from '../src/maps/worldStats'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}

/** Blocks to a degree, either way: the world is 73,728 blocks round. */
const B = 73_728 / 360
const at = (lon: number, lat: number): Point => [lon * B, -lat * B]

// The continents at their borders.
const places: [string, number, number, ContinentId][] = [
  ['Istanbul, west of the Bosporus', 28.97, 41.01, 'europe'],
  ['Üsküdar, east of it', 29.05, 40.99, 'asia'],
  ['Moscow', 37.6, 55.75, 'europe'],
  ['Yekaterinburg, past the Urals', 60.6, 56.8, 'asia'],
  ['Chukotka, past the date line', -175, 66, 'asia'],
  ['Cairo', 31.2, 30.0, 'africa'],
  ['Jerusalem', 35.2, 31.8, 'asia'],
  ['Panama City', -79.5, 8.98, 'north-america'],
  ['Bogotá', -74.1, 4.7, 'south-america'],
  ['French Guiana, France abroad', -53.0, 4.0, 'south-america'],
  ['the Canary Islands, Spain abroad', -15.5, 28.1, 'africa'],
  ['Réunion', 55.5, -21.1, 'africa'],
  ['Martinique', -61.0, 14.6, 'north-america'],
  ['Malta', 14.4, 35.9, 'europe'],
  ['Iceland', -21.9, 64.1, 'europe'],
  ['Greenland', -51.7, 64.2, 'north-america'],
  ['Svalbard', 15.6, 78.2, 'europe'],
  ['Nome, across the Bering Strait from Asia', -165.4, 64.5, 'north-america'],
  ['Indonesian New Guinea', 140.7, -2.5, 'asia'],
  ['Port Moresby', 147.2, -9.4, 'oceania'],
  ['Darwin', 130.8, -12.5, 'oceania'],
  ['the Antarctic Peninsula', -63.2, -64.3, 'antarctica'],
  ['the Falklands', -59, -51.7, 'south-america'],
  ['Mauritius, one of the "seven seas"', 57.5, -20.2, 'africa'],
  ['the Maldives, another', 73.5, 4.2, 'asia'],
  ['Fiji', 178.4, -18.1, 'oceania'],
  ['mid-Atlantic, nearer Africa', -20, 5, 'africa'],
]
for (const [name, lon, lat, want] of places) check(continentAt(at(lon, lat)) === want, `${name}: ${want}`)
check(continentAt([at(2.35, 48.85)[0] + 73_728, at(2.35, 48.85)[1]]) === 'europe', 'a copy of the world to the east: Paris is still Europe')
check(continentAt([0, 99_999]) === 'antarctica' && continentAt([0, -99_999]) === 'europe', 'past the poles: the last row north and south')
check(CONTINENTS.every(({ id }) => LAND_CHUNKS[id] > 100_000), 'every continent has land')

// Towny's dates.
check(foundedDay('Oct 10 2026') === '2026-10-10' && foundedDay('Jan 7 2021') === '2021-01-07', 'Towny dates read as days')
check(foundedDay('Sept 10 2026') === null && foundedDay(null) === null && foundedDay('') === null, 'anything else as none')

// A small world.
let n = 0
function town(name: string, spot: Point, { nation = null, kind = 'town', residents = 1, chunks = 10, founded = 'Jan 1 2026', culture = null, religion = null, bank = null, resource = null }: Partial<Pick<WorldTown, 'nation' | 'kind' | 'residents' | 'chunks' | 'founded' | 'culture' | 'religion' | 'bank' | 'resource'>> & { kind?: WorldKind } = {}): WorldTown {
  n += 1
  return {
    id: `id-${n}`,
    name,
    nation,
    kind,
    capital: false,
    ruler: null,
    residents,
    people: [],
    chunks,
    founded,
    publicSpawn: null,
    bank,
    rulerBalance: null,
    culture,
    religion,
    income: null,
    resource,
    home: spot,
    claims: [],
    outposts: [],
    colour: null,
  }
}
const paris = at(2.35, 48.85)
const berlin = at(13.4, 52.5)
const nairobi = at(36.8, -1.3)
const lagos = at(3.4, 6.5)
const tokyo = at(139.7, 35.7)
const world: World = {
  at: 1_700_000_000_000,
  nations: [
    { name: 'Gallia', colour: '#0000ff', capital: { town: 'Lutetia', home: paris }, towns: 2, residents: 12, chunks: 70 },
    { name: 'Azania', colour: '#00aa00', capital: { town: 'Kilima', home: nairobi }, towns: 2, residents: 9, chunks: 65 },
    { name: 'Nippon', colour: '#ff0000', capital: { town: 'Edo', home: tokyo }, towns: 1, residents: 5, chunks: 30 },
  ],
  towns: [
    town('Lutetia', paris, { nation: 'Gallia', residents: 8, chunks: 50, founded: 'Mar 3 2025', culture: 'Franks', religion: 'Sun' }),
    town('Berolina', berlin, { nation: 'Gallia', residents: 4, chunks: 20, founded: 'May 20 2025', culture: 'Franks' }),
    town('Kilima', nairobi, { nation: 'Azania', residents: 6, chunks: 40, founded: 'Oct 25 2026', bank: 5000 }),
    town('Eko', lagos, { nation: 'Azania', residents: 3, chunks: 25, founded: 'Nov 1 2026' }),
    town('Edo', tokyo, { nation: 'Nippon', residents: 5, chunks: 30, founded: 'Sep 9 2026', bank: 9000 }),
    town('Loner', at(-0.1, 51.5), { residents: 0, chunks: 4, founded: null }),
    town('Africa_Quarry', at(25, -25), { nation: 'Azania', kind: 'quarry', resource: 'Diamond' }),
    town('Trading_Outpost', at(10, 45), { kind: 'trading', residents: 0 }),
    town('Old_Temple', at(30, 30), { kind: 'landmark', residents: 0 }),
  ],
}
const now = Date.UTC(2026, 10, 4)
const stats = worldStats(world, { home: 'Azania', now })

check(stats.totals.towns === 6 && stats.totals.residents === 26 && stats.totals.chunks === 169, 'the totals: players’ towns only, the bot of the quarry left out')
check(stats.totals.nations === 3 && stats.totals.nationless.towns === 1 && stats.totals.nationless.residents === 0, 'three nations; one town of none')
check(stats.totals.trading === 1 && stats.totals.resources === 1 && stats.totals.landmarks === 1, 'the server’s places counted apart')
check(stats.totals.empty === 1, 'one town with nobody in it')
check(stats.totals.perTown.median === 4.5 && Math.abs(stats.totals.perTown.mean - 26 / 6) < 1e-9, 'residents per town: the median and the mean')
check(stats.totals.recent === 2, 'two towns founded in the last 30 days')

const europe = stats.continents.find((c) => c.id === 'europe')!
const africa = stats.continents.find((c) => c.id === 'africa')!
check(stats.continents.length === 7 && stats.continents[0].id === 'europe', 'every continent, Europe first: the most residents')
check(europe.towns === 3 && europe.residents === 12 && europe.nationless.towns === 1, 'Europe: Lutetia, Berolina and the loner')
check(africa.towns === 2 && africa.residents === 9 && africa.capitals === 1, 'Africa: Azania’s two towns and its capital')
check(africa.server.resources.length === 1 && africa.server.resources[0].holder === 'Azania' && africa.server.resources[0].resource === 'Diamond', 'Africa’s quarry, held by Azania')
check(europe.server.trading === 1 && africa.server.landmarks === 1, 'the trading outpost in Europe, the landmark in Africa (Egypt)')
check(europe.largest?.name === 'Lutetia' && europe.oldest?.name === 'Lutetia' && europe.newest?.name === 'Berolina', 'Europe’s largest, oldest and newest towns')
check(europe.culture?.name === 'Franks' && europe.religion?.name === 'Sun', 'Europe’s leading culture and religion, those without one passed over')
check(Math.abs(europe.share.residents - 12 / 26) < 1e-9 && europe.land.chunks === LAND_CHUNKS.europe, 'Europe’s share and land')
check(stats.continents.find((c) => c.id === 'oceania')!.towns === 0 && stats.continents.find((c) => c.id === 'oceania')!.largest === null, 'an empty continent, with nothing to name')

const [first, second, third] = stats.nations
check(first.name === 'Gallia' && second.name === 'Azania' && third.name === 'Nippon', 'the nations, the most residents first')
check(second.residents === 9 && second.sites === 1 && second.capital?.continent === 'africa', 'Azania: its people without the quarry’s bot; one site held; its capital in Africa')
check(first.continents.length === 1 && first.continents[0].id === 'europe', 'Gallia is all in Europe')
check(first.rank.chunks === 1 && second.rank.chunks === 2 && third.rank.chunks === 3, 'ranked by chunks')
const tied = worldStats({ ...world, towns: world.towns.map((t) => (t.name === 'Edo' ? { ...t, residents: 9 } : t)) }, { home: 'Azania', now })
check(tied.nations.filter((row) => row.rank.residents === 2).length === 2, 'two nations of nine residents share second place')

check(stats.home?.nation.name === 'Azania' && stats.home.nation.home && stats.home.of === 3 && stats.home.nation.rank.residents === 2, 'Azania stands second of three')
check(worldStats(world, { now }).home === null, 'no home nation, no standing')

check(stats.towns.largest[0].name === 'Lutetia' && stats.towns.newest[0].name === 'Eko' && stats.towns.oldest[0].name === 'Lutetia', 'the largest, newest and oldest towns')
check(stats.towns.richest.map((row) => row.name).join() === 'Edo,Kilima', 'the richest, the towns without a bank left out')
check(stats.towns.largest.every((row) => row.id?.startsWith('id-')), 'each town carries its Towny id')

const months = stats.founded.map((row) => row.month)
check(months[0] === '2025-03' && months.at(-1) === '2026-11' && months.length === 21, 'founding months from the first to the last, every month between')
check(stats.founded.find((row) => row.month === '2025-04')?.towns === 0 && stats.founded.find((row) => row.month === '2026-10')?.residents === 6, 'an empty month as none; October’s town and its residents')

const live = countByContinent([paris, berlin, tokyo])
check(live.europe === 2 && live.asia === 1 && live.africa === 0, 'spots counted by continent (players online, sieges)')

// A copy of the live world, if given.
const file = process.argv[2]
if (file) {
  const real = unpackWorld(JSON.parse(readFileSync(file, 'utf8')) as PackedWorld)
  const started = performance.now()
  const summary = worldStats(real, { home: 'Azania' })
  console.log(`\n${file}: worked out in ${(performance.now() - started).toFixed(1)} ms`)
  console.log(`  ${summary.totals.towns} towns, ${summary.totals.residents} residents, ${summary.totals.chunks} chunks, ${summary.totals.nations} nations`)
  for (const c of summary.continents)
    console.log(`  ${c.name.padEnd(14)} ${String(c.towns).padStart(4)} towns ${String(c.residents).padStart(4)} residents ${String(c.chunks).padStart(7)} chunks (${(c.land.claimed * 100).toFixed(2)}% of its land)  ${c.nations.length} nations, led by ${c.nations[0]?.name ?? '—'}`)
  if (summary.home) console.log(`  Azania: #${summary.home.nation.rank.residents} of ${summary.home.of} by residents, #${summary.home.nation.rank.towns} by towns, #${summary.home.nation.rank.chunks} by chunks`)
  check(summary.continents.reduce((sum, c) => sum + c.towns, 0) === summary.totals.towns, 'the live world: every town on a continent')
}

if (failed) process.exit(1)
