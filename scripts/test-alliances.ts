/**
 * Alliances (src/maps/alliances.ts) and what they change: whose side a
 * player is on in a siege (SiegeWar's order: the defenders first, a town of
 * no nation with no allies), alliances told by the battles (a real one:
 * Imperial_Avalonia's players taking South_America_Quarry's banner back for
 * the American Syndicate, 1 November 2026, 00:00 UTC), the sieges a side
 * shares its fighters with, turnout counted by the session, and allies in
 * the forecast.
 *
 *   pnpm test:alliances
 */
import { readFileSync } from 'node:fs'

import { ALLIANCE_DAYS, alliancesOf, alliancesSeen, alliedBy, alliesOf, allySide, defendingNation, sharedSieges, type AllianceBattle } from '../src/maps/alliances'
import { allegianceOf, sideOf } from '../src/maps/battle'
import { allyShare, recordsOf, type SavedBattle } from '../src/maps/fighters'
import { fighterOf, killsBetween, unpackMoments, unpackTimes, type Fighter, type Mark, type Moment } from '../src/maps/fights'
import { forecastSiege } from '../src/maps/outlook'
import type { Siege } from '../src/maps/world'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}

const siege = (over: Partial<Siege> = {}): Siege => ({
  townId: 'quarry',
  town: 'South_America_Quarry',
  townNation: 'American_Syndicate',
  attacker: 'Sul_America',
  defender: 'American_Syndicate',
  at: [0, 0],
  battle: true,
  type: null,
  status: null,
  progress: null,
  balance: null,
  bannerControl: null,
  battlePoints: null,
  battleTimeLeft: null,
  warChest: null,
  lines: [],
  ...over,
})

// Lookups.
const allied = alliedBy([{ nations: ['Imperial_Avalonia', 'American Syndicate'] }])
check(allied('imperial avalonia', 'American_Syndicate') && allied('American_Syndicate', 'Imperial_Avalonia'), 'allied either way round, whatever the case and underscores')
check(!allied('Imperial_Avalonia', 'Imperial_Avalonia') && !allied('Imperial_Avalonia', null), 'no nation is its own ally, and no nation none’s')
check(alliesOf('American_Syndicate', [{ nations: ['Imperial_Avalonia', 'American Syndicate'] }]).join() === 'Imperial_Avalonia', 'a nation’s allies')
check(defendingNation(siege({ townNation: null, defender: 'South_America_Quarry' })) === null, 'a town of no nation: SiegeWar names the town as defender, and it has no allies')
check(defendingNation(siege({ townNation: null })) === 'American_Syndicate', 'the town’s nation not read: the defender named on the marker')

// Sides, SiegeWar's way.
const quarry = siege()
const town = (nation: string | null, name = 'Somewhere') => ({ name, nation })
check(sideOf(town('Sul_America'), quarry) === 'attackers' && sideOf(town('American_Syndicate'), quarry) === 'defenders', 'residents: by where they live, as before')
check(sideOf(town('Imperial_Avalonia'), quarry) === 'other', 'an ally not known: neither side')
const ally = allegianceOf(town('Imperial_Avalonia'), quarry, allied)
check(ally.side === 'defenders' && ally.ally, 'an ally of the besieged town’s nation defends, as an ally')
const both = alliedBy([{ nations: ['Imperial_Avalonia', 'American_Syndicate'] }, { nations: ['Imperial_Avalonia', 'Sul_America'] }])
check(allySide('Imperial_Avalonia', quarry, both) === 'defenders', 'allied with both: SiegeWar looks for defenders first')
check(allySide('Imperial_Avalonia', quarry, alliedBy([{ nations: ['Imperial_Avalonia', 'Sul_America'] }])) === 'attackers', 'allied with the attacker: attacks')
const nationless = siege({ townNation: null, defender: 'South_America_Quarry' })
check(sideOf(town('Imperial_Avalonia'), nationless, allied) === 'other' && sideOf(town(null, 'South_America_Quarry'), nationless) === 'defenders', 'a town of no nation: its residents defend, no ally may')
check(allegianceOf(town('American_Syndicate'), quarry, allied).ally === false, 'a resident is no ally')

// Kills between marks: what a side's points rose by beyond its holders' checks.
const mark = (t: number, banner: Mark['banner'], holders: number, attacker: number, defender: number): Mark => ({ t, banner, holders, attacker, defender })
check(killsBetween(mark(0, 'attackers', 5, 0, 0), mark(3, 'attackers', 5, 50, 0), 'attackers') === 0, 'five holders’ check: 50, no kill')
check(killsBetween(mark(0, 'attackers', 5, 0, 0), mark(25, 'attackers', 5, 100, 0), 'attackers') === 0, 'two checks of five holders: 100, still no kill')
check(killsBetween(mark(0, 'attackers', 5, 0, 0), mark(3, 'attackers', 5, 150, 0), 'attackers') === 1, 'a check and a kill: one kill')
check(killsBetween(mark(0, 'attackers', 2, 0, 0), mark(3, 'attackers', 2, 100, 0), 'attackers') === 1, 'a kill between checks')
check(killsBetween(mark(0, null, 0, 0, 0), mark(3, null, 0, 0, 200), 'defenders') === 2, 'two kills at once')

// Alliances told by the battles: the real one first.
type Fixture = { start: string; readings: string; marks: Mark[]; players: Record<string, { side: 'attackers' | 'defenders' | 'other'; moments: string }> }
const fixture = JSON.parse(readFileSync(new URL('./fixtures/battle-south-america-quarry-2026-11-01-0000.json', import.meta.url), 'utf8')) as Fixture
const readings = unpackTimes(fixture.readings)
const nations: Record<string, string> = { Its_Pandaz: 'Imperial_Avalonia', quadecaelite68: 'Imperial_Avalonia', Averycooper: 'Somewhere_Else', TheRealSaas: 'Somewhere_Else' }
const fighters = Object.entries(fixture.players).map(([name, kept]) =>
  fighterOf(name, { side: kept.side, nation: nations[name] ?? (kept.side === 'attackers' ? 'Sul_America' : null), allied: null }, readings, unpackMoments(kept.moments), fixture.marks),
)
const pandaz = fighters.find((fighter) => fighter.name === 'Its_Pandaz')!
check(pandaz.side === 'defenders' && pandaz.ally === true && pandaz.by === 'banner' && pandaz.nation === 'Imperial_Avalonia', 'Its_Pandaz: a defender by taking the banner, of Imperial_Avalonia')
const night: AllianceBattle = { startedAt: fixture.start, town: 'South_America_Quarry', attacker: 'Sul_America', defender: 'American_Syndicate', fighters }
const now = Date.parse('2026-11-01T12:00:00Z')
const seen = alliancesSeen([night], now)
check(seen.length === 1 && alliedBy(seen)('Imperial_Avalonia', 'American_Syndicate'), 'seen: Imperial_Avalonia and the American Syndicate are allied')
check(seen[0]?.seen?.players.join() === 'Its_Pandaz,quadecaelite68' && seen[0]?.seen?.battles === 1, 'seen in one battle, by the two who took the banner')
check(!alliedBy(seen)('Somewhere_Else', 'American_Syndicate') && !alliedBy(seen)('Somewhere_Else', 'Sul_America'), 'those whose play showed no side tell no alliance')
check(alliancesSeen([night], now + (ALLIANCE_DAYS + 1) * 86_400_000).length === 0, `seen more than ${ALLIANCE_DAYS} days ago: no longer known`)
const war: AllianceBattle = { startedAt: '2026-11-03T18:00:00.000Z', town: 'Avalon', attacker: 'American_Syndicate', defender: 'Imperial_Avalonia', fighters: [] }
check(alliancesSeen([night, war], now + 3 * 86_400_000).length === 0, 'the two at war with each other since: no longer allied')

// Made up: a kill alone, and an alliance taken as given, tell little.
const one = (name: string, by: Fighter['by'], startedAt = '2026-10-31T18:00:00.000Z', town = 'Cyprus'): AllianceBattle => ({
  startedAt,
  town,
  attacker: 'The_Balkan_Kingdom',
  defender: 'Cyprus_Nation',
  fighters: [{ name, side: 'attackers', ally: true, by, nation: 'Greece' }],
})
check(alliancesSeen([one('A', 'kill')], now).length === 0, 'one death only the other side scored: not enough on its own')
check(alliancesSeen([one('A', 'kill'), one('A', 'kill', '2026-11-01T00:00:00.000Z')], now).length === 1, 'deaths scored that way in two battles: allied')
check(alliancesSeen([one('A', 'kill'), one('B', 'kill')], now).length === 1, 'or of two players')
check(alliancesSeen([one('A', 'alliance'), one('B', 'alliance', '2026-11-01T00:00:00.000Z')], now).length === 0, 'sides taken from an alliance tell no alliance: no going round in circles')

// Every source, merged.
const all = alliancesOf({
  azania: ['Azania'],
  relations: [
    { nation: 'Lusitania', stance: 'ally', note: 'Treaty of Oasis' },
    { nation: 'Cyprus_Nation', stance: 'friendly' },
  ],
  told: [{ a: 'Greece', b: 'The Balkan Kingdom' }, { a: 'Imperial_Avalonia', b: 'American_Syndicate', note: 'their Discord' }],
  seen,
})
check(all.length === 3, 'one alliance a pair: Azania’s ally, and two told (one also seen); a friendly nation is no ally')
const both2 = all.find((alliance) => alliedBy([alliance])('Imperial_Avalonia', 'American_Syndicate'))
check(both2?.sources.join() === 'told,seen' && both2?.note === 'their Discord' && Boolean(both2?.seen), 'told and seen: both kept, the diplomats’ first')
check(all.some((alliance) => alliance.sources[0] === 'diplomacy' && alliedBy([alliance])('Azania', 'Lusitania')), 'Azania’s own ally, by its diplomacy')

// Sieges sharing fighters.
const other = siege({ townId: 'avalon', town: 'Avalon', townNation: 'Imperial_Avalonia', attacker: 'Somebody', defender: 'Imperial_Avalonia' })
const own = siege({ townId: 'second', town: 'Second', townNation: 'Somebody', attacker: 'American_Syndicate', defender: 'Somebody' })
const quiet = siege({ townId: 'quiet', town: 'Quiet', townNation: 'Imperial_Avalonia', attacker: 'X', defender: 'Imperial_Avalonia', battle: false })
const shared = sharedSieges(quarry, 'defenders', [quarry, other, own, quiet], allied)
check(shared.length === 2, 'the defenders share fighters with two battles on, not a quiet siege')
check(shared.some((one) => one.siege === other && one.side === 'defenders' && one.as === 'ally'), 'their ally’s town besieged at the same time: defending it too')
check(shared.some((one) => one.siege === own && one.side === 'attackers' && one.as === 'itself'), 'their own nation’s siege elsewhere')
check(sharedSieges(nationless, 'defenders', [nationless, other], allied).length === 0, 'a town of no nation shares no one')

// Turnout by the session.
const moments = (minutes: number): Moment[] => Array.from({ length: minutes * 20 }, (_, i) => ({ t: i * 3, d: 50, h: 20, a: 0 }))
const fought = (name: string, side: Fighter['side'], extra: Partial<Fighter> = {}): Fighter => ({ ...fighterOf(name, side, moments(10).map((m) => m.t), moments(10), []), ...extra })
const session = '2026-11-01T12:00:00.000Z'
const battles: SavedBattle[] = [
  // Azania's two sieges at once: Kofi fights at one.
  { startedAt: session, town: 'One', attacker: 'Azania', defender: 'Foe', coverage: 1, result: null, sides: { attackers: ['Kofi', 'Ama'], defenders: [] }, fighters: [fought('Kofi', 'attackers')] },
  { startedAt: '2026-11-01T12:07:00.000Z', town: 'Two', attacker: 'Azania', defender: 'Foe2', coverage: 1, result: null, sides: { attackers: ['Kofi', 'Ama'], defenders: [] }, fighters: [] },
  // Ama helps an ally instead, in the same session.
  { startedAt: session, town: 'Three', attacker: 'Lusitania', defender: 'Foe3', coverage: 1, result: null, sides: { attackers: ['Rui'], defenders: [] }, fighters: [fought('Ama', 'attackers', { ally: true, by: 'banner' })] },
]
const records = recordsOf(battles)
check(records.get('kofi')?.could === 1 && records.get('kofi')?.fought === 1, 'two sieges of Azania’s at once, fought at one: one session, fought')
check(records.get('ama')?.could === 1 && records.get('ama')?.fought === 1 && records.get('ama')?.allied === 1, 'fought at an ally’s siege while Azania’s were on: not counted absent')
check(records.get('rui')?.could === 1 && records.get('rui')?.fought === 0, 'stayed away from their own: absent')
check(records.get('ama')?.battles === 1 && allyShare(records.get('ama')!) === 1, 'one battle, all of it for an ally')

// The forecast: allies counted by their share.
const hours = Array.from({ length: 168 }, () => 1)
const start = Date.parse('2026-11-02T12:00:00Z')
const resident = { could: 4, fought: 4, hours }
const plain = forecastSiege(0, [start], { attackers: [resident], defenders: [] })
const helped = forecastSiege(0, [start], { attackers: [resident, { ...resident, share: 0.5 }], defenders: [{ ...resident, share: 0 }] })
check(helped.sessions[0].expected.attackers > plain.sessions[0].expected.attackers && helped.sessions[0].expected.attackers < plain.sessions[0].expected.attackers * 2, 'an ally who fights for allies half the time adds half a fighter')
check(helped.sessions[0].expected.defenders === 0 && helped.known.defenders === 0, 'an ally who never has adds nothing')

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
