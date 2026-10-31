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

import { FAR, attended, coverageOf, fighterOf, mergeMoments, packMoments, packTimes, unpackMoments, unpackTimes, type Mark, type Moment } from '../src/maps/fights'

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
check(took.stays[0]?.outcome === 'held' && !took.stays[0].ours, 'out before five minutes by these readings, but the banner turned theirs: held')
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

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
