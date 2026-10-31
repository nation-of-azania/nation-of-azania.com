import { sameNation } from '@/maps/abroad'
import { RULES } from '@/maps/battle'
import type { Point } from '@/maps/geo'
import type { LivePlayer, LivePlayers } from '@/maps/players'
import { CAPITAL_WAR_RADIUS, type Siege, type War, type World, type WorldTown } from '@/maps/world'

import { getWorld } from './world'

/**
 * A made-up battle for building and checking the war view on one's own
 * machine, when there's no battle on the server (there mostly isn't): with
 * MAPS_WAR_DEMO=1, /maps/war and /maps/war/live answer with a siege of a
 * real town by Azania, and /maps/players with its fighters, real residents
 * of either side, moving about the banner. Every hour on the clock is a
 * battle session that runs the same way: nobody holds the banner for ten
 * minutes, the attackers take it with three, the defenders take it back
 * at half past (the reversal bonus), and kills now and then. Never on
 * Vercel, whatever the environment says, and never in the siege watch,
 * which reads the map itself: no alert is ever sent for it.
 */
export const warDemo = (): boolean => process.env.MAPS_WAR_DEMO === '1' && !process.env.VERCEL

type Scene = {
  siege: Pick<Siege, 'townId' | 'town' | 'townNation' | 'attacker' | 'defender' | 'at'>
  attackers: { name: string; home: Point | null }[]
  defenders: { name: string; home: Point | null }[]
  others: string[]
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
  const others = world.towns
    .filter((town) => town.nation && !sameNation(town.nation, azania.name) && !sameNation(town.nation, target.nation))
    .flatMap((town) => town.people)
    .filter((name) => !taken.has(name))
    .slice(0, 2)
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
    capitals: nations.map((nation) => ({ nation: nation.name, town: nation.capital!.town, home: nation.capital!.home })),
  }
}

async function currentScene(): Promise<Scene | null> {
  const world = await getWorld()
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

const ticksBetween = (from: number, to: number) => Math.max(0, Math.floor((to - from) / RULES.tickSeconds))
const signed = (points: number) => (points === 0 ? '0' : `+${points}`)

/** The siege at `now`, as SiegeWar's marker would say it. */
function siegeAt(base: Scene['siege'], now: number): Siege {
  const t = (now % HOUR) / 1000
  const left = RULES.sessionMinutes * 60 - t
  const attacker =
    ticksBetween(ATTACKERS_TAKE, Math.min(t, DEFENDERS_RETAKE)) * ATTACKER_HOLDERS * RULES.pointsPerHolder +
    KILLS_BY_ATTACKERS.filter((at) => at <= t).length * RULES.killPoints
  const defender =
    (t > DEFENDERS_RETAKE ? ticksBetween(DEFENDERS_RETAKE, t) * DEFENDER_HOLDERS * RULES.pointsPerHolder * RULES.reversalFactor : 0) +
    KILLS_BY_DEFENDERS.filter((at) => at <= t).length * RULES.killPoints
  const banner = t < ATTACKERS_TAKE ? 'Nobody' : t < DEFENDERS_RETAKE ? `Attackers (${ATTACKER_HOLDERS})` : `Defenders (${DEFENDER_HOLDERS})`
  const timeLeft = `${(left / 60).toFixed(1)} minutes`
  const lines = [
    { label: 'Town', value: base.town ?? '' },
    { label: 'Type', value: 'Conquest' },
    { label: 'War Chest', value: '$2,500.00' },
    { label: 'Siege Progress', value: '1/3' },
    { label: 'Siege Status', value: 'In Progress' },
    { label: 'Siege Balance', value: '1250' },
    { label: 'Banner Control', value: banner },
    { label: 'Battle Points', value: `${signed(attacker)} / ${signed(defender)}` },
    { label: 'Battle Time Left', value: timeLeft },
  ]
  return {
    ...base,
    battle: true,
    type: 'Conquest',
    status: 'In Progress',
    progress: { done: 1, of: 3 },
    balance: 1250,
    bannerControl: banner,
    battlePoints: { attacker: signed(attacker), defender: signed(defender) },
    battleTimeLeft: timeLeft,
    warChest: '$2,500.00',
    lines,
  }
}

/** The demo's war: its siege, and the real nations' capitals. Null when the world can't be read. */
export async function demoWar(now: number): Promise<War | null> {
  const cast = await currentScene()
  if (!cast) return null
  return { at: now, sieges: [siegeAt(cast.siege, now)], capitals: cast.capitals, radius: CAPITAL_WAR_RADIUS }
}

/** A point `radius` blocks from `centre` at `angle`. */
const around = ([x, z]: Point, radius: number, angle: number): Point => [x + Math.cos(angle) * radius, z + Math.sin(angle) * radius]

/** The demo's fighters at `now`, circling the banner; one of each side on the way back from their town. */
export async function demoPlayers(now: number): Promise<LivePlayers> {
  const cast = await currentScene()
  if (!cast) return { at: now, online: 0, players: [] }
  const t = now / 1000
  const banner = cast.siege.at
  const players: LivePlayer[] = []
  const add = (name: string, [x, z]: Point, index: number) =>
    players.push({
      name,
      x: Math.round(x),
      y: 70,
      z: Math.round(z),
      health: Math.max(1, 20 - ((Math.floor(t / 3) * 7 + index * 5) % 15)),
      armor: [20, 15, 12, 7, 0, 18][index % 6],
    })
  const place = (people: Scene['attackers'], phase: number, ring: number) =>
    people.forEach((person, index) => {
      // The last of each side is on the way back from their town: a minute and a half's run, again and again.
      if (index === people.length - 1 && people.length > 1 && person.home) {
        const k = (t % 90) / 90
        const from = person.home
        const start = distance(from, banner) > 600 ? around(banner, 600, phase + index) : from
        add(person.name, [start[0] + (banner[0] - start[0]) * k, start[1] + (banner[1] - start[1]) * k], index)
        return
      }
      const radius = ring + ((index * 9) % 40)
      add(person.name, around(banner, radius, phase + index * 0.9 + t / (25 + index * 3)), index)
    })
  place(cast.attackers, 0, 6)
  place(cast.defenders, Math.PI, 10)
  cast.others.forEach((name, index) => add(name, around(banner, 150 + index * 60, t / 60 + index), index + 3))
  players.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  return { at: now, online: players.length + 4, players }
}
