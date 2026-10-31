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
  bannerOf,
  bannerRate,
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

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
