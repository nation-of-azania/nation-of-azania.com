/**
 * A town's claims told apart (src/maps/claims.ts), checked without a
 * browser: the town itself and what lies within reach of it, its outposts
 * and what lies within reach of them, and what's detached; the outposts
 * read off the Rulercraft map's markers; the nations named about their
 * towns alone, however far an outpost lies.
 *
 *   pnpm test:claims
 */
import { readFileSync } from 'node:fs'

import { worldOf } from '../src/lib/world'
import type { MarkerFile } from '../src/lib/dynmap'
import { abroadOf } from '../src/maps/abroad'
import { CLAIM_REACH, claimParts, mainBounds, partAt, partFocus, type OutpostSpawn } from '../src/maps/claims'
import { mapTown, townFit } from '../src/maps/data'
import type { Outline, Point } from '../src/maps/geo'
import { packWorld, unpackWorld } from '../src/maps/world'
import type { Town } from '../src/payload-types'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}

/** A claim of whole chunks, from chunk (cx, cz), w × h chunks. */
const chunks = (cx: number, cz: number, w = 1, h = 1): Outline => {
  const [x0, z0, x1, z1] = [cx * 16, cz * 16, (cx + w) * 16, (cz + h) * 16]
  return { x: [x0, x1, x1, x0], z: [z0, z0, z1, z1] }
}
const spawn = (at: Point, name: string | null = null): OutpostSpawn => ({ at, name })
const roles = (parts: ReturnType<typeof claimParts>) => parts.map((part) => `${part.role}:${part.claims.join('+')}`).join(' ')

// A town in one piece.
{
  const parts = claimParts([chunks(0, 0, 4, 4)], [20, 20], [])
  check(roles(parts) === 'main:0' && parts[0].chunks === 16, `one claim is the town itself (${roles(parts)})`)
  check(parts[0].centre[0] === 20 && parts[0].spawns.length === 0, 'centred on its home, with no outposts')
}

// Islands off its shore, and islands off those, belong to the town; a claim further than reach doesn't.
{
  const claims = [chunks(0, 0, 4, 4), chunks(10, 0), chunks(40, 0), chunks(4 + 32 + 5, 40)]
  const parts = claimParts(claims, [8, 8], [])
  check(roles(parts) === 'main:0+1+2 detached:3', `islands within reach, and chained, are the town's (${roles(parts)})`)
  check(mainBounds(parts)?.maxX === 41 * 16, 'and the town itself spans them')
}

// The reach, to the block.
{
  const gap = CLAIM_REACH / 16
  const inside = claimParts([chunks(0, 0), chunks(1 + gap, 0)], [8, 8], [])
  const outside = claimParts([chunks(0, 0), chunks(2 + gap, 0)], [8, 8], [])
  check(roles(inside) === 'main:0+1', `a claim ${CLAIM_REACH} blocks off is within reach`)
  check(roles(outside) === 'main:0 detached:1', `one ${CLAIM_REACH + 16} blocks off isn't`)
}

// An outpost across the world, with an island of its own; claims near it are its, not the town's.
{
  const claims = [chunks(0, 0, 4, 4), chunks(1000, 1000, 3, 3), chunks(1005, 1000), chunks(500, 0)]
  const parts = claimParts(claims, [8, 8], [spawn([16008, 16008], 'Calais')])
  check(roles(parts) === 'main:0 outpost:1+2 detached:3', `an outpost and what's near it are one part (${roles(parts)})`)
  check(parts[1].spawns[0].name === 'Calais' && parts[1].centre[0] === 16008, 'the outpost is named and centred on its spawn')
  check(parts[1].chunks === 10, 'and counts its own chunks')
}

// An outpost in the town itself changes nothing: the home outranks it.
{
  const parts = claimParts([chunks(0, 0, 4, 4)], [8, 8], [spawn([40, 40])])
  check(roles(parts) === 'main:0' && parts[0].spawns.length === 1, 'an outpost’s spawn in the town is the town’s, kept on it')
}

// An outpost on an island off the town is an outpost all the same: Towny claims it as one.
{
  const parts = claimParts([chunks(0, 0, 4, 4), chunks(8, 0)], [8, 8], [spawn([136, 8])])
  check(roles(parts) === 'main:0 outpost:1', `an outpost near the town is still an outpost (${roles(parts)})`)
}

// Two outposts in one claim are one part; outposts keep Towny's order; detached parts go biggest first.
{
  const claims = [chunks(0, 0), chunks(200, 0, 2, 2), chunks(-200, 0), chunks(0, 300), chunks(0, -300, 3, 3)]
  const parts = claimParts(claims, [8, 8], [spawn([-3192, 8]), spawn([3208, 8]), spawn([3224, 24])])
  check(roles(parts) === 'main:0 outpost:2 outpost:1 detached:4 detached:3', `parts in order (${roles(parts)})`)
  check(parts[2].spawns.length === 2, 'two spawns in one claim share a part')
}

// A claim within reach of both the town and an outpost goes to the nearer.
{
  const claims = [chunks(0, 0), chunks(30, 0), chunks(20, 0)]
  const parts = claimParts(claims, [8, 8], [spawn([488, 8])])
  check(roles(parts) === 'main:0 outpost:1+2', `the nearer part takes it (${roles(parts)})`)
}

// Detached claims within reach of one another are one part.
{
  const claims = [chunks(0, 0), chunks(500, 0), chunks(503, 0), chunks(900, 0)]
  const parts = claimParts(claims, [8, 8], [])
  check(roles(parts) === 'main:0 detached:1+2 detached:3', `detached claims close together are one part (${roles(parts)})`)
}

// A claim inside a ring of the town's (an enclave) touches it.
{
  const ring: Outline = { x: [0, 160, 160, 0, 0, 32, 32, 128, 128, 0], z: [0, 0, 160, 160, 128, 128, 32, 32, 128, 128] }
  const parts = claimParts([ring, chunks(4, 4)], [8, 8], [])
  check(roles(parts) === 'main:0+1', 'a claim in the town’s ring is the town’s')
}

// No home on the map: the biggest claim stands for the town.
{
  const parts = claimParts([chunks(0, 0), chunks(1000, 0, 5, 5)], null, [])
  check(roles(parts) === 'main:1 detached:0', `without a home, the biggest claim is the town (${roles(parts)})`)
}

// A site the server runs is no players' town: what's apart from its mark is more of it, never detached.
{
  const claims = [chunks(0, 0), chunks(-200, 100, 16, 16), chunks(-210, 100), chunks(1000, 0, 3, 3)]
  const parts = claimParts(claims, [8, 8], [spawn([16008, 8])], { site: true })
  check(roles(parts) === 'main:0 main:1+2 outpost:3', `a quarry's far piece is the quarry's own, its outpost an outpost (${roles(parts)})`)
  check(
    mainBounds(parts)?.maxX === 16 && parts[1].centre[0] === (parts[1].bounds.minX + parts[1].bounds.maxX) / 2,
    'the piece holding its mark is the one fitted; another is centred on itself',
  )
  check(partFocus(parts, 0) === undefined && partFocus(parts, 1)?.minX === -210 * 16, 'a click on the far piece looks at it, one on the mark’s piece at the site')
}

// Which part a block is in.
{
  const claims = [chunks(0, 0, 4, 4), chunks(1000, 0)]
  const parts = claimParts(claims, [8, 8], [spawn([16008, 8])])
  check(partAt(parts, claims, [16010, 3])?.role === 'outpost' && partAt(parts, claims, [5, 5])?.role === 'main', 'a block is found in its part')
  check(partAt(parts, claims, [5000, 5000]) === null, 'and in none, off the town')
}

// The Rulercraft map's markers: a town, its home, its outposts named and numbered, in Towny's order.
const desc = (nation: string) =>
  `<span>&#x1f38c; <a href="x">${nation}</a></span><p>Ruler:</p><span>Someone</span><p>Residents:</p> 1<br /><span>Someone</span><p>ID 0f0f0f0f-0000-0000-0000-00000000000${nation.length % 10}</p>`
const area = (label: string, outline: Outline, nation: string) => ({ label, desc: desc(nation), x: outline.x, z: outline.z, color: '#123456' })
const file: MarkerFile = {
  timestamp: 1,
  sets: {
    'towny.markerset': {
      areas: {
        Noswyn__0: area('Noswyn', chunks(0, 0, 10, 10), 'Northland'),
        Noswyn__1: area('Noswyn', chunks(2000, 0, 6, 6), 'Northland'),
        Noswyn__2: area('Noswyn', chunks(-2000, 0, 2, 2), 'Northland'),
        Hamlet__0: area('Hamlet', chunks(20, 0, 2, 2), 'Northland'),
        Far_Hamlet__0: area('Far_Hamlet', chunks(4000, 4000, 2, 2), 'Northland'),
        Far_Hamlet__1: area('Far_Hamlet', chunks(20, 20, 3, 3), 'Northland'),
      },
      markers: {
        Noswyn__home: { label: 'Noswyn', x: 40, z: 40, icon: 'ruler' },
        Noswyn_Outpost_2: { label: 'Noswyn outpost 2', x: -31990, z: 10, icon: 'outpost' },
        Noswyn_Outpost_1: { label: 'Noswyn outpost Calais', x: 32010, z: 10, icon: 'outpost' },
        Hamlet__home: { label: 'Hamlet', x: 330, z: 10, icon: 'town' },
        Far_Hamlet__home: { label: 'Far_Hamlet', x: 64010, z: 64010, icon: 'town' },
        Far_Hamlet_Outpost_1: { label: 'Far_Hamlet outpost 1', x: 330, z: 330, icon: 'outpost' },
        Nowhere_Outpost_1: { label: 'Nowhere outpost 1', x: 0, z: 0, icon: 'outpost' },
      },
    },
  },
}
{
  const world = worldOf(file)
  const noswyn = world.towns.find((town) => town.name === 'Noswyn')!
  check(
    JSON.stringify(noswyn.outposts) === JSON.stringify([spawn([32010, 10], 'Calais'), spawn([-31990, 10])]),
    `outposts read in Towny's order, named or not (${JSON.stringify(noswyn.outposts)})`,
  )
  check(world.towns.every((town) => town.name !== 'Nowhere'), 'an outpost of no town on the map is left out')
  const old = { ...packWorld(world), towns: packWorld(world).towns.map(({ outposts: _outposts, ...town }) => town) }
  check(unpackWorld(old as ReturnType<typeof packWorld>).towns.every((town) => Array.isArray(town.outposts)), 'a reading kept from before outposts were read unpacks with none')

  // The nation is named about its towns themselves, however far their outposts lie.
  const abroad = abroadOf(world, [])
  const nation = abroad.nations.find((each) => each.name === 'Northland')!
  check(Boolean(nation.extent && nation.extent.maxX <= 400 && nation.extent.minX >= 0), `its heartland leaves the outposts out (${JSON.stringify(nation.extent)})`)
  check(Boolean(nation.heart && nation.heart[0] < 400 && nation.heart[1] < 400), `and its name stays at home (${nation.heart})`)
  const far = abroad.townBySlug.get('far-hamlet')!
  check(far.parts.map((part) => part.role).join() === 'main,outpost', 'a town whose outpost is in the heartland: the outpost is still an outpost')
  check(nation.extent!.maxX < 64000, 'and its home far away is left out by the heartland, as before')
}

// Azania's own towns, as stored: the outposts come from the database, and "fit to town" frames the town itself.
{
  const doc = {
    id: 1,
    name: 'Argentina',
    slug: 'argentina',
    townyId: 'x',
    claims: [chunks(270, 365, 2, 1), chunks(-856, 530, 40, 25)],
    home: { x: 4328, y: 64, z: 5848 },
    outposts: [{ at: [-13384, 8488], name: null }, { at: 'nonsense' }],
    updatedAt: '',
    createdAt: '',
  } as unknown as Town
  const town = mapTown(doc)
  check(town.outposts.length === 1 && town.parts.map((part) => part.role).join() === 'main,outpost', 'a stored town’s outposts are read, and nonsense left out')
  const fit = townFit(town)
  check(Boolean(fit && fit.maxX - fit.minX === 32), `fit to town frames the town, not its outpost (${JSON.stringify(fit)})`)
  const bare = mapTown({ ...doc, outposts: null } as unknown as Town)
  check(bare.outposts.length === 0 && bare.parts.map((part) => part.role).join() === 'main,detached', 'before the map is read again, an outpost reads as detached')
}

// The live map, when a copy of its markers is at hand: every town's claims fall into parts, quickly.
const live = process.argv[2]
if (live) {
  const started = performance.now()
  const world = abroadOf(worldOf(JSON.parse(readFileSync(live, 'utf8')) as MarkerFile), [])
  const ms = performance.now() - started
  const counts = { main: 0, outpost: 0, detached: 0 }
  for (const town of world.towns) for (const part of town.parts) counts[part.role]++
  console.log(`     the live map: ${JSON.stringify(counts)} in ${Math.round(ms)} ms`)
  check(world.towns.every((town) => town.parts[0]?.role === 'main'), 'every town on the live map has itself first')
  check(
    world.towns.every((town) => town.kind !== 'town' || town.parts.filter((part) => part.role === 'main').length === 1),
    'a players’ town, once',
  )
  check(world.towns.every((town) => town.kind === 'town' || town.parts.every((part) => part.role !== 'detached')), 'and no site has anything detached')
  check(world.towns.every((town) => town.parts.reduce((sum, part) => sum + part.claims.length, 0) === town.claims.length), 'and every claim is in one part')
}

if (failed) {
  console.log('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
