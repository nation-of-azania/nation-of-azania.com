/**
 * How players move (src/maps/motion.ts): their own pace with teleports
 * dropped out, deaths and teleports, the lock after a death, and the time
 * back to a banner. Checked on a real death and return, logged from the
 * map every two seconds (scripts/fixtures/respawn-mano3543-2026-11-01.json).
 *
 *   pnpm test:motion
 */
import { readFileSync } from 'node:fs'

import { SPRINT_BLOCKS_PER_S } from '../src/maps/battle'
import { FOLLOW_MS, MOST_BLOCKS_PER_S, TELEPORT_LOCK_SECONDS, diedBetween, followed, lockOf, paceOf, returnOf, teleportedBetween, type Fix, type Follow } from '../src/maps/motion'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}

// A pace, made up: walking steps with one teleport among them.
const walk = (speed: number, from = 0, count = 12, every = 2000): Fix[] =>
  Array.from({ length: count }, (_, i) => ({ at: from + i * every, x: i * speed * (every / 1000), z: 0, health: 20 }))
const steady = walk(5.6)
check(Math.abs((paceOf(steady, steady.at(-1)!.at)?.blocksPerSecond ?? 0) - 5.6) < 0.05, 'a steady sprint reads as 5.6')
const jumped = steady.map((fix, i) => (i >= 6 ? { ...fix, x: fix.x + 3000 } : fix))
check(Math.abs((paceOf(jumped, jumped.at(-1)!.at)?.blocksPerSecond ?? 0) - 5.6) < 0.05, 'one teleport among the steps drops out (each step the median of three)')
check(paceOf(walk(0), 22_000) === null, 'standing still says no pace')
check(paceOf(walk(30, 0, 3), 4000) === null, 'two steps aren’t enough to say')
check(paceOf(walk(30), 10 * 60_000) === null, 'a pace two minutes old says nothing')
check(paceOf(walk(200), 22_000)?.blocksPerSecond === MOST_BLOCKS_PER_S, 'no one flies faster than 40: anything more is held to it')

// The real trace.
type Fixture = { banner: [number, number]; fixes: Fix[] }
const trace = JSON.parse(readFileSync(new URL('./fixtures/respawn-mano3543-2026-11-01.json', import.meta.url), 'utf8')) as Fixture
const at = (time: string) => Date.parse(`2026-11-01T${time}Z`)
const index = trace.fixes.findIndex((fix) => fix.health === 0)
check(index > 0 && diedBetween(trace.fixes[index], trace.fixes[index + 1]), 'the death: a reading at no health, then 6,871 blocks off at full')
check(!teleportedBetween(trace.fixes[index], trace.fixes[index + 1]), 'the respawn is no teleport')
let follow: Follow = { died: trace.fixes[index].at, last: trace.fixes[index + 1], teleport: null }
for (const fix of trace.fixes.slice(index + 2)) follow = followed(follow, fix)
const after = follow.teleport === null ? null : (follow.teleport - follow.died) / 1000
check(after !== null && after > 250 && after < 262, `followed: the first teleport after it came ${after} s on (logged: 258)`)
const flying = paceOf(trace.fixes, at('00:45:41'))
check(flying !== null && flying.blocksPerSecond > 25 && flying.blocksPerSecond < 35 && flying.moving, `flying back on an elytra: ${flying?.blocksPerSecond} blocks a second, five times a sprint`)

// The time back.
const banner = trace.banner
const far: [number, number] = [banner[0] + 6000, banner[1]]
const home: [number, number] = [banner[0] + 1200, banner[1]]
const now = at('00:40:00')
const locked = returnOf(far, banner, home, { now, pace: 30, diedAt: now - 60_000 })
check(locked.locked === TELEPORT_LOCK_SECONDS - 60, 'a minute after a death: two and a half minutes more before teleporting')
check(locked.pessimistic === Math.round(Math.min(6000, (TELEPORT_LOCK_SECONDS - 60) * SPRINT_BLOCKS_PER_S + 1200) / SPRINT_BLOCKS_PER_S), 'pessimistic, at a sprint: waiting out the lock and teleporting beats running 6,000 blocks')
check(locked.expected === Math.round(Math.min(6000 / 30, TELEPORT_LOCK_SECONDS - 60 + 1200 / 30)), 'at their own pace: flying straight there (200 s) or waiting and teleporting (190 s), whichever is sooner')
const free = returnOf(far, banner, home, { now, pace: 30 })
check(free.locked === 0 && free.via === 'spawn' && free.expected === 40, 'not locked: teleport home and fly 1,200 blocks, 40 s')
check(returnOf(far, banner, home, { now, pace: 3 }).expected === null, 'slower than a sprint: only the pessimistic figure')
check(returnOf([banner[0] + 100, banner[1]], banner, [banner[0] + 50, banner[1]], { now }).via === 'run', 'a spawn inside the siege zone is no use: nobody may teleport in')

check(lockOf([258, 212, 0, Number.NaN])?.quickest === 212 && lockOf([258, 212])?.seen === 2, 'the lock: the quickest teleport after a death')
check(lockOf([]) === null, 'none seen: no lock to say')
check(FOLLOW_MS === 15 * 60_000, 'a dead fighter is followed a quarter of an hour at most')

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
