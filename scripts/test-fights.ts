/**
 * The battle tracker's reading of a battle (src/maps/fights.ts): stays in
 * the banner zone and how they ended, deaths, time in the zones. Checked
 * on made-up moments for each way a stay ends, and on a real battle: the
 * Cyprus siege's second session (31 October 2026, 18:00 UTC), read from the
 * map every two seconds, whose story is known from watching it (the
 * attackers' pair taking the banner on the fifth minute, a defender dying
 * at the banner for the attackers' first hundred, a third attacker joining
 * the holders at 18:28).
 *
 *   pnpm test:fights
 */
import { readFileSync } from 'node:fs'

import { expectedAt, fighterScore, hourOfWeek, holdRate, recordsOf, turnout, usualHours, type SavedBattle } from '../src/maps/fighters'
import { FAR, attended, coverageOf, fighterOf, mergeMoments, packMoments, packTimes, triesOf, unpackMoments, unpackTimes, type Mark, type Moment } from '../src/maps/fights'
import { packBits, withSlot } from '../src/lib/presence'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}

// Packing.
const moments: Moment[] = [
  { t: 0, d: 3, h: 20, a: 15 },
  { t: 3, d: 250, h: 7.5, a: null },
  { t: 3599, d: FAR, h: null, a: 0 },
]
check(JSON.stringify(unpackMoments(packMoments(moments))) === JSON.stringify(moments), 'moments survive packing, half hearts and all')
check(JSON.stringify(unpackTimes(packTimes([0, 3, 7, 3600]))) === '[0,3,7,3600]', 'reading times survive packing')
check(unpackMoments('not base64!').length === 0, 'an unreadable pack is no moments')
check(mergeMoments([{ t: 3, d: 1, h: 20, a: 0 }], [{ t: 0, d: 9, h: 20, a: 0 }, { t: 3, d: 2, h: 20, a: 0 }]).map((m) => `${m.t}:${m.d}`).join() === '0:9,3:1', 'merged by time, the first kept on a tie')

// Made-up stays: readings every 3 seconds for 15 minutes.
const readings = Array.from({ length: 301 }, (_, i) => i * 3)
const stay = (from: number, to: number, d = 5, h = 20): Moment[] => readings.filter((t) => t >= from && t <= to).map((t) => ({ t, d, h, a: 10 }))
const none: Mark[] = []
const held = fighterOf('A', 'attackers', readings, stay(30, 400), none)
check(held.stays.length === 1 && held.stays[0].outcome === 'held', 'five minutes and more at the banner: held')
const left = fighterOf('A', 'attackers', readings, [...stay(30, 150), ...stay(153, 300, 60)], none)
check(left.stays.length === 1 && left.stays[0].outcome === 'left', 'two minutes, then out into the zone: left')
const blip = fighterOf('A', 'attackers', readings, [...stay(30, 150), ...stay(153, 165, 30), ...stay(168, 420)], none)
check(blip.stays.length === 1 && blip.stays[0].outcome === 'held', 'a step out shorter than a check doesn’t end the stay')
const died = fighterOf('A', 'attackers', readings, [...stay(30, 99), { t: 102, d: 4, h: 3, a: 10 }, { t: 105, d: FAR, h: 20, a: 0 }], [
  { t: 90, banner: null, holders: 0, attacker: 0, defender: 0 },
  { t: 120, banner: null, holders: 0, attacker: 0, defender: 100 },
])
check(died.stays[0]?.outcome === 'died' && died.deaths.length === 1 && died.deaths[0].confirmed, 'struck down at the banner and respawned far off: died, confirmed by the defenders’ hundred')
const zero = fighterOf('A', 'defenders', readings, [...stay(30, 99, 50, 6), { t: 102, d: 52, h: 0, a: 0 }, { t: 105, d: 140, h: 20, a: 0 }], none)
check(zero.deaths.length === 1 && !zero.deaths[0].confirmed && zero.stays.length === 0, 'a reading at no health is a death, one even with its respawn; unconfirmed without the points')
const pearl = fighterOf('A', 'attackers', readings, [...stay(30, 99, 150, 20), { t: 102, d: 40, h: 20, a: 10 }], none)
check(pearl.deaths.length === 0, 'a jump at full health is no death')
const cut = fighterOf('A', 'attackers', readings.filter((t) => t < 200 || t > 260), stay(30, 400), none)
check(cut.stays[0]?.outcome === 'cut', 'a gap in the readings mid-stay: cut, not known')
const took = fighterOf('A', 'attackers', readings, stay(30, 200), [
  { t: 0, banner: null, holders: 0, attacker: 0, defender: 0 },
  { t: 210, banner: 'attackers', holders: 1, attacker: 0, defender: 0 },
])
check(took.stays[0]?.outcome === 'left', 'out before five minutes, while a teammate took the banner: their own capture failed, left')
const late = fighterOf('A', 'attackers', readings.filter((t) => t >= 30), stay(30, 200), [
  { t: 0, banner: null, holders: 0, attacker: 0, defender: 0 },
  { t: 210, banner: 'attackers', holders: 1, attacker: 0, defender: 0 },
])
check(late.stays[0]?.outcome === 'held' && late.stays[0].early === true, 'already there when the readings began, and the banner turned theirs within five minutes: held')
const short = fighterOf('A', 'attackers', readings, stay(30, 340), [
  { t: 0, banner: null, holders: 0, attacker: 0, defender: 0 },
  { t: 400, banner: null, holders: 0, attacker: 0, defender: 0 },
])
check(short.stays[0]?.outcome === 'left', 'five minutes and more there, but the marks show no capture: not held (left a check too soon, or not counted)')
check(attended(held) && !attended(fighterOf('A', 'other', readings, stay(30, 45, 150), none)), 'a minute in the zone counts as fought; fifteen seconds doesn’t')
check(Math.abs(coverageOf(readings) - 900 / 3600) < 0.001, 'coverage: fifteen minutes of an hour')

// The real battle.
type Fixture = { start: string; readings: string; marks: Mark[]; players: Record<string, { side: 'attackers' | 'defenders' | 'other'; moments: string }> }
const fixture = JSON.parse(readFileSync(new URL('./fixtures/battle-cyprus-2026-10-31-1800.json', import.meta.url), 'utf8')) as Fixture
const real = unpackTimes(fixture.readings)
const of = (name: string) => fighterOf(name, fixture.players[name].side, real, unpackMoments(fixture.players[name].moments), fixture.marks)
check(coverageOf(real) > 0.99, 'the logged session is covered end to end')
const pair = [of('Mutewarrior'), of('Soviet_Gorge')]
check(pair.every((f) => f.stays.length === 1 && f.stays[0].outcome === 'held' && f.stays[0].from <= 5 && !f.stays[0].ours), 'the attackers’ pair: at the banner from the start, held it')
const funcase = of('.FunCase2229')
check(funcase.stays[0]?.outcome === 'died' && funcase.deaths.length === 1 && funcase.deaths[0].confirmed, 'the defender at the banner died there, confirmed by the attackers’ first hundred')
check(of('Sllikrick').stays[0]?.outcome === 'left' && !attended(of('Sllikrick')), 'another came and went: left, under a minute in the zone')
const piggie = of('Little__Piggie')
check(piggie.stays.length === 1 && piggie.stays[0].outcome === 'held' && piggie.stays[0].ours, 'the third attacker joined the holders while their side held the banner: held')

// Another real battle, contested: South_America_Quarry's first session (1 November 2026, 00:00 UTC), the siege laid at
// 00:08 within the session. The attackers took the banner at 00:13:50; two players who live with neither side (an
// ally's, Imperial_Avalonia) took it back for the defenders at 00:38:20 and joined as the second holder at 00:44:48;
// four attackers' deaths each gave the defenders a hundred, their points written with a minus.
const quarry = JSON.parse(readFileSync(new URL('./fixtures/battle-south-america-quarry-2026-11-01-0000.json', import.meta.url), 'utf8')) as Fixture
const quarryReadings = unpackTimes(quarry.readings)
const inQuarry = (name: string) => fighterOf(name, quarry.players[name].side, quarryReadings, unpackMoments(quarry.players[name].moments), quarry.marks)
const mano = inQuarry('Mano3543')
check(mano.stays[0].outcome === 'held' && mano.deaths.length === 2 && mano.deaths.every((death) => death.confirmed), 'the attackers’ taker held it, then died twice, both confirmed by the defenders’ points')
check(inQuarry('axoolle').deaths.filter((death) => death.confirmed).length === 2, 'another attacker’s two deaths, confirmed')
const pandaz = inQuarry('Its_Pandaz')
check(pandaz.side === 'defenders' && pandaz.ally === true, 'one of neither side who took the banner for the defenders is a defender by their play')
check(triesOf(pandaz.stays).length === 1 && triesOf(pandaz.stays)[0].outcome === 'held' && pandaz.stays.slice(1).every((stay) => stay.holder), 'took it once; the stays after, as its holder, are no tries')
const quade = inQuarry('quadecaelite68')
check(quade.side === 'defenders' && quade.ally === true && triesOf(quade.stays).filter((stay) => stay.outcome === 'held').length === 1, 'the other joined the holders: a defender by play, one try held')
check(inQuarry('Averycooper').side === 'other' && !inQuarry('Averycooper').ally, 'one whose play shows no side stays of neither')

// A third, 1 November 2026, 12:00 UTC: Greater China's siege of Pataliputra, a town of no nation. Its defender stood on the
// banner from the first second to 12:05:09 and no capture came of it; Luixtiter (Azania) took the banner for the attackers
// at 12:15:03; the defender, killed five times by the points, respawned each time at the town's spawn inside the zone.
const pata = JSON.parse(readFileSync(new URL('./fixtures/battle-pataliputra-2026-11-01-1200.json', import.meta.url), 'utf8')) as Fixture
const pataReadings = unpackTimes(pata.readings)
const inPata = (name: string) => fighterOf(name, pata.players[name].side, pataReadings, unpackMoments(pata.players[name].moments), pata.marks)
const green = inPata('GreenStreak10')
check(green.stays[0].outcome === 'left' && green.stays[0].to - green.stays[0].from > 300, 'five minutes and eight seconds on the banner, gone before the completing check: no capture, left')
check(green.stays.some((stay) => stay.outcome === 'held' && stay.from > 1100), 'their capture from 12:19:28, 16 blocks off: held, the defenders took the banner at 12:24:33')
check(green.deaths.length === 4 && green.deaths.every((death) => death.confirmed) && green.deaths[0].at === 577, 'four of the five deaths the points show, one of them a blow from full health with no reading at no health')
const luix = inPata('Luixtiter')
check(luix.side === 'attackers' && luix.ally === true && luix.by === 'banner', 'Luixtiter, of neither side: an attacker by the capture five minutes after stepping in, not by the defenders’ capture while there')
check(triesOf(luix.stays).length === 1 && luix.stays[1]?.holder === true, 'took it once; the stay after began as one of its holders')

// Records across battles.
const saved: SavedBattle = {
  startedAt: fixture.start,
  town: 'Cyprus',
  attacker: 'The_Balkan_Kingdom',
  defender: 'Syrian_Empire',
  coverage: coverageOf(real),
  result: fixture.marks[fixture.marks.length - 1],
  sides: { attackers: ['Mutewarrior', 'Soviet_Gorge', 'Little__Piggie', 'StayedHome'], defenders: ['.FunCase2229', 'Sllikrick'] },
  fighters: Object.keys(fixture.players).map(of),
}
const records = recordsOf([saved, { ...saved, startedAt: '2026-11-01T00:00:00Z', fighters: [of('Mutewarrior')] }])
const mute = records.get('mutewarrior')!
check(mute.could === 2 && mute.fought === 2 && mute.held === 2 && mute.won === 2 && holdRate(mute) === 1 && turnout(mute) === 1, 'two battles fought, two stays held, two sessions won on points')
const home = records.get('stayedhome')!
check(home.could === 2 && home.fought === 0 && turnout(home) === 0, 'one who could have fought twice and didn’t: turnout nought')
const fun = records.get('.funcase2229')
check(!fun || fun.fought === 0, 'under a minute in the zone isn’t fighting, even dying there')
check(records.get('soviet_gorge')?.lastFought === fixture.start && records.get('soviet_gorge')?.side === 'attackers', 'the side last fought on, and when')

// Usual hours.
const saturday = withSlot({}, ['Night_Owl'], 23 * 12 + 2)
const hours = usualHours([
  { day: '2026-10-31', slots: saturday },
  { day: '2026-10-24', slots: {} },
  { day: '2026-10-30', slots: { Night_Owl: packBits(new Uint8Array(36)) } },
])
const owl = hours.get('night_owl')!
check(owl.length === 168 && owl[hourOfWeek(Date.parse('2026-10-31T23:30:00Z'))] === 0.5, 'online one of two Saturdays at 23:00 UTC: a half')
check(owl.filter((share) => share > 0).length === 1, 'and no other hour')
check(hourOfWeek(Date.parse('2026-11-02T00:10:00Z')) === 0, 'Monday 00:00 UTC is the week’s first hour')

// The score and who to expect.
check(fighterScore({ held: 0, died: 0, left: 0, could: 0, fought: 0 }) === 25, 'a newcomer starts mid-table: an even chance of each, 25')
check(fighterScore({ held: 1, died: 0, left: 0, could: 1, fought: 1 }) < fighterScore({ held: 6, died: 1, left: 0, could: 6, fought: 6 }), 'one lucky try doesn’t beat a long record')
check(fighterScore({ held: 0, died: 4, left: 2, could: 6, fought: 6 }) < 25, 'tries that all end in death or retreat score low')
check(fighterScore({ held: 5, died: 0, left: 0, could: 10, fought: 2 }) < fighterScore({ held: 5, died: 0, left: 0, could: 5, fought: 5 }), 'showing up counts')
const owlRecord = { could: 2, fought: 2, hours: owl }
check(expectedAt(owlRecord, Date.parse('2026-11-07T23:10:00Z')) === 0.38 && expectedAt(owlRecord, Date.parse('2026-11-07T12:00:00Z')) === 0, 'expected at a Saturday 23:00: online half the Saturdays × fights three in four (smoothed); at noon, not at all')
check(expectedAt({ could: 0, fought: 0, hours: null }, Date.now()) === null, 'no hours, no expectation')

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
