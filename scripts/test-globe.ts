/**
 * The globe's arithmetic, checked without a browser: the radius and zoom
 * agree, blocks and spots on the globe round-trip, the curl is the flat map
 * at its start and the globe at its end, a click on the globe finds the
 * block drawn there, the rest frames come out as planned, the nation
 * numbers paint what they should, and the address carries the globe.
 *
 *   pnpm test:globe
 *
 * Everything under test is pure (src/maps/globe.ts, src/maps/raster.ts and
 * friends), so this runs in Node as it is.
 */
import { abroadOf } from '../src/maps/abroad'
import type { Outline, Point } from '../src/maps/geo'
import {
  BLOCKS_PER_RADIAN,
  curlPoint,
  curlSpot,
  faceable,
  pickAt,
  radiusAt,
  restFrame,
  TILT,
  toBlock,
  toLonLat,
  wrapAngle,
  zoomAround,
  zoomForRadius,
  type GlobeView,
} from '../src/maps/globe'
import { rgbOf } from '../src/components/maps/globe/palette'
import { pixelsPerBlock } from '../src/maps/palette'
import { azaniaMask, cellAt, nationNumbering, NUMBER, numberAt, paintAzania, paintWorld, rasterise } from '../src/maps/raster'
import { WORLD_EAST, WORLD_NORTH, WORLD_SOUTH, WORLD_WEST, WORLD_WIDTH } from '../src/maps/source'
import { decodeAt, decodeGlobe, mapsQuery } from '../src/maps/url'
import type { World, WorldTown } from '../src/maps/world'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}
const near = (a: number, b: number, within: number) => Math.abs(a - b) <= within
const degrees = (radians: number) => (radians * 180) / Math.PI

// A random number generator of our own, so a failure can be run again.
let seed = 20261025
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 32
}

// The radius and the zoom.
check(near(radiusAt(-6), 366.7, 0.1), `radiusAt(-6) is ${radiusAt(-6).toFixed(2)}`)
check(near(radiusAt(-7.5), 129.6, 0.1), `radiusAt(-7.5) is ${radiusAt(-7.5).toFixed(2)}`)
check(
  [-8, -7.5, -6, -5, -3.25, 0].every((zoom) => near(zoomForRadius(radiusAt(zoom)), zoom, 1e-9)),
  'zoomForRadius undoes radiusAt',
)
check(near(BLOCKS_PER_RADIAN, 11734.2, 0.05), `a radian is ${BLOCKS_PER_RADIAN.toFixed(1)} blocks`)
check(
  near(radiusAt(-6), pixelsPerBlock(-6) * BLOCKS_PER_RADIAN, 1e-9),
  'a radian of the globe is as many pixels as its blocks on the flat map',
)

// Blocks and spots.
const cape = toLonLat([4088, 7112])
check(
  near(degrees(cape.lon), 19.96, 0.01) && near(degrees(-cape.lat), 34.73, 0.01),
  `Cape Agulhas is ${degrees(cape.lon).toFixed(2)}°E, ${degrees(-cape.lat).toFixed(2)}°S`,
)
{
  let worst = 0
  for (let i = 0; i < 10_000; i++) {
    const real: Point = [WORLD_WEST + random() * WORLD_WIDTH, WORLD_NORTH + random() * (WORLD_SOUTH - WORLD_NORTH)]
    const copy = Math.floor(random() * 5) - 2
    const [x, z] = toBlock(toLonLat([real[0] + copy * WORLD_WIDTH, real[1]]))
    worst = Math.max(worst, Math.abs(x - real[0]), Math.abs(z - real[1]))
  }
  check(worst <= 1, `10,000 blocks, echoes among them, round-trip within ${worst.toExponential(1)} blocks`)
}
{
  const [x] = toBlock(toLonLat([WORLD_EAST, 0]))
  check(x === WORLD_WEST, `x = 36,864 is x = −36,864 (${x})`)
  const [, z] = toBlock(toLonLat([0, 18_448]))
  check(z === WORLD_SOUTH, `z = 18,448 is held at the pole (${z})`)
}

// The curl, at its start and at its end.
{
  const W = 1024
  const H = 900
  let worst = 0
  for (const t of [1e-5, 1.2e-3]) {
    for (const zoom of [-7.5, -6]) {
      const view: GlobeView = { lon: 0.4, lat: 0.3, zoom, t, cx: W / 2, cy: H / 2 }
      const ppb = pixelsPerBlock(zoom)
      const centre: Point = [view.lon * BLOCKS_PER_RADIAN, -view.lat * BLOCKS_PER_RADIAN]
      for (let i = 0; i < 2000; i++) {
        const a = (random() * 2 - 1) * Math.PI
        const phi = (random() - 0.5) * Math.PI
        const block: Point = [centre[0] + a * BLOCKS_PER_RADIAN, -phi * BLOCKS_PER_RADIAN]
        const flat = [W / 2 + (block[0] - centre[0]) * ppb, H / 2 + (block[1] - centre[1]) * ppb]
        const curled = curlSpot(a, phi, view)
        worst = Math.max(worst, Math.abs(curled.x - flat[0]), Math.abs(curled.y - flat[1]))
      }
    }
  }
  check(worst <= 0.01, `barely curled, the sheet is the flat map within ${worst.toFixed(4)} px`)
}
{
  const view: GlobeView = { lon: 1.1, lat: -0.6, zoom: -6, t: 1, cx: 300, cy: 420 }
  const facing = curlPoint({ lon: view.lon, lat: view.lat }, view)
  check(
    near(facing.x, 300, 1e-9) && near(facing.y, 420, 1e-9) && near(facing.facing, 1, 1e-12),
    'curled, the facing spot is drawn at the globe’s centre, facing square on',
  )
  const pole = curlPoint({ lon: 0, lat: Math.PI / 2 }, { ...view, lat: 0 })
  check(near(pole.x, 300, 1e-6) && near(pole.y, 420 - radiusAt(-6), 1e-6), 'the north pole is at the top of a globe facing the equator')
  const limb = curlPoint({ lon: view.lon + Math.PI / 2, lat: 0 }, { ...view, lat: 0 })
  check(near(limb.facing, 0, 1e-12) && near(limb.x, 300 + radiusAt(-6), 1e-6), 'a quarter turn east is on the eastern limb')
}
{
  const R = 700
  const view: GlobeView = { lon: -2.2, lat: 0.5, zoom: zoomForRadius(R), t: 1, cx: 512, cy: 450 }
  let worst = 0
  let tried = 0
  while (tried < 10_000) {
    const block: Point = [WORLD_WEST + random() * WORLD_WIDTH, WORLD_NORTH + random() * (WORLD_SOUTH - WORLD_NORTH)]
    const spot = curlPoint(toLonLat(block), view)
    if (spot.facing <= 0) continue
    tried++
    const back = pickAt(spot.x, spot.y, view)
    if (!back) {
      worst = Infinity
      continue
    }
    const dx = Math.abs(wrapAngle((back[0] - block[0]) / BLOCKS_PER_RADIAN)) * BLOCKS_PER_RADIAN
    // Near a pole every x is the same spot: compare where the blocks lie on the ground.
    const across = dx * Math.cos(toLonLat(block).lat)
    worst = Math.max(worst, Math.max(across, Math.abs(back[1] - block[1])))
  }
  check(worst <= 1, `a click finds the block drawn there, within ${worst.toExponential(1)} blocks (10,000 tries at R 700)`)
  check(pickAt(512 + R + 1, 450, view) === null, 'a click off the sphere finds nothing')
}
{
  const view: GlobeView = { lon: 0.3, lat: 0.2, zoom: -6, t: 1, cx: 512, cy: 450 }
  const under = pickAt(700, 380, view)!
  let worst = 0
  for (const zoom of [-6.6, -6.1, -5.9, -5.4]) {
    const spot = curlPoint(toLonLat(under), zoomAround(view, 700, 380, zoom))
    worst = Math.max(worst, Math.hypot(spot.x - 700, spot.y - 380))
  }
  check(worst < 0.25, `zooming about the pointer keeps its block under it, within ${worst.toFixed(3)} px`)
}

// The rest frames.
{
  const laptop = restFrame(1024, 900, { top: 0, bottom: 0 })
  check(
    near(laptop.rFit, 378, 0.01) &&
      near(laptop.zoomRest, -5.96, 0.005) &&
      near(laptop.zoomMin, -6.96, 0.005) &&
      laptop.zoomHand === -5 &&
      near(radiusAt(laptop.zoomHand), 733, 0.5),
    `laptop: rFit ${laptop.rFit}, rest ${laptop.zoomRest.toFixed(3)}, min ${laptop.zoomMin.toFixed(3)}, hand ${laptop.zoomHand}`,
  )
  const phone = restFrame(412, 839, { top: 64, bottom: 76 })
  check(
    near(phone.rFit, 173, 0.1) &&
      near(phone.zoomRest, -7.08, 0.005) &&
      near(phone.zoomMin, -8.08, 0.005) &&
      near(phone.zoomHand, -6.08, 0.005) &&
      near(radiusAt(phone.zoomHand), 346, 0.5) &&
      phone.cy === 64 + 699 / 2,
    `Pixel 7: rFit ${phone.rFit.toFixed(1)}, rest ${phone.zoomRest.toFixed(3)}, min ${phone.zoomMin.toFixed(3)}, hand ${phone.zoomHand.toFixed(3)}`,
  )
  // A phone on its side: 220 px between the search bar and the sheet, and a globe that fits in them.
  const side = restFrame(863, 360, { top: 64, bottom: 76 })
  check(
    side.rFit <= 0.48 * 220 + 1e-9 && side.cy - side.rFit >= 64 && side.cy + side.rFit <= 360 - 76,
    `Pixel 7 on its side: rFit ${side.rFit.toFixed(1)} in a box 220 px tall, clear of the search bar and the sheet`,
  )
  const none = restFrame(400, 100, { top: 64, bottom: 76 })
  check(Number.isFinite(none.zoomRest) && none.rFit > 0, `no room at all still rests somewhere (rFit ${none.rFit})`)
}

// The globe faces no nearer a pole than its hold.
{
  const solace = toLonLat([-4120, 18392])
  const faced = faceable(solace)
  check(
    near(faced.lat, -TILT.hold, 1e-12) && faced.lon === solace.lon && faceable({ lon: 1, lat: 0.5 }).lat === 0.5,
    `Solace (${((solace.lat * 180) / Math.PI).toFixed(1)}°) is faced from ${((faced.lat * 180) / Math.PI).toFixed(1)}°, and the tropics as they are`,
  )
}

// The nation numbers.
const rect = (minX: number, minZ: number, maxX: number, maxZ: number): Outline => ({
  x: [minX, maxX, maxX, minX],
  z: [minZ, minZ, maxZ, maxZ],
})
const W = 4096
const H = 2048
const count = (ids: Uint8Array, value: number) => ids.reduce((n, id) => n + (id === value ? 1 : 0), 0)
{
  let alone = true
  for (let i = 0; i < 200; i++) {
    const x = Math.floor((random() * 2 - 1) * 2000) * 16
    const z = Math.floor((random() * 2 - 1) * 1000) * 16
    const ids = new Uint8Array(W * H)
    rasterise(ids, W, H, rect(x, z, x + 16, z + 16), 9)
    if (count(ids, 9) !== 1 || ids[cellAt(W, H, [x + 8, z + 8])] !== 9) alone = false
  }
  check(alone, 'a claim of one chunk fills exactly one cell, the one under it, wherever it lies')
}
{
  const ids = new Uint8Array(W * H)
  rasterise(ids, W, H, rect(1000, -400, 2024, 112), 7)
  const area = (1024 * 512) / 18 ** 2
  const rim = (2 * (1024 + 512)) / 18
  check(near(count(ids, 7), area, rim), `1,024 × 512 blocks fill ${count(ids, 7)} cells (${area.toFixed(0)} ± ${rim.toFixed(0)})`)
  // An L: the cells in its notch stay empty.
  const l = new Uint8Array(W * H)
  rasterise(l, W, H, { x: [0, 720, 720, 360, 360, 0], z: [0, 0, 360, 360, 720, 720] }, 5)
  check(numberAt({ ids: l, width: W, height: H, nations: [] }, [600, 600]) === 0 && numberAt({ ids: l, width: W, height: H, nations: [] }, [100, 600]) === 5, 'a claim shaped like an L leaves its notch unclaimed')
}
{
  let threw = false
  try {
    const ids = new Uint8Array(W * H)
    rasterise(ids, W, H, rect(WORLD_EAST - 64, 18_400, WORLD_EAST, 18_448), 6)
    rasterise(ids, W, H, rect(-50, WORLD_NORTH - 16, 50, WORLD_NORTH + 40), 6)
    check(numberAt({ ids, width: W, height: H, nations: [] }, [WORLD_EAST - 1, 18_430]) === 6, 'a claim at the world’s south-east corner is painted there')
  } catch {
    threw = true
  }
  check(!threw, 'claims reaching past the poles and the east edge paint without throwing')
}
{
  const town = (name: string, nation: string | null, claims: Outline[], kind: WorldTown['kind'] = 'town'): WorldTown => ({
    id: name,
    name,
    nation,
    kind,
    capital: false,
    ruler: null,
    residents: 1,
    chunks: 10,
    founded: null,
    publicSpawn: true,
    income: null,
    resource: null,
    home: [claims[0].x[0], claims[0].z[0]],
    claims,
    colour: '#ff0000',
  })
  const world: World = {
    at: 1,
    nations: [
      { name: 'Northland', colour: '#00ff00', capital: null, towns: 1, residents: 1, chunks: 10 },
      { name: 'Southland', colour: '#0000ff', capital: null, towns: 1, residents: 1, chunks: 10 },
    ],
    towns: [
      town('North_Town', 'Northland', [rect(0, 0, 1800, 1800)]),
      town('South_Town', 'Southland', [rect(3600, 3600, 5400, 5400)]),
      town('Lonely', null, [rect(-3600, 0, -1800, 1800)]),
      town('Sahara_Trading_Outpost', null, [rect(-9000, 0, -7200, 1800)], 'trading'),
      town('Ours', 'Azania', [rect(900, 900, 2700, 2700)]),
    ],
  }
  const abroad = abroadOf(world, [{ townyId: 'Ours' }])
  const numbering = nationNumbering(abroad)
  const ids = new Uint8Array(W * H)
  paintAzania(ids, W, H, [{ claims: [rect(900, 900, 2700, 2700)] }])
  check(count(ids, NUMBER.azania) > 0, 'Azania is painted before the world arrives')
  const steps = paintWorld(ids, W, H, abroad, numbering.numberOf)
  let yields = 0
  while (!steps.next().done) yields++
  paintAzania(ids, W, H, [{ claims: [rect(900, 900, 2700, 2700)] }])
  const numbers = { ids, width: W, height: H, nations: numbering.nations }
  check(yields === abroad.towns.length, `the world paints a town at a time (${yields} steps)`)
  check(numberAt(numbers, [1200, 1200]) === NUMBER.azania, 'Azania wins where a reading overlaps it')
  check(numberAt(numbers, [300, 300]) === NUMBER.first, 'the first nation of the reading is number 4')
  check(numberAt(numbers, [4000, 4000]) === NUMBER.first + 1, 'the second is number 5')
  check(numberAt(numbers, [-2700, 900]) === NUMBER.stateless, 'a town of no nation is number 2')
  check(numberAt(numbers, [-8000, 900]) === NUMBER.server, 'a trading outpost is number 3')
  check(numbers.nations[NUMBER.first]?.name === 'Northland', 'a number names its nation')
  const mask = azaniaMask(numbers, 1024, 512, { minX: 900, maxX: 2700, minZ: 900, maxZ: 2700 })
  check(mask[cellAt(1024, 512, [1800, 1800])] === 255 && mask[cellAt(1024, 512, [-8000, 900])] === 0, 'the mask is full over Azania and empty elsewhere')
  check(azaniaMask(numbers).every((value, i) => value === mask[i]), 'the mask is the same scanned in full')
}

// Colours as bytes.
check(rgbOf('hsl(0 100% 50%)').join() === '255,0,0', `hsl(0 100% 50%) is ${rgbOf('hsl(0 100% 50%)')}`)
check(rgbOf('#198a98').join() === '25,138,152', `#198a98 is ${rgbOf('#198a98')}`)
check(
  rgbOf('hsl(210 72% 30%)').every((value, i) => near(value, [21, 77, 132][i], 1)),
  `hsl(210 72% 30%) is ${rgbOf('hsl(210 72% 30%)')}`,
)

// The address.
{
  const query = mapsQuery({ at: { centre: [-6144, 0], zoom: -6 }, layers: ['towns'], globe: true })
  const params = new URLSearchParams(query)
  check(decodeGlobe(params.get('globe')) && query.indexOf('globe') > query.indexOf('layers'), `the globe travels in the address (${query})`)
  check(!decodeGlobe(new URLSearchParams(mapsQuery({ at: { centre: [0, 0], zoom: -3 } })).get('globe')), 'and is gone when it isn’t asked for')
  check(decodeAt('100,200,-8')?.zoom === -8, 'an address may name zoom −8, where a phone’s globe goes')
}

if (failed) {
  console.log('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
