import type { Abroad } from '@/maps/abroad'
import { spoken, townCentre, type MapTown } from '@/maps/data'
import { toLonLat, type LonLat } from '@/maps/globe'
import { GROUND, NO_NATION } from '@/maps/palette'
import { townOfPlayer, type LivePlayer } from '@/maps/players'
import type { SiegeOnMap } from '@/maps/sieges'
import { settlements } from '@/maps/sites'
import { isServerKind, serverLine } from '@/maps/trading'
import type { MapSelection } from '@/maps/url'

import { rgbOf } from './palette'

/**
 * The globe's marks, as the GPU draws them (./shaders.ts → POINTS_*): a
 * point apiece, each with its look written out in a few numbers. They are
 * the flat map's own far-out marks, small: a trading outpost a pip of the
 * lagoon as it is on the flat map at the scale of the world (TradingPip), a
 * landmark a whitewash dot rimmed in grey, a siege a disc of whitewash with
 * a coral heart (a battle on, the other way about), Azania's own sieges a
 * size up in a saffron ring; under them, Azania's towns as the soft saffron
 * discs the flat map glows them with far out (HomeGlow); over them, the
 * players online. Whatever is open on the map wears the saffron ring every
 * chosen thing does, and a siege with a battle on sends out a coral ring
 * that swells and fades, again and again, while it faces the reader.
 */

/** Marks as the GPU takes them: per mark, a spot, a size, a style and four colours. */
export type MarkBuffers = {
  count: number
  /** Longitude and latitude, in radians, and 1 for a battle, whose ring swells (three.js reads its points' positions in threes). */
  lonLat: Float32Array
  /** The body's width, in CSS pixels. */
  size: Float32Array
  /** Shape (0 a disc, 1 a rounded square), rim width, core width, and the ring's gap from the body. */
  style: Float32Array
  fill: Uint8Array
  rim: Uint8Array
  core: Uint8Array
  ring: Uint8Array
}

/** What a mark opens when it's clicked; players open nothing. */
export type MarkPick = { kind: 'siege'; townId: string } | { kind: 'abroad'; slug: string } | { kind: 'town'; slug: string }

/** A mark that can be clicked and hovered: where it is, how far its reach goes, what it opens, and what it is in words (its name and a line under it). */
export type MarkHit = { spot: LonLat; radius: number; pick: MarkPick; name: string; line: string }

/** A player's mark, which only says who it is when the pointer passes over. */
export type PlayerHit = { spot: LonLat; radius: number; name: string; line: string }

type Rgba = [number, number, number, number]

const rgba = (css: string, alpha = 1): Rgba => [...rgbOf(css), Math.round(alpha * 255)]
const NONE: Rgba = [0, 0, 0, 0]

const INK = {
  lagoon: rgba(GROUND.lagoon),
  whitewash: rgba(GROUND.whitewash),
  grey: rgba(NO_NATION.line),
  coral: rgba(GROUND.coral),
  coralDeep: rgba(GROUND.coralDeep),
  saffron: rgba(GROUND.saffron),
  glow: rgba(GROUND.saffronLight, 0.5),
  glowRim: rgba(GROUND.saffron, 0.6),
  sea: rgba(GROUND.sea800),
}

type Mark = {
  spot: LonLat
  battle?: boolean
  size: number
  shape: 0 | 1
  rim: number
  core: number
  gap: number
  fill: Rgba
  rimInk: Rgba
  coreInk: Rgba
  ringInk: Rgba
}

function pack(marks: Mark[]): MarkBuffers {
  const count = marks.length
  const buffers: MarkBuffers = {
    count,
    lonLat: new Float32Array(count * 3),
    size: new Float32Array(count),
    style: new Float32Array(count * 4),
    fill: new Uint8Array(count * 4),
    rim: new Uint8Array(count * 4),
    core: new Uint8Array(count * 4),
    ring: new Uint8Array(count * 4),
  }
  marks.forEach((mark, i) => {
    buffers.lonLat.set([mark.spot.lon, mark.spot.lat, mark.battle ? 1 : 0], i * 3)
    buffers.size[i] = mark.size
    buffers.style.set([mark.shape, mark.rim, mark.core, mark.gap], i * 4)
    buffers.fill.set(mark.fill, i * 4)
    buffers.rim.set(mark.rimInk, i * 4)
    buffers.core.set(mark.coreInk, i * 4)
    buffers.ring.set(mark.ringInk, i * 4)
  })
  return buffers
}

/** The ring that picks out what's open: 2 px of saffron, 3 px clear of the mark. */
const chosen = (mark: Mark, on: boolean): Mark => (on ? { ...mark, gap: 3, ringInk: INK.saffron } : mark)

/** The marks in their sets, what each answers to, and where the battles are (each with a ring that swells while it faces the reader). */
export type MarkSets = { base: MarkBuffers; sieges: MarkBuffers; hits: MarkHit[]; battles: LonLat[] }

/**
 * Every mark but the players': which show by the layers (the world's,
 * with the world; Azania's towns and its own sieges always), and which
 * is chosen by what's open.
 */
export function buildMarks({
  towns,
  world,
  sieges,
  selection,
  showWorld,
}: {
  towns: MapTown[]
  world: Abroad | null
  sieges: SiegeOnMap[]
  selection: MapSelection | null
  showWorld: boolean
}): MarkSets {
  const base: Mark[] = []
  const hits: MarkHit[] = []
  const picked = (kind: 'town' | 'abroad', slug: string) => selection?.kind === kind && selection.slug === slug

  // Azania's towns, glowing.
  for (const town of towns) {
    const centre = townCentre(town)
    if (!centre) continue
    const spot = toLonLat(centre)
    base.push(
      chosen(
        { spot, size: 13, shape: 0, rim: 1, core: 0, gap: 0, fill: INK.glow, rimInk: INK.glowRim, coreInk: NONE, ringInk: NONE },
        picked('town', town.slug),
      ),
    )
    hits.push({ spot, radius: 6.5, pick: { kind: 'town', slug: town.slug }, name: spoken(town.name), line: 'Azania' })
  }

  // The server's places, with the world.
  if (showWorld && world) {
    for (const town of world.towns) {
      if (!isServerKind(town.kind) || !town.home) continue
      const spot = toLonLat(town.home)
      const trading = town.kind === 'trading'
      base.push(
        chosen(
          trading
            ? { spot, size: 6, shape: 1, rim: 1, core: 0, gap: 0, fill: INK.lagoon, rimInk: INK.whitewash, coreInk: NONE, ringInk: NONE }
            : { spot, size: 6, shape: 0, rim: 1, core: 0, gap: 0, fill: INK.whitewash, rimInk: INK.grey, coreInk: NONE, ringInk: NONE },
          picked('abroad', town.slug),
        ),
      )
      // Under its name, what it is, as the search says it: an outpost no marker names, where it stands.
      hits.push({
        spot,
        radius: 3,
        pick: { kind: 'abroad', slug: town.slug },
        name: spoken(town.name),
        line: serverLine({ kind: town.kind, name: town.name, home: town.home }),
      })
    }
  }

  // The sieges: the world's with the world, Azania's always and on top.
  const siegeMarks: Mark[] = []
  const battles: LonLat[] = []
  const ordered = [...sieges].sort((a, b) => Number(Boolean(a.side)) - Number(Boolean(b.side)))
  for (const { siege, side } of ordered) {
    if (!side && !showWorld) continue
    const spot = toLonLat(siege.at)
    const scale = side ? 1.2 : 1
    const size = 9 * scale
    if (siege.battle) battles.push(spot)
    const look: Mark = siege.battle
      ? { spot, battle: true, size, shape: 0, rim: 1, core: 4 * scale, gap: 0, fill: INK.coralDeep, rimInk: INK.whitewash, coreInk: INK.whitewash, ringInk: NONE }
      : { spot, size, shape: 0, rim: 1, core: 5 * scale, gap: 0, fill: INK.whitewash, rimInk: INK.coralDeep, coreInk: INK.coral, ringInk: NONE }
    const own = towns.find((town) => town.townyId === siege.townId)
    const abroad = own ? null : world?.towns.find((town) => town.id === siege.townId)
    const open = own ? picked('town', own.slug) : abroad ? picked('abroad', abroad.slug) : false
    siegeMarks.push(
      open ? chosen(look, true) : side ? { ...look, gap: 2.5, ringInk: INK.saffron } : look,
    )
    hits.push({
      spot,
      radius: size / 2 + (side ? 3 : 0),
      pick: { kind: 'siege', townId: siege.townId },
      name: siege.town ? spoken(siege.town) : 'A siege',
      line: siege.battle ? 'Siege · a battle on' : 'Siege',
    })
  }

  return { base: pack(base), sieges: pack(siegeMarks), hits, battles }
}

/** The players under the pointer say who they are: their name, and that they're online now. */
export function playerHits(players: LivePlayer[]): PlayerHit[] {
  return players.map((player) => ({ spot: toLonLat([player.x, player.z]), radius: 2.5, name: player.name, line: 'Online now' }))
}

/** The players online, as small whitewash dots, Azania's own rimmed in saffron; they jump to where each reading has them. */
export function buildPlayers(players: LivePlayer[], towns: MapTown[]): MarkBuffers {
  const homes = settlements(towns)
  return pack(
    players.map((player) => ({
      spot: toLonLat([player.x, player.z]),
      size: 5,
      shape: 0,
      rim: 1.5,
      core: 0,
      gap: 0,
      fill: INK.whitewash,
      rimInk: townOfPlayer(player.name, homes) ? INK.saffron : INK.sea,
      coreInk: NONE,
      ringInk: NONE,
    })),
  )
}

/** No marks at all. */
export const NO_MARKS: MarkBuffers = pack([])
