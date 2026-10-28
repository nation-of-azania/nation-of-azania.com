/**
 * The siege alerts (src/lib/siegeWatch.ts), checked without Discord or the
 * Rulercraft map: each thing told once — a siege laid against Azania, a
 * battle at it once a session, its end once its mark has been gone two
 * readings minutes apart — nothing told on the first run of all or while
 * the alerts are off, what Discord didn't take tried again for an hour,
 * and who's pinged. The sieges are read from markers as SiegeWar writes
 * them (its DynmapIntegration), so the reading is checked too.
 *
 *   pnpm test:sieges
 */
import { roleId } from '../src/lib/siegeAlerts'
import {
  alertMessage,
  ENDED_AFTER_MS,
  planSieges,
  TELL_WITHIN_MS,
  untold,
  watchFrom,
  whenLines,
  type SiegeAlert,
  type SiegeWatch,
} from '../src/lib/siegeWatch'
import { siegeOf } from '../src/lib/world'
import { isTimeZone, nearestEnd, nextSessions, scheduleOf, sessionTimes, timeLeftMs } from '../src/maps/sessions'
import type { HomeSide } from '../src/maps/sieges'
import type { Siege } from '../src/maps/world'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}

const home: HomeSide = {
  nation: 'Azania',
  towns: [
    { name: 'Cape_Town', townyId: 'id-cape' },
    { name: 'Durban', townyId: 'id-durban' },
    { name: 'Pretoria', townyId: 'id-pretoria' },
  ],
}
const towns = new Map([
  ['id-cape', { name: 'Cape_Town', nation: 'Azania' }],
  ['id-durban', { name: 'Durban', nation: 'Azania' }],
  ['id-pretoria', { name: 'Pretoria', nation: 'Azania' }],
  ['id-oslo', { name: 'Oslo', nation: 'Norway' }],
  ['id-lima', { name: 'Lima', nation: 'Peru' }],
])

/** A siege as SiegeWar marks it on the map. */
function siege(
  townId: string,
  attacker: string,
  defender: string,
  { battle = false, done = 2, town = towns.get(townId)?.name ?? 'Somewhere' }: { battle?: boolean; done?: number; town?: string } = {},
): Siege {
  const name = `Siege: ${attacker} vs ${defender}`
  const lines = [
    `Town: ${town}`,
    'Type: Conquest',
    'War Chest: $2,500.00',
    `Siege Progress: ${done}/7`,
    'Siege Status: In Progress',
    'Siege Balance: -40',
    `Banner Control: ${battle ? 'Attackers (3)' : 'Nobody'}`,
    `Battle Points: ${battle ? '+260' : '0'} / ${battle ? '+100' : '0'}`,
    'Battle Time Left: 12:30',
  ]
  const read = siegeOf(townId, { label: name, desc: `<b>${name}</b><hr>${lines.join('<br>')}`, icon: battle ? 'siegewar.battle' : 'fire', x: 1200.5, z: -340.2 }, towns)
  if (!read) throw new Error('siegeOf read nothing')
  return read
}

const on = { enabled: true, webhookUrl: 'https://discord.com/api/webhooks/1/abc', role: '123456789012345678', battles: true, ended: true, laidByAzania: false }
const t0 = Date.parse('2026-10-28T12:00:00Z')
const at = (minutes: number) => new Date(t0 + minutes * 60_000)
const kinds = (alerts: SiegeAlert[]) => alerts.map((alert) => `${alert.kind}:${alert.siege.townId}`).join(' ') || 'none'

// The reading of SiegeWar's marker.
{
  const read = siege('id-cape', 'Balkan_Kingdom', 'Azania', { battle: true, done: 3 })
  check(
    read.town === 'Cape_Town' && read.attacker === 'Balkan_Kingdom' && read.defender === 'Azania' && read.battle,
    'a marker reads as its town, sides and battle',
  )
  check(read.progress?.done === 3 && read.progress.of === 7 && read.balance === -40 && read.at[0] === 1201, 'with its progress, balance and banner')
}

// The first run of all learns what's there, and tells nothing.
let watch: SiegeWatch
{
  const plan = planSieges(null, [siege('id-cape', 'Balkan_Kingdom', 'Azania', { battle: true })], home, on, at(0))
  check(plan.alerts.length === 0, `the first run tells nothing (${kinds(plan.alerts)})`)
  check(plan.watch.sieges.length === 1 && plan.watch.sieges[0].told && plan.watch.sieges[0].battles.includes(2), 'and records the siege as told, its battle too')
  watch = plan.watch
}

// A siege laid against Azania: told once.
{
  const sieges = [siege('id-cape', 'Balkan_Kingdom', 'Azania'), siege('id-durban', 'Norway', 'Azania')]
  const plan = planSieges(watch, sieges, home, on, at(5))
  check(kinds(plan.alerts) === 'laid:id-durban', `a new siege against Azania is told (${kinds(plan.alerts)})`)
  const again = planSieges(plan.watch, sieges, home, on, at(10))
  check(again.alerts.length === 0, `and only once (${kinds(again.alerts)})`)
  watch = again.watch
}

// A battle: told once a battle session.
{
  const battle = [siege('id-cape', 'Balkan_Kingdom', 'Azania'), siege('id-durban', 'Norway', 'Azania', { battle: true })]
  const plan = planSieges(watch, battle, home, on, at(15))
  check(kinds(plan.alerts) === 'battle:id-durban', `a battle begun is told (${kinds(plan.alerts)})`)
  const still = planSieges(plan.watch, battle, home, on, at(20))
  check(still.alerts.length === 0, 'and not again while it goes on')
  const quiet = planSieges(still.watch, [siege('id-cape', 'Balkan_Kingdom', 'Azania'), siege('id-durban', 'Norway', 'Azania')], home, on, at(60))
  const fire = planSieges(quiet.watch, [siege('id-cape', 'Balkan_Kingdom', 'Azania'), siege('id-durban', 'Norway', 'Azania', { battle: true })], home, on, at(65))
  check(fire.alerts.length === 0, 'nor when the same session flares again after a quiet spell')
  const next = planSieges(fire.watch, [siege('id-cape', 'Balkan_Kingdom', 'Azania'), siege('id-durban', 'Norway', 'Azania', { battle: true, done: 3 })], home, on, at(180))
  check(kinds(next.alerts) === 'battle:id-durban', `the next session's battle is told (${kinds(next.alerts)})`)
  const off = planSieges(fire.watch, [siege('id-cape', 'Balkan_Kingdom', 'Azania'), siege('id-durban', 'Norway', 'Azania', { battle: true, done: 3 })], home, { ...on, battles: false }, at(180))
  check(off.alerts.length === 0, 'unless battles are switched off')
  watch = next.watch
}

// Laid in the middle of a battle: one alert, which says so.
{
  const plan = planSieges(watch, [...watch.sieges.map((entry) => entry.last), siege('id-lima', 'Azania', 'Peru', { battle: true })], home, { ...on, laidByAzania: true }, at(185))
  check(kinds(plan.alerts) === 'laid:id-lima', `a siege laid mid-battle is told once, not twice (${kinds(plan.alerts)})`)
}

// The end: its mark gone in two readings minutes apart.
{
  const left = [siege('id-cape', 'Balkan_Kingdom', 'Azania')]
  const gone = planSieges(watch, left, home, on, at(190))
  check(gone.alerts.length === 0 && gone.watch.sieges.some((entry) => entry.townId === 'id-durban' && entry.missing), 'gone once ends nothing yet')
  const back = planSieges(gone.watch, [...left, siege('id-durban', 'Norway', 'Azania', { done: 3 })], home, on, at(195))
  check(back.alerts.length === 0 && back.watch.sieges.every((entry) => !entry.missing), 'back again (the map restarting) is the same siege, told nothing')
  const soon = planSieges(gone.watch, left, home, on, at(191))
  check(soon.alerts.length === 0, 'gone again a minute later is not yet an end')
  const ended = planSieges(gone.watch, left, home, on, new Date(at(190).getTime() + ENDED_AFTER_MS))
  check(kinds(ended.alerts) === 'ended:id-durban', `gone in readings minutes apart, it has ended (${kinds(ended.alerts)})`)
  check(!ended.watch.sieges.some((entry) => entry.townId === 'id-durban'), 'and leaves the record')
  const quiet = planSieges(gone.watch, left, home, { ...on, ended: false }, at(200))
  check(quiet.alerts.length === 0 && !quiet.watch.sieges.some((entry) => entry.townId === 'id-durban'), 'unless endings are switched off: then it just leaves')

  // Discord didn't take it: tried again next time.
  const ending = ended.alerts[0]
  const retry = planSieges(untold(ended.watch, ending), left, home, on, at(205))
  check(kinds(retry.alerts) === 'ended:id-durban', `an end Discord didn't take is told again (${kinds(retry.alerts)})`)
  const late = planSieges(untold(ended.watch, ending), left, home, on, new Date(at(190).getTime() + TELL_WITHIN_MS + 60_000))
  check(late.alerts.length === 0, 'but not after an hour')
}

// Discord didn't take a new siege: tried again, for an hour.
{
  const plan = planSieges(watch, [...watch.sieges.map((entry) => entry.last), siege('id-oslo', 'Azania', 'Norway')], home, { ...on, laidByAzania: true }, at(300))
  const laid = plan.alerts.find((alert) => alert.kind === 'laid')!
  const retry = planSieges(untold(plan.watch, laid), plan.watch.sieges.map((entry) => entry.last), home, { ...on, laidByAzania: true }, at(305))
  check(kinds(retry.alerts) === 'laid:id-oslo', `a siege Discord didn't take is told again (${kinds(retry.alerts)})`)
  const late = planSieges(untold(plan.watch, laid), plan.watch.sieges.map((entry) => entry.last), home, { ...on, laidByAzania: true }, at(300 + 61))
  check(late.alerts.length === 0 && late.watch.sieges.every((entry) => entry.told), 'but not after an hour')
}

// Whose sieges are told.
{
  const others = [siege('id-oslo', 'Peru', 'Norway'), siege('id-lima', 'Azania', 'Peru')]
  const plan = planSieges(watch, [...watch.sieges.map((entry) => entry.last), ...others], home, on, at(400))
  check(plan.alerts.length === 0, `neither other nations' sieges nor Azania's own, unless asked (${kinds(plan.alerts)})`)
  const ours = planSieges(watch, [...watch.sieges.map((entry) => entry.last), ...others], home, { ...on, laidByAzania: true }, at(400))
  check(kinds(ours.alerts) === 'laid:id-lima', `Azania's own when asked (${kinds(ours.alerts)})`)
}

// While the alerts are off, sieges are recorded and not told, then or later.
{
  const off = { ...on, webhookUrl: '' }
  const plan = planSieges(watch, [...watch.sieges.map((entry) => entry.last), siege('id-pretoria', 'Norway', 'Azania')], home, off, at(500))
  check(plan.alerts.length === 0 && plan.watch.sieges.some((entry) => entry.townId === 'id-pretoria' && entry.told), 'no webhook: recorded, not told')
  const later = planSieges(plan.watch, plan.watch.sieges.map((entry) => entry.last), home, on, at(505))
  check(later.alerts.length === 0, `and not told as new once a webhook is set (${kinds(later.alerts)})`)
  const paused = planSieges(watch, [...watch.sieges.map((entry) => entry.last), siege('id-pretoria', 'Norway', 'Azania')], home, { ...on, enabled: false }, at(500))
  check(paused.alerts.length === 0, 'switched off: the same')
}

// Another attacker at the same town: a new siege, and the last one ended.
{
  const plan = planSieges(watch, [siege('id-cape', 'Norway', 'Azania'), siege('id-durban', 'Norway', 'Azania', { done: 3 })], home, on, at(600))
  check(kinds(plan.alerts) === 'laid:id-cape', `a new attacker at a town is a new siege (${kinds(plan.alerts)})`)
  const after = planSieges(plan.watch, [siege('id-cape', 'Norway', 'Azania'), siege('id-durban', 'Norway', 'Azania', { done: 3 })], home, on, at(605))
  check(kinds(after.alerts) === 'ended:id-cape', `and the last one there has ended (${kinds(after.alerts)})`)
  const retry = planSieges(untold(after.watch, after.alerts[0]), after.watch.sieges.map((entry) => entry.last), home, on, at(610))
  check(kinds(retry.alerts) === 'ended:id-cape', `its end tried again tells only the end, not the new siege anew (${kinds(retry.alerts)})`)
}

// One mark a town: a reading naming a town twice is read once.
{
  const plan = planSieges(watch, [...watch.sieges.map((entry) => entry.last), siege('id-pretoria', 'Norway', 'Azania'), siege('id-pretoria', 'Norway', 'Azania')], home, on, at(700))
  check(kinds(plan.alerts) === 'laid:id-pretoria' && plan.watch.sieges.filter((entry) => entry.townId === 'id-pretoria').length === 1, 'a town named twice is one siege')
}

// The message: the line, the ping, the link.
{
  const href = 'https://example.test/maps/town/cape-town?siege=id-cape'
  const laid = alertMessage({ kind: 'laid', siege: siege('id-cape', 'Balkan_Kingdom', 'Azania'), side: 'defending' }, href, on, at(0))
  check(laid.content === '<@&123456789012345678> **Cape Town is under siege**', `a siege against Azania pings the role (${laid.content})`)
  check(JSON.stringify(laid.allowed_mentions) === '{"parse":[],"roles":["123456789012345678"]}', 'and only that role')
  check(laid.embeds[0].url === href && laid.embeds[0].description.includes(href), 'and links to the siege on Azania Maps')
  check(laid.embeds[0].title === 'Siege: Balkan Kingdom vs Azania', `titled as SiegeWar does (${laid.embeds[0].title})`)
  check(laid.embeds[0].fields.some((field) => field.name === 'Banner at' && field.value === 'X 1201 · Z -340'), 'with where the banner stands')
  const ours = alertMessage({ kind: 'laid', siege: siege('id-lima', 'Azania', 'Peru'), side: 'attacking' }, href, on, at(0))
  check(ours.content === '**Azania is besieging Lima**' && JSON.stringify(ours.allowed_mentions) === '{"parse":[]}', `Azania's own siege pings nobody (${ours.content})`)
  const end = alertMessage(
    { kind: 'ended', siege: siege('id-cape', 'Balkan_Kingdom', 'Azania'), side: 'defending', lastSeen: at(0).toISOString(), entry: watch.sieges[0] },
    href,
    on,
    at(10),
  )
  check(end.content === '**The siege of Cape Town has ended**' && !end.content.includes('<@&'), `an end pings nobody (${end.content})`)
  const battle = alertMessage({ kind: 'battle', siege: siege('id-cape', 'Balkan_Kingdom', 'Azania', { battle: true }), side: 'defending', session: 2 }, href, on, at(0))
  check(battle.content.startsWith('<@&') && battle.embeds[0].description.startsWith('Fighting at the banner, in battle session 3 of 7'), 'a battle pings, and says its session')
  const none = alertMessage({ kind: 'laid', siege: siege('id-cape', 'Balkan_Kingdom', 'Azania'), side: 'defending' }, href, { ...on, role: null }, at(0))
  check(none.content === '**Cape Town is under siege**', 'no role, no ping')
}

// When battle sessions are: Rulercraft's 13:00, 19:00 and 01:00, Central European time.
{
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 16)
  const schedule = scheduleOf('13:00, 19:00, 01:00', 'Europe/Berlin')!
  check(JSON.stringify(sessionTimes('13:00, 19:00, 01:00')) === '[60,780,1140]' && sessionTimes('13:00, soon') === null, 'session times read as times of day, and nothing else')
  check(isTimeZone('Europe/Berlin') && isTimeZone('UTC') && !isTimeZone('Mars/Olympus') && !isTimeZone(''), 'time zones by their tz names')
  const winter = nextSessions(Date.parse('2026-10-28T10:00:00Z'), schedule, 3).map(iso).join(' ')
  check(winter === '2026-10-28T12:00 2026-10-28T18:00 2026-10-29T00:00', `in winter: 12:00, 18:00 and 00:00 UTC, as the rules' timestamps (${winter})`)
  const summer = nextSessions(Date.parse('2026-07-01T10:00:00Z'), schedule, 3).map(iso).join(' ')
  check(summer === '2026-07-01T11:00 2026-07-01T17:00 2026-07-01T23:00', `in summer an hour earlier in UTC (${summer})`)
  const change = nextSessions(Date.parse('2026-10-24T20:00:00Z'), schedule, 3).map(iso).join(' ')
  check(change === '2026-10-24T23:00 2026-10-25T12:00 2026-10-25T18:00', `across the night the clocks go back (${change})`)
  check(timeLeftMs('45.5 minutes') === 2_730_000 && timeLeftMs('45m 12s') === 2_712_000 && timeLeftMs('12:30') === 750_000 && timeLeftMs('1 hour') === 3_600_000, 'the time a session has left, as Towny may say it')
  check(timeLeftMs('N/A') === null && timeLeftMs('') === null && timeLeftMs(null) === null, 'and none between sessions')
  const near = nearestEnd(Date.parse('2026-10-28T13:00:00Z'), schedule)
  check(iso(near.start) === '2026-10-28T12:00' && near.off === 0, 'a session seen ending at 13:00 UTC is the 13:00 Berlin one')
  const far = nearestEnd(Date.parse('2026-10-28T14:00:00Z'), schedule)
  check(far.off === 3_600_000, 'one ending at 14:00 UTC is an hour off the times set')

  const stampAt = (ms: number) => Math.round(ms / 1000)
  const now = new Date('2026-10-28T10:00:00Z')
  const fresh = { ...siege('id-cape', 'Balkan_Kingdom', 'Azania', { done: 0 }), progress: { done: 0, of: 3 }, battleTimeLeft: 'N/A' }
  const before = whenLines(fresh, schedule, now)
  check(
    before[0] === `**Next battle session:** <t:${stampAt(Date.parse('2026-10-28T12:00:00Z'))}:F> (<t:${stampAt(Date.parse('2026-10-28T12:00:00Z'))}:R>)` &&
      before[1] === `Then <t:${stampAt(Date.parse('2026-10-28T18:00:00Z'))}:f> · <t:${stampAt(Date.parse('2026-10-29T00:00:00Z'))}:f>`,
    `a siege laid between sessions says its three, as Discord timestamps (${before.join(' / ')})`,
  )
  const during = whenLines({ ...fresh, battleTimeLeft: '45 minutes' }, schedule, new Date('2026-10-28T12:15:00Z'))
  check(
    during[0] === `**Battle session on now**, until <t:${stampAt(Date.parse('2026-10-28T13:00:00Z'))}:t> (<t:${stampAt(Date.parse('2026-10-28T13:00:00Z'))}:R>)` &&
      during[1] === `Next <t:${stampAt(Date.parse('2026-10-28T18:00:00Z'))}:f> · <t:${stampAt(Date.parse('2026-10-29T00:00:00Z'))}:f>`,
    `one laid in a session's first minutes says it's on now, until when, and the two after (${during.join(' / ')})`,
  )
  const last = whenLines({ ...fresh, progress: { done: 2, of: 3 }, battleTimeLeft: '30 minutes' }, schedule, new Date('2026-10-28T12:30:00Z'))
  check(last.length === 1, 'in its last session, nothing after')
  check(whenLines(fresh, null, now).length === 0, 'with no times set, nothing to come')
  const laid = alertMessage({ kind: 'laid', siege: fresh, side: 'defending' }, 'https://example.test/maps', { ...on, sessionTimes: '13:00, 19:00, 01:00', sessionZone: 'Europe/Berlin' }, now)
  check(laid.embeds[0].description.includes('**Next battle session:** <t:'), 'and the alert says when to fight')
}

// The settings.
{
  check(roleId('123456789012345678') === '123456789012345678' && roleId('<@&123456789012345678>') === '123456789012345678', 'a role is its ID, pasted bare or as a mention')
  check(roleId('Defenders') === null && roleId('12345') === null, 'and nothing else')
  check(watchFrom({ claimedAt: '2026-10-28T12:00:00Z' }) === null, 'a record only claimed, never written, is still the first run')
}

if (failed) {
  console.error('\nSome siege alert checks failed.')
  process.exit(1)
}
console.log('\nAll siege alert checks passed.')
