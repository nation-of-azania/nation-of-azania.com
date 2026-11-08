/**
 * The war view's outlook (src/maps/outlook.ts): what each side needs from
 * now, whether the side ahead can leave the banner, the cap's dead points,
 * and the sessions to come. Checked on moments like the battles of
 * 1 November 2026 (docs/war-rules.md → Seen in a battle).
 *
 *   pnpm test:outlook
 */
import type { BattleReading } from '../src/maps/battle'
import { POINTS_PER_EXTRA_FIGHTER, forecastSiege, ofThisSiege, outlookOf, sessionsAfter, sessionsStarted } from '../src/maps/outlook'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}

const at = Date.parse('2026-11-01T00:20:00Z')
const reading = (side: 'attackers' | 'defenders' | null, holders: number, attacker: number, defender: number, minutesLeft: number): BattleReading => ({
  at,
  banner: { side, holders },
  points: { attacker, defender },
  secondsLeft: minutesLeft * 60,
})

// Cyprus's last session, a third in: the balance at the cap for the attackers, three of them holding.
const cyprus = outlookOf({ balance: 7000, progress: { done: 2, of: 3 } }, reading('attackers', 3, 700, 0, 40), at, null, { attackers: 4, defenders: 5 })!
check(cyprus.final && cyprus.checks === 120, 'the last session, 120 checks left')
check(cyprus.needs.siege.attackers.already && cyprus.needs.session.attackers.already, 'the attackers have the session and the siege if nothing changes')
const defenders = cyprus.needs.siege.defenders
// 0 − 700 − 3,600 to come = −4,300; the siege wants more than +7,000 from them: 11,301 short.
check(defenders.short === 11301 && defenders.kills === 114, 'the defenders are 11,301 short of the siege, or 114 kills')
// Taking it: 150 more for the attackers through the capture, then 105 checks at 10 a holder: (7,001 + 1,150) / 1,050 → 8.
check(defenders.holders === 8 && defenders.enough === false, 'eight holders from now would do, more than their five online: out of reach')
check(cyprus.safeToLeave?.side === 'attackers' && cyprus.safeToLeave.safe && cyprus.safeToLeave.margin === 2900, 'the attackers could leave the banner: all five defenders taking it still leave them 2,900 to spare')
check(cyprus.overCap?.side === 'attackers' && cyprus.overCap.points === 4300, 'past the cap by 4,300: the attackers’ further points, and the defenders’ first 4,300, count for nothing')

// South_America_Quarry's first session, before the defenders came back: one attacker holding, 680 to none, 24 minutes left.
const quarry = outlookOf({ balance: 0, progress: { done: 0, of: 3 } }, reading('attackers', 1, 680, 0, 24), at, null, { attackers: 2, defenders: 3 })!
check(!quarry.final && quarry.needs.session.attackers.already, 'the attackers have the session if nothing changes')
// −680 − 150 through the capture, then 57 checks at 10 a holder: 831 / 570 → 2.
check(quarry.needs.session.defenders.holders === 2 && quarry.needs.session.defenders.enough === true, 'two defenders taking it would turn the session, and they have three online (they did, with two, and won it by 800)')
check(quarry.safeToLeave?.side === 'attackers' && !quarry.safeToLeave.safe, 'the attackers can’t leave the banner: three defenders taking it would overturn them')
check(quarry.overCap === null, 'well within the cap')
check(quarry.needs.siege.defenders.holders === quarry.needs.session.defenders.holders, 'from a level balance, the siege lead and the session want the same')

// Too late to take it.
const late = outlookOf({ balance: 0, progress: { done: 0, of: 3 } }, reading('attackers', 1, 100, 0, 4), at, null, null)!
check(late.needs.session.defenders.holders === null && late.needs.session.defenders.enough === false, 'four minutes left: no number of holders could take it in time')
check(late.needs.session.defenders.kills === 3, '…but three kills would (220 short)')
check(late.safeToLeave === null, 'whether the attackers can leave needs the defenders’ count')

// Holding but behind: more holders, each joining after five minutes.
const behind = outlookOf({ balance: 0, progress: { done: 0, of: 3 } }, reading('defenders', 1, 1000, 0, 30), at, null, { attackers: 1, defenders: 4 })!
// 0 − 1,000 + 900 to come = −100: short 101; each joiner earns 75 checks × 10 = 750: one more.
check(behind.needs.session.defenders.holders === 2 && behind.needs.session.defenders.short === 101, 'holding but 100 behind: one more holder joining does it')

// The sessions to come.
const starts = sessionsAfter(Date.parse('2026-11-01T04:50:00Z'), 3)
check(
  starts.map((start) => new Date(start).toISOString().slice(11, 16)).join() === '12:00,18:00,00:00',
  'the next three sessions: 13:00, 19:00, 01:00 CET (12:00, 18:00, 00:00 UTC)',
)
check(sessionsAfter(Date.parse('2026-11-01T12:30:00Z'), 1)[0] === Date.parse('2026-11-01T18:00:00Z'), 'a session on now isn’t among them')
const week = (hours: number[]) => Array.from({ length: 168 }, (_, hour) => (hours.includes(hour % 24) ? 1 : 0))
// The case the leadership asked about: the defenders on at 13:00 CET, the attackers flooding 19:00 and 01:00.
const forecast = forecastSiege(0, starts, {
  attackers: [1, 2, 3, 4].map(() => ({ could: 2, fought: 2, hours: week([18, 0]) })),
  defenders: [1, 2, 3, 4].map(() => ({ could: 2, fought: 2, hours: week([12]) })),
})
check(forecast.sessions[0].favoured === 'defenders' && forecast.sessions[1].favoured === 'attackers' && forecast.sessions[2].favoured === 'attackers', 'the defenders are likely to bring more at 13:00, the attackers at 19:00 and 01:00')
check(forecast.sessions[0].expected.defenders === 3 && forecast.sessions[1].expected.attackers === 3, 'expected fighters: four of each side, each turning up three times in four')
check(forecast.sessions[0].swing === -3 * POINTS_PER_EXTRA_FIGHTER && POINTS_PER_EXTRA_FIGHTER === 1650, 'a session’s swing: the difference in fighters × 1,650 (a holder for the hour, less the capture)')
check(forecast.sessions.map((session) => session.balance).join() === '-4950,0,4950' && forecast.winner === 'attackers', 'the balance goes −4,950, 0, +4,950: the attackers come out ahead')
check(
  forecast.lead?.side === 'defenders' && forecast.lead.needs === 9910 && !forecast.lead.possible,
  'the defenders would need a 9,910 lead going into 19:00, more than the cap allows: winning their own session big isn’t enough, they must contest the attackers’',
)
const capped = forecastSiege(0, starts, {
  attackers: [1, 2, 3, 4, 5, 6].map(() => ({ could: 2, fought: 2, hours: week([12, 18]) })),
  defenders: [1, 2, 3, 4].map(() => ({ could: 2, fought: 2, hours: week([0]) })),
})
check(capped.sessions.map((session) => session.balance).join() === '7000,7000,2050', 'the cap holds a run of wins at 7,000: the attackers’ second session adds nothing')
check(forecast.known.attackers === 4 && forecast.known.defenders === 4, 'what it rests on')
const unknown = forecastSiege(1200, starts, { attackers: [{ could: 0, fought: 0, hours: null }], defenders: [] })
check(unknown.sessions.every((session) => session.favoured === null && session.swing === 0) && unknown.winner === 'attackers' && unknown.lead === null, 'with no hours known, nothing is forecast; the balance stands')

// A siege's own sessions: South_America_Quarry, besieged by Sul America on 1 November (its first session tracked), by the
// American Syndicate on 3 November once Sul America held it, and by Sul America again from 7 November, as the tracker saved them.
const quarry1 = { startedAt: '2026-11-01T00:00:00.000Z', session: 0 }
const quarry3 = [
  { startedAt: '2026-11-07T18:00:00.000Z', session: 0 },
  { startedAt: '2026-11-08T00:00:00.000Z', session: 1 },
]
const bySul = [quarry1, ...quarry3]
const second = { progress: { done: 2, of: 3 } }
const between = Date.parse('2026-11-08T01:22:00Z')
check(sessionsStarted(Date.parse('2026-11-07T18:00:00Z'), between, 5) === 2 && sessionsStarted(Date.parse('2026-11-01T00:00:00Z'), between, 5) === 6, 'sessions started since: counted, and no further than asked')
const starts3 = (list: { startedAt: string }[]) => list.map((one) => one.startedAt).join()
check(starts3(ofThisSiege(bySul, second, between)) === starts3(quarry3), 'Sul America’s siege of 7 November is two sessions, not three: the 1 November one was another siege (the war view said “Session 4” next)')
// The third session on now (the marker still says 2 done until it ends), and just after it, before and once the marker counts it.
const third = { startedAt: '2026-11-08T12:00:00.000Z', session: 2 }
check(ofThisSiege([...bySul, third], second, Date.parse('2026-11-08T12:30:00Z')).length === 3, 'during the third session: the three of this siege')
check(ofThisSiege([...bySul, third], second, Date.parse('2026-11-08T13:01:00Z')).length === 3, 'just after it, the marker not yet counting it: still the three')
check(ofThisSiege([...bySul, third], { progress: { done: 3, of: 3 } }, Date.parse('2026-11-08T13:01:00Z')).length === 3, 'and once it does')
// A new siege by the same nation, laid before its first session: none of the old one's.
check(ofThisSiege(bySul, { progress: { done: 0, of: 3 } }, Date.parse('2026-11-09T10:00:00Z')).length === 0, 'a siege just laid again: nothing of the one before')
// A session nobody came to isn't tracked: the one before it still counts, and a siege's first tracked session can be its second.
const skipped = [{ startedAt: '2026-11-03T00:00:00.000Z', session: 0 }, { startedAt: '2026-11-03T18:00:00.000Z', session: 2 }]
check(ofThisSiege(skipped, { progress: { done: 2, of: 3 } }, Date.parse('2026-11-03T18:40:00Z')).length === 2, 'a session untracked between two: both kept')
check(ofThisSiege([quarry1, { startedAt: '2026-11-08T00:00:00.000Z', session: 1 }], second, between).length === 1, 'an old siege’s first session before a new one’s first tracked (its second): only the new one’s')
check(ofThisSiege(bySul, { progress: null }, between).length === 3, 'without the marker’s progress, all kept')

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
