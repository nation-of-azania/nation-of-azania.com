/**
 * The war view's battle sums (src/maps/battle.ts), checked against the
 * rules in docs/war-rules.md without a battle: the marker read, the score
 * run on between readings, the projection to the session's end and the
 * siege balance after it, what it takes to turn a battle round, sides and
 * zones, the way back to the banner, and the session clock.
 *
 *   pnpm test:battle
 */
import {
  RULES,
  assessBattle,
  bannerOf,
  bannerRate,
  killPaceObserved,
  multiplierObserved,
  playersAtSiege,
  projectBattle,
  readingOf,
  returnEstimate,
  reversalMultiplier,
  reversalsSeen,
  scoreNow,
  secondsLeftOf,
  sessionClock,
  sideOf,
  toTurnAround,
  type BattleReading,
  tickPhaseOf,
  checksBetween,
  checkAtOrAfter,
  stepCaptures,
  captureEndsAt,
  NO_CAPTURES,
  type PlayerSide,
} from '../src/maps/battle'
import type { LivePlayer } from '../src/maps/players'
import type { Siege } from '../src/maps/world'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}

const siege = (over: Partial<Siege> = {}): Siege => ({
  townId: 't1',
  town: 'Cape_Town',
  townNation: 'Zulu_Kingdom',
  attacker: 'Azania',
  defender: 'Zulu_Kingdom',
  at: [1000, 2000],
  battle: true,
  type: 'Conquest',
  status: 'In Progress',
  progress: { done: 1, of: 3 },
  balance: 1250,
  bannerControl: 'Attackers (3)',
  battlePoints: { attacker: '+600', defender: '+200' },
  battleTimeLeft: '30.0 minutes',
  warChest: '$2,500.00',
  lines: [],
  ...over,
})

// The marker, read.
check(JSON.stringify(bannerOf(siege())) === '{"side":"attackers","holders":3}', 'banner: "Attackers (3)"')
check(bannerOf(siege({ bannerControl: 'Nobody' })).side === null, 'banner: "Nobody"')
check(bannerOf(siege({ bannerControl: 'Defenders' })).holders === 1, 'banner: a side without a count has one holder')
check(secondsLeftOf('45.3 minutes') === 2718, 'time left: "45.3 minutes"')
check(secondsLeftOf('1.0 hours') === 3600, 'time left: "1.0 hours"')
check(secondsLeftOf('38 seconds') === 38, 'time left: "38 seconds"')
check(secondsLeftOf('12m 30s') === 750, 'time left: "12m 30s"')
check(secondsLeftOf('N/A') === null && secondsLeftOf(null) === null, 'time left: "N/A" is no battle')

// The rates.
check(bannerRate(1, 1) === 0.5, 'one holder earns 10 points per 20 s: half a point a second')
check(reversalMultiplier(0) === 1 && reversalMultiplier(1) === 3 && reversalMultiplier(2) === 6, 'reversal bonus: ×1, then ×3, ×6')

// The score run on between readings.
const at = Date.UTC(2026, 10, 1, 12, 30)
const reading = readingOf(siege(), at)
const later = scoreNow(reading, 1, at + 65_000)
check(later?.attacker === 600 + 3 * 10 * 3 && later?.defender === 200, 'a minute on: three holders earn 3 ticks × 30')
const held = scoreNow({ ...reading, secondsLeft: 30 }, 1, at + 120_000)
check(held?.attacker === 600 + 30, 'the banner earns nothing after the session ends')

// To the end of the session, and the balance after it.
const end = projectBattle(siege(), reading, 1, at)
check(end?.points.attacker === 600 + 3 * 10 * 90 && end?.points.defender === 200, 'projection: 90 more ticks at 30 points')
check(end?.balance === 1250 + (3300 - 200), 'projection: the balance moves by attacker − defender points')
check(end?.sessionsLeft === 1, 'projection: one session after this one')
const paced = projectBattle(siege(), reading, 1, at, { attacker: 0, defender: 0.2 })
check(paced?.points.defender === 200 + Math.round(0.2 * 30 * 100), 'projection: kills at a pace')
const capped = projectBattle(siege({ balance: 19_500 }), reading, 1, at)
check(capped?.balance === RULES.balanceCap, 'projection: the balance holds at its cap')
check(projectBattle(siege(), { ...reading, secondsLeft: null }, 1, at) === null, 'projection: none between sessions')

// Turning it round.
const turn = toTurnAround(3000, 2, 3)
check(turn?.kills === 30, 'turnaround: 3000 points is 30 kills')
check(turn?.minutes === 50, 'turnaround: or 50 minutes of two holders')
check(Math.abs((turn?.minutesRetaken ?? 0) - (5 + 3000 / 180)) < 1e-9, 'turnaround: or a capture and 16⅔ minutes at ×3')
check(toTurnAround(0, 2, 3) === null && toTurnAround(-5, 2, 3) === null, 'turnaround: none for the side ahead')

// Reversals and the multiplier the points show.
const steps = (sides: (BattleReading['banner']['side'])[]): BattleReading[] =>
  sides.map((side, i) => ({ at: at + i * 30_000, banner: { side, holders: 1 }, points: { attacker: 0, defender: 0 }, secondsLeft: 3600 - i * 30 }))
check(reversalsSeen(steps([null, 'attackers', 'attackers', 'defenders', 'attackers'])).reversals === 2, 'reversals: taken twice from the other side')
check(reversalsSeen(steps([null, 'attackers'])).complete, 'reversals: readings from the session start are complete')
check(!reversalsSeen([{ ...steps(['attackers'])[0], secondsLeft: 1200, points: { attacker: 400, defender: 0 } }]).complete, 'reversals: readings from mid-session are not')
const pair = (gain: number): BattleReading[] => [
  { at, banner: { side: 'defenders', holders: 2 }, points: { attacker: 0, defender: 1000 }, secondsLeft: 1800 },
  { at: at + 60_000, banner: { side: 'defenders', holders: 2 }, points: { attacker: 0, defender: 1000 + gain }, secondsLeft: 1740 },
]
check(multiplierObserved(pair(60)) === 1, 'multiplier: 2 holders, 3 ticks, 60 points is ×1')
check(multiplierObserved(pair(180)) === 3, 'multiplier: 180 points is ×3')
check(multiplierObserved(pair(160)) === 1, 'multiplier: 160 points (a kill and ×1) is ×1')
check(multiplierObserved(pair(30)) === null, 'multiplier: less than the holders earn says nothing')
// Readings half a minute apart, as the war view has them: a tick and a half each, read across the run.
const halfMinutes = (points: number[]): BattleReading[] =>
  points.map((defender, i) => ({ at: at + i * 30_000, banner: { side: 'defenders', holders: 2 }, points: { attacker: 0, defender }, secondsLeft: 1800 - i * 30 }))
check(multiplierObserved(halfMinutes([1000, 1060, 1180])) === 3, 'multiplier: readings half a minute apart say ×3 across a minute')
check(multiplierObserved(halfMinutes([1000, 1060])) === null, 'multiplier: two readings half a minute apart say nothing yet')
check(
  multiplierObserved([...halfMinutes([1000, 1060, 1180]), { ...halfMinutes([0])[0], at: at + 90_000, banner: { side: 'attackers', holders: 1 }, points: { attacker: 500, defender: 1180 } }]) === 3,
  'multiplier: a change of hands ends the run, and the run before still says',
)

// The pace of kills the points show.
const paceReadings = (gains: [number, number][]): BattleReading[] =>
  gains.map(([attacker, defender], i) => ({
    at: at + i * 60_000,
    banner: { side: 'attackers', holders: 2 },
    points: { attacker, defender },
    secondsLeft: 3600 - i * 60,
  }))
// Two holders at ×1 earn 60 a minute; the rest of the attackers' 160 is a kill, and the defenders' 200 two.
check(
  JSON.stringify(killPaceObserved(paceReadings([[0, 0], [160, 0], [220, 200]]), 1)) === JSON.stringify({ attacker: 0.5, defender: 1 }),
  'pace: a kill a minute for the attackers over two minutes, two for the defenders',
)
check(killPaceObserved(paceReadings([[0, 0]]), 1) === null, 'pace: one reading says nothing')
// Three holders at ×3 earn 90 a tick: half-minute readings that alternate one and two ticks are no kills.
const ticking = [0, 90, 270, 360, 540, 630].map((attacker, i) => ({
  at: at + i * 30_000,
  banner: { side: 'attackers' as const, holders: 3 },
  points: { attacker, defender: 0 },
  secondsLeft: 1800 - i * 30,
}))
check(killPaceObserved(ticking, 3)?.attacker === 0, 'pace: the banner’s own ticks between readings are not kills')
check(
  killPaceObserved([...paceReadings([[0, 0], [60, 0]]), { ...paceReadings([[0, 0]])[0], at: at + 120_000, banner: { side: 'defenders', holders: 1 }, points: { attacker: 60, defender: 300 } }], 1)
    ?.defender === 0,
  'pace: a pair across a change of hands is skipped',
)

// The battle, assessed.
const assessed = assessBattle(siege(), [reading], at + 65_000, { attackers: 3, defenders: 1 })
check(assessed?.multiplier.value === 1 && assessed.multiplier.source === 'assumed', 'assessed: one reading mid-session assumes ×1')
check(assessed?.score?.attacker === 690, 'assessed: the score run on')
// A minute and five seconds on: 690 now, and 86 more ticks of three holders (2,580) to come.
check(assessed?.projected?.balance === 1250 + 690 + 2580 - 200, 'assessed: the projection from the reading')
check(assessed?.behind?.side === 'defenders' && assessed.behind.deficit === 4320, 'assessed: the defenders are behind by the projected balance')
check(assessed?.behind?.kills === 44, 'assessed: 4,320 points is 44 kills')
// 28:55 left, less the 5 minutes the capture takes: 71 ticks; retaken at ×3, a holder earns 30 a tick, 2,130 in all: three holders.
check(assessed?.behind?.holdersNeeded === 3, 'assessed: or three holders after taking the banner back, the capture’s minutes left out')
// The defenders holding already lose no time to a capture: 86 ticks at ×1, 860 a holder, for a 1,000-point gap: two holders.
const holding = assessBattle(
  siege({ balance: -1000, bannerControl: 'Defenders (1)', battlePoints: { attacker: '0', defender: '0' } }),
  [reading].map((r) => ({ ...r, banner: { side: 'defenders' as const, holders: 1 }, points: { attacker: 0, defender: 0 } })),
  at + 65_000,
  { attackers: 0, defenders: 1 },
)
check(holding?.behind === null || holding?.behind?.side === 'attackers', 'assessed: a side ahead and holding is not behind')
check(assessed?.behind?.minutesRetaken !== null && (assessed?.behind?.minutesRetaken ?? 0) > 5, 'assessed: taking it back takes the capture and the holding')
check(assessBattle(siege(), [], at, { attackers: 0, defenders: 0 }) === null, 'assessed: nothing without a reading')
const fromStart = assessBattle(siege(), steps([null, 'attackers', 'defenders']), at + 90_000, { attackers: 1, defenders: 1 })
check(fromStart?.multiplier.value === 3 && fromStart.multiplier.source === 'inferred', 'assessed: a reversal seen from the session start infers ×3')

// Sides and zones.
const towns = [
  { name: 'Johannesburg', nation: 'Azania', people: ['IPaaat', 'Coug_'], home: [5000, 2000] as [number, number] },
  { name: 'Cape_Town', nation: 'Zulu_Kingdom', people: ['Shaka'], home: [1040, 2000] as [number, number] },
  { name: 'Durban', nation: 'Zulu_Kingdom', people: ['Dingane'], home: [9000, 9000] as [number, number] },
  { name: 'Elsewhere', nation: 'Other_Nation', people: ['Stranger'], home: null },
]
check(sideOf(towns[0], siege()) === 'attackers', 'side: the attacking nation attacks')
check(sideOf(towns[1], siege()) === 'defenders' && sideOf(towns[2], siege()) === 'defenders', 'side: the town and its nation defend')
check(sideOf(towns[3], siege()) === 'other' && sideOf(null, siege()) === 'other', 'side: anyone else is other')
check(sideOf({ name: 'Lonely', nation: null }, siege({ attacker: 'Lonely' })) === 'attackers', 'side: a nationless attacking town')
const player = (name: string, x: number, z: number): LivePlayer => ({ name, x, y: 64, z, health: 20, armor: 10 })
const near = playersAtSiege(siege(), [player('ipaaat', 1005, 2000), player('Shaka', 1100, 2000), player('Dingane', 1000, 2350), player('Stranger', 1000, 2010), player('Coug_', 9000, 9000)], towns)
check(near.near.length === 4 && near.near[0].player.name === 'ipaaat', 'zones: nearest first, the far left out; names in any case')
check(near.atBanner.attackers === 1 && near.atBanner.other === 1 && near.atBanner.defenders === 0, 'zones: at the banner')
check(near.inZone.defenders === 1 && near.inZone.attackers === 1, 'zones: in the siege zone (350 blocks is outside)')

// The way back.
const run = returnEstimate([1000, 2560], [1000, 2000], null)
check(run.via === 'run' && run.seconds === 100, 'way back: 560 blocks sprinting is 100 s')
const spawn = returnEstimate([20000, 2000], [1000, 2000], [1300, 2000])
check(spawn.via === 'spawn' && spawn.blocks === 300, 'way back: by the town spawn when it is nearer')
check(returnEstimate([20000, 2000], [1000, 2000], [1100, 2000]).via === 'run', 'way back: never a spawn inside the siege zone')

// The session clock, in the server's time (CET in winter, CEST in summer).
const winter = sessionClock(Date.UTC(2026, 10, 1, 12, 30))
check(winter.on && winter.start === Date.UTC(2026, 10, 1, 12) && winter.end === Date.UTC(2026, 10, 1, 13), 'clock: 13:00 CET is 12:00 UTC, on at 12:30')
const between = sessionClock(Date.UTC(2026, 10, 1, 14))
check(!between.on && between.start === Date.UTC(2026, 10, 1, 18), 'clock: next 19:00 CET')
const night = sessionClock(Date.UTC(2026, 10, 1, 23, 10))
check(!night.on && night.start === Date.UTC(2026, 11 - 1, 2, 0), 'clock: 01:00 CET is midnight UTC')
const summer = sessionClock(Date.UTC(2026, 6, 4, 10))
check(!summer.on && summer.start === Date.UTC(2026, 6, 4, 11), 'clock: 13:00 CEST is 11:00 UTC')

// The checks' rhythm, read off the real battle (Cyprus, 31 October 2026, from 18:05:00 UTC): markers every 15 s,
// the attackers holding with two, +20 a tick. Each: [ms after 18:05:00, attacker's points, holders, minutes left].
{
  const base = 1793469900000
  const real: [number, number, number, number][] = [
    [38083, 100, 2, 54.6], [53083, 120, 2, 54.3], [68083, 120, 2, 54.1], [83083, 140, 2, 53.8], [98083, 160, 2, 53.6],
    [113083, 180, 2, 53.3], [128113, 180, 2, 53.1], [143083, 200, 2, 52.8], [158083, 220, 2, 52.6], [173083, 240, 2, 52.3],
    [188433, 240, 2, 52.1], [203433, 260, 2, 51.8], [218433, 280, 2, 51.6], [233433, 300, 2, 51.3], [248433, 300, 2, 51.1],
    [263433, 320, 2, 50.8], [278433, 340, 2, 50.6], [293434, 360, 2, 50.3], [308433, 360, 2, 50.1], [323434, 380, 2, 49.8],
    [338433, 400, 2, 49.6], [353433, 420, 2, 49.3], [368436, 420, 2, 49.1], [383442, 440, 2, 48.8], [398433, 460, 2, 48.6],
  ]
  const readings: BattleReading[] = real.map(([ms, points, holders, minutes]) => ({
    at: base + ms,
    banner: { side: 'attackers', holders },
    points: { attacker: points, defender: 0 },
    secondsLeft: Math.round(minutes * 60),
  }))
  const phase = tickPhaseOf(readings)
  check(phase !== null && phase > 8000 && phase < 13500, `the checks fall about 10 s past each 20-second step, as seen (${phase} ms)`)
  const from = readings[1]
  check(scoreNow(from, 1, base + 68083, phase)?.attacker === 120 && scoreNow(from, 1, base + 83083, phase)?.attacker === 140, 'with it, the score rises on the very check: none before 68 s, one by 83 s')
  check(tickPhaseOf(readings.slice(0, 4)) === null, 'too few readings say nothing')
  check(checksBetween(base, base + 60_000, 11_000) === 3 && checkAtOrAfter(base + 11_001, 11_000) === base + 31_000, 'three checks a minute, on the phase')

  // From the reading of 18:28:23 (the third holder just in, +1,460, 31.8 minutes left), the session ended at +4,340 and the
  // balance at the cap: 3,280 + 4,340 would have been 7,620.
  const at = 1793471303583
  const late: BattleReading = { at, banner: { side: 'attackers', holders: 3 }, points: { attacker: 1460, defender: 0 }, secondsLeft: 1908 }
  const end = projectBattle({ balance: 3280, progress: { done: 1, of: 3 } }, late, 1, at, undefined, phase)
  check(end !== null && Math.abs(end.points.attacker - 4340) <= 30, `the session projected to its real end, +4,340 (${end?.points.attacker})`)
  check(end?.balance === 7000 && end.overCap === 3280 + end.points.attacker - 7000, `the balance held at the cap, ${end?.overCap} points beyond it lost`)
  check(projectBattle({ balance: 0, progress: null }, late, 1, at, undefined, phase)?.overCap === 0, 'nothing lost short of the cap')
  // Behind past the cap, the defenders must make up the whole margin: the 7,000 and what's over it.
  const capped = assessBattle(siege({ balance: 3280 }), [late], at, { attackers: 3, defenders: 0 })
  check(
    capped?.behind?.side === 'defenders' && capped.behind.deficit === 7000 + (capped.projected?.overCap ?? 0) && (capped.projected?.overCap ?? 0) > 0,
    `past the cap the deficit is the whole margin (${capped?.behind?.deficit}, ${capped?.projected?.overCap} over the cap)`,
  )
}

// Captures, SiegeWar's way: checks at 11 s past each 20-second step, readings every 2 s, the banner at the origin.
{
  const base = 1793469900000
  const phase = 11_000
  const sides: Record<string, PlayerSide> = { A: 'attackers', B: 'attackers', D: 'defenders', O: 'other' }
  const sideOfName = (name: string) => sides[name] ?? null
  type Spot = { name: string; x: number; z: number; health: number | null }
  const run = (from: number, to: number, where: (t: number) => Spot[], start = NO_CAPTURES) => {
    let captures = start
    for (let t = from; t <= to; t += 2000) captures = stepCaptures(captures, { at: base + t, players: where(t) }, [0, 0], phase, sideOfName)
    return captures
  }
  const at = (name: string, x = 3): Spot => ({ name, x, z: 0, health: 20 })
  // A in the zone from 5 s on, but for 52–58 s, between the checks at 51 and 71 s: unseen.
  const a = run(0, 320_000, (t) => [t >= 5000 && !(t >= 52_000 && t <= 58_000) ? at('A') : at('A', 300), at('O')])
  check(a.holdersSide === 'attackers' && a.holders.map((h) => h.name).join() === 'A', 'a capture completes on the check five minutes after the first that found them')
  check(captureEndsAt(base + 11_000, phase) === base + 311_000, 'begun on the check at 11 s, it completes on the one at 311 s')
  const early = run(0, 310_000, (t) => [t >= 5000 ? at('A') : at('A', 300)])
  check(early.holders.length === 0 && early.under.get('A')?.since === base + 11_000, 'not a check sooner')
  // Out of the zone over the check at 71 s: the capture starts again on the next that finds them (91 s), and so ends at 391 s.
  const broken = run(0, 389_000, (t) => [t >= 5000 && !(t >= 70_000 && t <= 72_000) ? at('A') : at('A', 300)])
  check(broken.holders.length === 0 && broken.under.get('A')?.since === base + 91_000, 'leaving the zone on a check ends the capture; it starts again')
  check(run(0, 392_000, (t) => [t >= 5000 && !(t >= 70_000 && t <= 72_000) ? at('A') : at('A', 300)]).holders.length === 1, 'and completes five minutes after that')
  check(run(0, 400_000, () => [at('O')]).under.size === 0, 'anyone of neither side captures nothing')
  check(run(0, 400_000, () => [{ ...at('A'), health: 0 }]).under.size === 0, 'nor the dead')
  // B joins the attackers' holders; then D, a defender, completes a capture: the banner is the defenders', D its only holder.
  const both = run(0, 420_000, (t) => [at('A'), ...(t >= 30_000 ? [at('B')] : []), ...(t >= 100_000 ? [at('D')] : [])])
  check(both.holdersSide === 'defenders' && both.holders.map((h) => h.name).join() === 'D', 'an enemy capture takes the banner: the holders are theirs alone')
  const joined = run(0, 340_000, (t) => [at('A'), ...(t >= 30_000 ? [at('B')] : [])])
  check(joined.holders.map((h) => h.name).join() === 'A,B', 'a second capture of the same side joins the holders')
  check(run(0, 330_000, (t) => [at('A')]).under.has('A') === false, 'a holder captures no more')
  const gap = run(0, 100_000, (t) => [at('A')])
  check(stepCaptures(gap, { at: base + 400_000, players: [at('A')] }, [0, 0], phase, sideOfName).under.get('A')?.since === base + 391_000, 'after a gap in the readings a capture starts afresh')
}

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
