/**
 * The watch's quiet runs (src/lib/quietWatch.ts): which changes on the map
 * wake the database and which leave it asleep. Each fingerprint must change
 * with everything its part of the watch would write or tell, and with
 * nothing else; the decision must go to the database for anything pending,
 * a new day, six hours, or no note.
 *
 *   pnpm test:quiet-watch
 */
import type { Town } from '../src/lib/dynmap'
import { FULL_EVERY_MS, listsMark, quietDecision, siegesMark, type Interest, type QuietNote } from '../src/lib/quietWatch'
import { townsMark } from '../src/lib/towns'
import type { Siege } from '../src/maps/world'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}

const town = (name: string, nation: string | null, residents: string[], extra: Partial<Town> = {}): Town => ({
  id: `id-${name}`,
  kind: 'town',
  siteNote: null,
  income: null,
  resource: null,
  name,
  home: { x: 100, y: 64, z: 200 },
  outlines: [{ x: [0, 16, 16, 0], z: [0, 0, 16, 16] }],
  ruler: residents[0] ?? null,
  residents,
  nation,
  culture: null,
  religion: null,
  founded: 'Oct 1 2026',
  publicSpawn: true,
  bank: 1000,
  rulerBalance: 50,
  outposts: [],
  ...extra,
})
const mapOf = (towns: Town[]) => new Map(towns.map((one) => [one.name.toLowerCase(), one]))

const interest: Interest = {
  nations: ['Azania'],
  towns: ['Freeport'],
  townyIds: ['id-Oldtown'],
  listTowns: ['bandit hollow'],
  listNations: ['syrian_empire'],
}
const day = '2026-10-31'
const base = [
  town('Cape', 'Azania', ['Ansge_', 'NyxW1nd']),
  town('Freeport', null, ['Solo']),
  town('Oldtown', 'Elsewhere', ['Gone']),
  town('Faraway', 'Elsewhere', ['Stranger']),
  town('Bandit_Hollow', null, ['Robber']),
]
const markOf = (towns: Town[], at = day) => townsMark(mapOf(towns), interest, at)
const before = markOf(base)
const swap = (index: number, change: Partial<Town>) => base.map((one, i) => (i === index ? { ...one, ...change } : one))

// Towns: what the Towns collection and the census hold.
check(markOf(base) === before, 'the same reading, the same fingerprint')
check(markOf([...base].reverse()) === before, 'in any order')
check(markOf(swap(0, { residents: ['Ansge_', 'NyxW1nd', 'Newcomer'] })) !== before, 'a resident joining an Azanian town changes it')
check(markOf(swap(0, { outlines: [{ x: [0, 32, 32, 0], z: [0, 0, 16, 16] }] })) !== before, 'an Azanian town claiming land changes it')
check(markOf(swap(1, { publicSpawn: false })) !== before, 'a town named in the settings changes it')
check(markOf(swap(2, { residents: ['Gone', 'Back'] })) !== before, 'a town the database has a row for changes it, Azanian or not')
check(markOf(base.filter((one) => one.name !== 'Oldtown')) !== before, 'a town with a row gone from the map changes it')
check(markOf(swap(3, { nation: 'Azania' })) !== before, 'a town joining Azania changes it')
check(markOf(swap(0, { nation: 'Elsewhere' })) !== before, 'a town leaving Azania changes it')
check(markOf(swap(0, { name: 'Cape_Town' })) !== before, 'an Azanian town renamed changes it')
check(markOf(swap(3, { residents: ['Stranger', 'Other'] })) === before, 'a town Azania has nothing to do with changes nothing')
check(markOf(swap(0, { bank: 99_999, rulerBalance: 1 })) === before, 'the bank and the mayor’s balance change nothing (the site doesn’t keep them)')
check(markOf(swap(0, { colour: '#ff0000', capital: true })) === before, 'nor the map’s colour, nor capital')
check(markOf(base, '2026-11-01') !== before, 'a new day changes it, for the census')

// Lists: who lives in the towns and nations they name.
const world = (towns: Town[]) => towns.map((one) => ({ name: one.name, nation: one.nation, residents: one.residents.length, people: one.residents }))
const listsBefore = listsMark(world(base), interest)
check(listsMark(world(swap(4, { residents: ['Robber', 'Accomplice'] })), interest) !== listsBefore, 'a resident joining a listed town changes the lists’ fingerprint')
check(listsMark(world(swap(3, { nation: 'Syrian_Empire' })), interest) !== listsBefore, 'a town joining a listed nation changes it')
check(listsMark(world(swap(3, { residents: ['Stranger', 'Other'] })), interest) === listsBefore, 'a town no list names changes nothing')
check(
  listsMark(world(swap(4, { residents: ['Accomplice', 'Robber'] })), interest) === listsMark(world(swap(4, { residents: ['Robber', 'Accomplice'] })), interest),
  'nor a listed town’s residents in another order',
)

// Sieges: what the alerts see.
const siege = (change: Partial<Siege> = {}): Siege =>
  ({
    townId: 'town-1',
    town: 'Cyprus',
    townNation: 'Syrian_Empire',
    attacker: 'The_Balkan_Kingdom',
    defender: 'Syrian_Empire',
    at: [7091, -7305],
    battle: false,
    type: 'Conquest',
    status: 'In Progress',
    progress: { done: 1, of: 3 },
    balance: 3280,
    bannerControl: 'Nobody',
    battlePoints: { attacker: '0', defender: '0' },
    battleTimeLeft: null,
    warChest: '$0',
    lines: [],
    ...change,
  }) as Siege
const siegesBefore = siegesMark([siege()])
check(siegesMark([siege({ battlePoints: { attacker: '+1460', defender: '0' }, bannerControl: 'Attackers (3)', battleTimeLeft: '31.8 minutes' })]) === siegesBefore, 'the score, the banner and the clock change nothing (no alert says them)')
check(siegesMark([siege({ battle: true })]) !== siegesBefore, 'a battle starting changes it')
check(siegesMark([siege({ progress: { done: 2, of: 3 }, balance: 7000 })]) !== siegesBefore, 'a session done changes it')
check(siegesMark([]) !== siegesBefore, 'a siege gone changes it')
check(siegesMark([siege(), siege({ townId: 'town-2' })]) !== siegesBefore, 'a new siege changes it')
check(siegesMark([siege({ attacker: 'Someone_Else' })]) !== siegesBefore, 'the same town besieged by another changes it')

// The decision.
const now = Date.parse('2026-10-31T21:00:00Z')
const marks = { towns: before, lists: listsBefore, sieges: siegesBefore }
const note: QuietNote = { claimedAt: now - 300_000, fullAt: now - 3_600_000, seenAt: now - 300_000, day, marks, interest, pending: false }
const decide = (change: Partial<QuietNote> | null, at = now, seen = marks) => quietDecision(change === null ? null : { ...note, ...change }, at, seen)
check(decide({}).quiet, 'nothing changed: the database is left asleep')
check(!decide(null).quiet, 'no note: full')
check(!decide({ pending: true }).quiet, 'something pending: full')
check(!decide({}, now, { ...marks, sieges: 'other' }).quiet && decide({}, now, { ...marks, sieges: 'other' }).why.includes('sieges'), 'a siege changed: full, and it says which')
check(!decide({}, now, { ...marks, towns: 'other' }).quiet, 'the towns changed: full')
check(!decide({}, now, { ...marks, lists: 'other' }).quiet, 'a list’s towns changed: full')
check(!decide({ fullAt: now - FULL_EVERY_MS }).quiet, 'six hours since the last full run: full')
check(!decide({}, Date.parse('2026-11-01T00:02:00Z')).quiet, 'a new day: full')
check(quietDecision(note, now, null).quiet, 'an old file can’t say anything: quiet')
check(!quietDecision({ ...note, fullAt: now - FULL_EVERY_MS }, now, null).quiet, '…but the six hours still hold')

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
