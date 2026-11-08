import { sameNation } from '@/maps/abroad'
import type { Alliance } from '@/maps/alliances'
import { RULES } from '@/maps/battle'
import type { Point } from '@/maps/geo'
import type { FighterRecord } from '@/maps/fighters'
import type { LivePlayer, LivePlayers } from '@/maps/players'
import { CAPITAL_WAR_RADIUS, type Siege, type War, type World, type WorldTown } from '@/maps/world'


/**
 * A made-up battle for building and checking the war view on one's own
 * machine, when there's no battle on the server (there mostly isn't): with
 * MAPS_WAR_DEMO=1, /maps/war and /maps/war/live answer with a siege of a
 * real town by Azania, and /maps/players with its fighters, real residents
 * of either side, moving about the banner. Every hour on the clock is a
 * battle session that runs the same way: nobody holds the banner for ten
 * minutes, the attackers take it with three, the defenders take it back
 * at half past (the reversal bonus), and kills now and then, each a
 * fighter of the side that lost the points lying where they fell for a
 * moment, then back at their spawn at full health (a defender's is the
 * town's, inside the siege zone, as at Fort Alaskana; an attacker's is
 * far off, and they teleport back). A second
 * siege runs at the same time, of the defenders' ally's town by a nation
 * allied with Azania, so the two sieges share fighters both ways (one of
 * either side of the first stands in the second's zone); its attackers
 * take the banner after three minutes and keep it. Never on Vercel,
 * whatever the environment says, and never in the siege watch, which
 * reads the map itself: no alert is ever sent for it.
 */
export const warDemo = (): boolean => process.env.MAPS_WAR_DEMO === '1' && !process.env.VERCEL

type DemoSiege = Pick<Siege, 'townId' | 'town' | 'townNation' | 'attacker' | 'defender' | 'at'>

type Scene = {
  siege: DemoSiege
  attackers: { name: string; home: Point | null }[]
  defenders: { name: string; home: Point | null }[]
  /** Two of other nations: the first of the defenders' ally, the second of the nation besieging the ally's town. */
  others: string[]
  /** The nation of the first of the others, made the defenders' ally (demoAlliances). */
  allyNation: string | null
  /** The ally's town besieged by the second other's nation, Azania's ally by the diplomats; null when the world has no such pair. */
  second: DemoSiege | null
  capitals: War['capitals']
}

let scene: { world: World; value: Scene | null } | null = null

const distance = ([ax, az]: Point, [bx, bz]: Point) => Math.hypot(ax - bx, az - bz)

/** The battle's cast, chosen once per reading of the world: Azania against the nearest town of another nation it can reach. */
function sceneOf(world: World): Scene | null {
  const nations = world.nations.filter((nation) => nation.capital)
  const azania = nations.find((nation) => sameNation(nation.name, 'Azania')) ?? [...nations].sort((a, b) => b.residents - a.residents)[0]
  if (!azania?.capital) return null
  const capital = azania.capital.home
  const target = world.towns
    .filter((town): town is WorldTown & { home: Point; nation: string } =>
      Boolean(town.home && town.nation && !sameNation(town.nation, azania.name) && town.people.length >= 2 && town.kind === 'town'),
    )
    .filter((town) => distance(town.home, capital) <= CAPITAL_WAR_RADIUS)
    .sort((a, b) => distance(a.home, capital) - distance(b.home, capital))[0]
  if (!target) return null
  const peopleOf = (nation: string, first?: string) =>
    world.towns
      .filter((town) => sameNation(town.nation, nation))
      .sort((a, b) => Number(b.name === first) - Number(a.name === first))
      .flatMap((town) => town.people.map((name) => ({ name, home: town.home })))
  const attackers = peopleOf(azania.name).slice(0, 6)
  const defenders = peopleOf(target.nation, target.name).slice(0, 5)
  const taken = new Set([...attackers, ...defenders].map((person) => person.name))
  const outsiders = world.towns
    .filter((town) => town.nation && town.kind === 'town' && !sameNation(town.nation, azania.name) && !sameNation(town.nation, target.nation))
    .flatMap((town) => town.people.map((name) => ({ name, nation: town.nation!, town })))
    .filter((person) => !taken.has(person.name))
  // The ally: of a town with a home, so it can be besieged; the second of another nation, to besiege it.
  const ally = outsiders.find((person) => person.town.home) ?? outsiders[0] ?? null
  const foe = ally ? (outsiders.find((person) => !sameNation(person.nation, ally.nation)) ?? null) : null
  const others = [ally, foe].filter((person): person is NonNullable<typeof person> => person !== null).map((person) => person.name)
  const second: DemoSiege | null =
    ally?.town.home && foe
      ? {
          townId: ally.town.id ?? 'demo-second',
          town: ally.town.name,
          townNation: ally.nation,
          attacker: foe.nation,
          defender: ally.nation,
          at: [ally.town.home[0] - 40, ally.town.home[1] + 12],
        }
      : null
  return {
    siege: {
      townId: target.id ?? 'demo',
      town: target.name,
      townNation: target.nation,
      attacker: azania.name,
      defender: target.nation,
      // A little outside the town's home, in the wild, as a banner is placed.
      at: [target.home[0] + 48, target.home[1] + 8],
    },
    attackers,
    defenders,
    others,
    allyNation: ally?.nation ?? null,
    second,
    capitals: nations.map((nation) => ({ nation: nation.name, town: nation.capital!.town, home: nation.capital!.home })),
  }
}

async function currentScene(): Promise<Scene | null> {
  // The map's reading, or, while the map can't be read, the world as last saved: the demo runs either way.
  // The world as the map has it or, while the map can't be read, as last saved (./snapshot.ts), imported here
  // rather than at the top: the snapshot asks the demo for its war, and the demo is never loaded on Vercel.
  const { worldReading } = await import('./snapshot')
  const world = (await worldReading())?.value ?? null
  if (!world) return null
  if (scene?.world !== world) scene = { world, value: sceneOf(world) }
  return scene.value
}

const HOUR = 3_600_000
/** The session's script, in seconds from its start. */
const ATTACKERS_TAKE = 600
const DEFENDERS_RETAKE = 1800
const ATTACKER_HOLDERS = 3
const DEFENDER_HOLDERS = 2
const KILLS_BY_ATTACKERS = [700, 1300, 2100, 2700]
const KILLS_BY_DEFENDERS = [240, 900, 1500]
/** The second siege's script: its attackers take the banner after three minutes with two, and keep it. */
const SECOND_ATTACKERS_TAKE = 180
const SECOND_ATTACKER_HOLDERS = 2
const SECOND_KILLS_BY_DEFENDERS = [1500]

/** A death on the feed: no health where they fell for DEAD_FOR seconds, at their spawn at full for AT_SPAWN_FOR, then back by the end. */
const DEATH_SECONDS = 40
const DEAD_FOR = 4
const AT_SPAWN_FOR = 10

const ticksBetween = (from: number, to: number) => Math.max(0, Math.floor((to - from) / RULES.tickSeconds))
const signed = (points: number) => (points === 0 ? '0' : `+${points}`)

/** A siege as SiegeWar's marker would say it, from what the script says of the moment. */
function markerOf(
  base: DemoSiege,
  {
    attacker,
    defender,
    banner,
    left,
    progress,
    balance,
  }: { attacker: number; defender: number; banner: string; left: number; progress: { done: number; of: number }; balance: number },
): Siege {
  const timeLeft = `${(left / 60).toFixed(1)} minutes`
  const lines = [
    { label: 'Town', value: base.town ?? '' },
    { label: 'Type', value: 'Conquest' },
    { label: 'War Chest', value: '$2,500.00' },
    { label: 'Siege Progress', value: `${progress.done}/${progress.of}` },
    { label: 'Siege Status', value: 'In Progress' },
    { label: 'Siege Balance', value: String(balance) },
    { label: 'Banner Control', value: banner },
    { label: 'Battle Points', value: `${signed(attacker)} / ${signed(defender)}` },
    { label: 'Battle Time Left', value: timeLeft },
  ]
  return {
    ...base,
    battle: true,
    type: 'Conquest',
    status: 'In Progress',
    progress,
    balance,
    bannerControl: banner,
    battlePoints: { attacker: signed(attacker), defender: signed(defender) },
    battleTimeLeft: timeLeft,
    warChest: '$2,500.00',
    lines,
  }
}

/** The siege at `now`, as SiegeWar's marker would say it. */
function siegeAt(base: DemoSiege, now: number): Siege {
  const t = (now % HOUR) / 1000
  const left = RULES.sessionMinutes * 60 - t
  const attacker =
    ticksBetween(ATTACKERS_TAKE, Math.min(t, DEFENDERS_RETAKE)) * ATTACKER_HOLDERS * RULES.pointsPerHolder +
    KILLS_BY_ATTACKERS.filter((at) => at <= t).length * RULES.killPoints
  const defender =
    (t > DEFENDERS_RETAKE ? ticksBetween(DEFENDERS_RETAKE, t) * DEFENDER_HOLDERS * RULES.pointsPerHolder * RULES.reversalFactor : 0) +
    KILLS_BY_DEFENDERS.filter((at) => at <= t).length * RULES.killPoints
  const banner = t < ATTACKERS_TAKE ? 'Nobody' : t < DEFENDERS_RETAKE ? `Attackers (${ATTACKER_HOLDERS})` : `Defenders (${DEFENDER_HOLDERS})`
  return markerOf(base, { attacker, defender, banner, left, progress: { done: 1, of: 3 }, balance: 1250 })
}

/** The second siege at `now`: its last session, the defenders ahead going in, the attackers holding the banner from the third minute. */
function secondAt(base: DemoSiege, now: number): Siege {
  const t = (now % HOUR) / 1000
  const left = RULES.sessionMinutes * 60 - t
  const attacker = ticksBetween(SECOND_ATTACKERS_TAKE, t) * SECOND_ATTACKER_HOLDERS * RULES.pointsPerHolder
  const defender = SECOND_KILLS_BY_DEFENDERS.filter((at) => at <= t).length * RULES.killPoints
  const banner = t < SECOND_ATTACKERS_TAKE ? 'Nobody' : `Attackers (${SECOND_ATTACKER_HOLDERS})`
  return markerOf(base, { attacker, defender, banner, left, progress: { done: 2, of: 3 }, balance: -400 })
}

/** The demo's sieges at `now`: the battle, and the ally's town's beside it. */
const siegesAt = (cast: Scene, now: number): Siege[] => [siegeAt(cast.siege, now), ...(cast.second ? [secondAt(cast.second, now)] : [])]

/** The demo's war: its sieges, and the real nations' capitals. Null when the world can't be read. */
export async function demoWar(now: number): Promise<War | null> {
  const cast = await currentScene()
  if (!cast) return null
  return { at: now, sieges: siegesAt(cast, now), capitals: cast.capitals, radius: CAPITAL_WAR_RADIUS }
}

/** A point `radius` blocks from `centre` at `angle`. */
const around = ([x, z]: Point, radius: number, angle: number): Point => [x + Math.cos(angle) * radius, z + Math.sin(angle) * radius]

/**
 * The demo's fighters at `now`, circling the banner; one of each side on
 * the way back from their town. With a second siege on, one of each side
 * stands in its zone instead (the sieges share fighters), the ally among
 * the first's defenders, and the second's attacker at its banner. The
 * first of each side dies for the other side's kills (the script's times),
 * as a death looks on the feed.
 */
export async function demoPlayers(now: number): Promise<LivePlayers> {
  const cast = await currentScene()
  if (!cast) return { at: now, online: 0, players: [] }
  const t = now / 1000
  const session = (now % HOUR) / 1000
  const banner = cast.siege.at
  const players: LivePlayer[] = []
  const add = (name: string, [x, z]: Point, index: number, health?: number) =>
    players.push({
      name,
      x: Math.round(x),
      y: 70,
      z: Math.round(z),
      health: health ?? Math.max(1, 20 - ((Math.floor(t / 3) * 7 + index * 5) % 15)),
      armor: [20, 15, 12, 7, 0, 18][index % 6],
    })
  const second = cast.second?.at ?? null
  const place = (people: Scene['attackers'], phase: number, ring: number, killedAt: number[]) =>
    people.forEach((person, index) => {
      // The second of each side has gone to the other siege: in its zone, a little off its banner.
      if (index === 1 && second && people.length > 2) {
        add(person.name, around(second, 60 + ((index * 7) % 30), phase + t / 40), index)
        return
      }
      // The last of each side is on the way back from their town: a minute and a half's run, again and again.
      if (index === people.length - 1 && people.length > 1 && person.home) {
        const k = (t % 90) / 90
        const from = person.home
        const start = distance(from, banner) > 600 ? around(banner, 600, phase + index) : from
        add(person.name, [start[0] + (banner[0] - start[0]) * k, start[1] + (banner[1] - start[1]) * k], index)
        return
      }
      const radius = ring + ((index * 9) % 40)
      const spot = (at: number) => around(banner, radius, phase + index * 0.9 + at / (25 + index * 3))
      // The first of the side, killed at the script's times: lying where they fell at no health, then at their spawn at
      // full, then walking back when it's near (the town's, inside the zone) or teleporting back at the end when it's far.
      const killed = index === 0 ? killedAt.find((at) => session >= at && session < at + DEATH_SECONDS) : undefined
      if (killed !== undefined) {
        const since = session - killed
        const fell = spot(t - since)
        if (since < DEAD_FOR) return add(person.name, fell, index, 0)
        const spawn = person.home ?? fell
        const near = distance(spawn, banner) <= 300
        if (since < DEAD_FOR + AT_SPAWN_FOR || !near) return add(person.name, spawn, index, 20)
        const k = (since - DEAD_FOR - AT_SPAWN_FOR) / (DEATH_SECONDS - DEAD_FOR - AT_SPAWN_FOR)
        const back = spot(t)
        return add(person.name, [spawn[0] + (back[0] - spawn[0]) * k, spawn[1] + (back[1] - spawn[1]) * k], index, 20)
      }
      add(person.name, spot(t), index)
    })
  place(cast.attackers, 0, 6, KILLS_BY_DEFENDERS)
  place(cast.defenders, Math.PI, 10, KILLS_BY_ATTACKERS)
  cast.others.forEach((name, index) => {
    // The ally among the defenders, in the zone; the second siege's attacker at its own banner.
    if (index === 1 && second) add(name, around(second, 8, t / 30), index + 3)
    else add(name, around(banner, index === 0 ? 34 : 150, t / 60 + index), index + 3)
  })
  players.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  // The sieges as their markers were last rewritten, every fifteen seconds, as the real feed carries them (src/lib/livePlayers.ts).
  const markedAt = Math.floor(now / MARKER_EVERY_MS) * MARKER_EVERY_MS
  return { at: now, online: players.length + 4, players, sieges: siegesAt(cast, markedAt).map((siege) => ({ ...siege, markedAt })) }
}

/** How often SiegeWar rewrites a siege's marker, as seen in a battle. */
const MARKER_EVERY_MS = 15_000

/**
 * The demo's alliances, for /maps/fighters on one's own machine: the first
 * of the others' nation allied with the defenders, as the battles would
 * have shown it; the second siege's attacker allied with Azania, as the
 * diplomats would have told it. Made up.
 */
export async function demoAlliances(): Promise<Alliance[]> {
  const cast = await currentScene()
  if (!cast?.allyNation) return []
  const alliances: Alliance[] = [
    {
      nations: [cast.siege.defender, cast.allyNation],
      sources: ['seen'],
      seen: { battles: 2, last: new Date(Date.now() - 2 * 86_400_000).toISOString(), players: cast.others.slice(0, 1) },
    },
  ]
  if (cast.second) alliances.push({ nations: [cast.siege.attacker, cast.second.attacker], sources: ['told'], note: 'Made up for the war demo: a pact the diplomats told of.' })
  return alliances
}

/**
 * The demo's fighters' records, for /maps/fighters on one's own machine:
 * the cast with made-up but plausible histories (some keen, some who never
 * come, one who dies a lot), and usual hours peaking in the evening.
 */
export async function demoFighters(now: number): Promise<(FighterRecord & { hours: number[] })[]> {
  const cast = await currentScene()
  if (!cast) return []
  const people = [
    ...cast.attackers.map((person) => ({ name: person.name, side: 'attackers' as const })),
    ...cast.defenders.map((person) => ({ name: person.name, side: 'defenders' as const })),
    ...cast.others.map((name) => ({ name, side: 'other' as const })),
  ]
  return people.map(({ name, side }, index) => {
    const seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) + index * 7
    const could = 4 + (seed % 9)
    const fought = index % 5 === 4 ? 0 : Math.min(could, 1 + (seed % (could + 1)))
    const stays = fought * (1 + (seed % 3))
    const held = Math.round(stays * ((seed % 7) / 7))
    const died = Math.round((stays - held) * (index === 2 ? 0.9 : 0.5))
    const left = Math.max(0, stays - held - died - (seed % 2))
    const peak = 18 + (seed % 5)
    const hours = Array.from({ length: 168 }, (_, hour) => {
      const ofDay = hour % 24
      const near = Math.min(Math.abs(ofDay - peak), 24 - Math.abs(ofDay - peak))
      return Math.max(0, Math.round((0.9 - near * 0.15 + (hour >= 120 ? 0.1 : 0)) * 100) / 100)
    })
    return {
      name,
      could,
      fought,
      battles: fought + (fought && seed % 2 ? 1 : 0),
      // Those who live with neither side have fought for allies, as the demo's allies do.
      allied: side === 'other' ? fought : 0,
      minutes: fought * (20 + (seed % 35)),
      bannerMinutes: fought * (seed % 12),
      stays,
      held,
      died,
      left,
      cut: Math.max(0, stays - held - died - left),
      deaths: died + (seed % 3),
      confirmed: died,
      won: Math.round(fought * 0.6),
      lost: fought - Math.round(fought * 0.6),
      side: fought ? side : null,
      lastFought: fought ? new Date(now - (seed % 6) * 86_400_000).toISOString() : null,
      hours,
    }
  })
}

/**
 * The demo siege's sessions already fought, for /maps/battles on one's own
 * machine: the one before this hour's, run by the same script (the
 * attackers take the banner, the defenders take it back at half past), a
 * point a minute.
 */
export async function demoBattles(now: number) {
  const cast = await currentScene()
  if (!cast) return []
  const thisHour = Math.floor(now / HOUR) * HOUR
  // As many as the demo's marker says were fought before this one (1 of 3).
  return [1].map((ago, index) => {
    const start = thisHour - ago * 6 * HOUR
    // To the session's last second: the script starts again on the hour.
    const points = Array.from({ length: 61 }, (_, minute): [number, number, number, string] => {
      const siege = siegeAt(cast.siege, start + Math.min(minute * 60_000, HOUR - 1000))
      const read = (value: string | undefined) => Math.abs(Number.parseInt((value ?? '0').replace(/[^\d-]/g, ''), 10)) || 0
      const banner = siege.bannerControl?.startsWith('Attackers') ? 'a' : siege.bannerControl?.startsWith('Defenders') ? 'd' : ''
      return [minute, read(siege.battlePoints?.attacker), read(siege.battlePoints?.defender), banner]
    })
    const [, attacker, defender] = points[points.length - 1]
    return {
      townId: cast.siege.townId,
      town: cast.siege.town,
      attacker: cast.siege.attacker,
      defender: cast.siege.defender,
      startedAt: new Date(start).toISOString(),
      session: index,
      coverage: 1,
      fought: 9,
      result: { banner: 'defenders', holders: DEFENDER_HOLDERS, attacker, defender },
      points,
    }
  })
}
