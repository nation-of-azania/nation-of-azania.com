/**
 * Generates src/seed/assets/condoria-monument.glb — a small, dependency-free
 * glTF 2.0 binary of the National Monument of Condoria (a stone obelisk with a
 * gilded pyramidion). Used by the seed script's Model3D demo article.
 *
 *   node scripts/make-sample-glb.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outFile = resolve(here, '../src/seed/assets/condoria-monument.glb')

// ── geometry helpers ─────────────────────────────────────────────────────────

/**
 * Flat-shaded rectangular frustum centered on the Y axis, base at y=0.
 * bw/bd: base width/depth, tw/td: top width/depth (0 for a pyramid), h: height.
 * Returns { positions, normals, indices }.
 */
function frustum(bw, bd, tw, td, h) {
  const b = [
    [-bw / 2, 0, -bd / 2],
    [bw / 2, 0, -bd / 2],
    [bw / 2, 0, bd / 2],
    [-bw / 2, 0, bd / 2],
  ]
  const t = [
    [-tw / 2, h, -td / 2],
    [tw / 2, h, -td / 2],
    [tw / 2, h, td / 2],
    [-tw / 2, h, td / 2],
  ]

  const positions = []
  const normals = []
  const indices = []

  const addFace = (verts) => {
    // face normal from first three vertices
    const [ax, ay, az] = verts[0]
    const [bx, by, bz] = verts[1]
    const [cx, cy, cz] = verts[2]
    const u = [bx - ax, by - ay, bz - az]
    const v = [cx - ax, cy - ay, cz - az]
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const len = Math.hypot(...n) || 1
    n = n.map((x) => x / len)

    const base = positions.length / 3
    for (const p of verts) {
      positions.push(...p)
      normals.push(...n)
    }
    indices.push(base, base + 1, base + 2)
    if (verts.length === 4) indices.push(base, base + 2, base + 3)
  }

  // sides (counter-clockwise seen from outside)
  addFace([b[0], b[1], t[1], t[0]]) // -z
  addFace([b[1], b[2], t[2], t[1]]) // +x
  addFace([b[2], b[3], t[3], t[2]]) // +z
  addFace([b[3], b[0], t[0], t[3]]) // -x
  // bottom (faces down)
  addFace([b[3], b[2], b[1], b[0]])
  // top (faces up) — skip when degenerate (pyramid)
  if (tw > 0 && td > 0) addFace([t[0], t[1], t[2], t[3]])

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  }
}

// ── monument parts ───────────────────────────────────────────────────────────

const STONE_DARK = [0.42, 0.45, 0.4, 1]
const STONE = [0.72, 0.7, 0.62, 1]
const GOLD = [0.83, 0.66, 0.28, 1]

const parts = [
  { geom: frustum(2.4, 2.4, 2.2, 2.2, 0.35), y: 0, color: STONE_DARK, rough: 0.9, metal: 0 },
  { geom: frustum(1.5, 1.5, 1.3, 1.3, 0.7), y: 0.35, color: STONE, rough: 0.85, metal: 0 },
  { geom: frustum(0.9, 0.9, 0.55, 0.55, 3.0), y: 1.05, color: STONE, rough: 0.8, metal: 0 },
  { geom: frustum(0.62, 0.62, 0, 0, 0.55), y: 4.05, color: GOLD, rough: 0.35, metal: 0.9 },
]

// ── build binary buffer + accessors ─────────────────────────────────────────

const pad4 = (n) => (n + 3) & ~3
const binChunks = []
let byteOffset = 0

const bufferViews = []
const accessors = []
const meshes = []
const materials = []
const nodes = []

const pushView = (typedArray, target) => {
  const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength)
  const viewIndex = bufferViews.length
  bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: bytes.byteLength,
    target,
  })
  const padded = pad4(bytes.byteLength)
  binChunks.push(bytes)
  if (padded > bytes.byteLength) binChunks.push(Buffer.alloc(padded - bytes.byteLength))
  byteOffset += padded
  return viewIndex
}

const minMax = (arr, stride) => {
  const min = Array(stride).fill(Infinity)
  const max = Array(stride).fill(-Infinity)
  for (let i = 0; i < arr.length; i += stride) {
    for (let c = 0; c < stride; c++) {
      min[c] = Math.min(min[c], arr[i + c])
      max[c] = Math.max(max[c], arr[i + c])
    }
  }
  return { min, max }
}

parts.forEach((part, index) => {
  const { positions, normals, indices } = part.geom

  const posView = pushView(positions, 34962)
  const { min, max } = minMax(positions, 3)
  const posAccessor = accessors.length
  accessors.push({
    bufferView: posView,
    componentType: 5126,
    count: positions.length / 3,
    type: 'VEC3',
    min,
    max,
  })

  const normView = pushView(normals, 34962)
  const normAccessor = accessors.length
  accessors.push({
    bufferView: normView,
    componentType: 5126,
    count: normals.length / 3,
    type: 'VEC3',
  })

  const idxView = pushView(indices, 34963)
  const idxAccessor = accessors.length
  accessors.push({
    bufferView: idxView,
    componentType: 5123,
    count: indices.length,
    type: 'SCALAR',
  })

  materials.push({
    name: `material-${index}`,
    pbrMetallicRoughness: {
      baseColorFactor: part.color,
      metallicFactor: part.metal,
      roughnessFactor: part.rough,
    },
  })

  meshes.push({
    name: `part-${index}`,
    primitives: [
      {
        attributes: { POSITION: posAccessor, NORMAL: normAccessor },
        indices: idxAccessor,
        material: index,
      },
    ],
  })

  nodes.push({ name: `part-${index}`, mesh: index, translation: [0, part.y, 0] })
})

const gltf = {
  asset: { version: '2.0', generator: 'condoria make-sample-glb' },
  scene: 0,
  scenes: [{ name: 'CondoriaMonument', nodes: nodes.map((_, i) => i) }],
  nodes,
  meshes,
  materials,
  buffers: [{ byteLength: byteOffset }],
  bufferViews,
  accessors,
}

// ── assemble GLB ─────────────────────────────────────────────────────────────

let jsonBuffer = Buffer.from(JSON.stringify(gltf), 'utf8')
if (jsonBuffer.byteLength % 4 !== 0) {
  jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(pad4(jsonBuffer.byteLength) - jsonBuffer.byteLength, 0x20)])
}
const binBuffer = Buffer.concat(binChunks)

const chunkHeader = (length, type) => {
  const buf = Buffer.alloc(8)
  buf.writeUInt32LE(length, 0)
  buf.writeUInt32LE(type, 4)
  return buf
}

const totalLength = 12 + 8 + jsonBuffer.byteLength + 8 + binBuffer.byteLength
const header = Buffer.alloc(12)
header.writeUInt32LE(0x46546c67, 0) // 'glTF'
header.writeUInt32LE(2, 4)
header.writeUInt32LE(totalLength, 8)

const glb = Buffer.concat([
  header,
  chunkHeader(jsonBuffer.byteLength, 0x4e4f534a), // 'JSON'
  jsonBuffer,
  chunkHeader(binBuffer.byteLength, 0x004e4942), // 'BIN'
  binBuffer,
])

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, glb)
console.log(`wrote ${outFile} (${glb.byteLength} bytes, bin ${binBuffer.byteLength}, json ${jsonBuffer.byteLength})`)

// ── structural self-check ────────────────────────────────────────────────────
const check = (cond, msg) => {
  if (!cond) {
    console.error(`GLB SELF-CHECK FAILED: ${msg}`)
    process.exit(1)
  }
}
check(glb.readUInt32LE(0) === 0x46546c67, 'magic')
check(glb.readUInt32LE(8) === glb.byteLength, 'total length')
const jsonLen = glb.readUInt32LE(12)
check(glb.readUInt32LE(16) === 0x4e4f534a, 'json chunk type')
const parsed = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'))
check(parsed.asset.version === '2.0', 'asset version')
const binStart = 20 + jsonLen
check(glb.readUInt32LE(binStart + 4) === 0x004e4942, 'bin chunk type')
check(glb.readUInt32LE(binStart) === binBuffer.byteLength, 'bin length')
check(parsed.buffers[0].byteLength === binBuffer.byteLength, 'buffer byteLength matches')
for (const acc of parsed.accessors) {
  const view = parsed.bufferViews[acc.bufferView]
  const compSize = acc.componentType === 5126 ? 4 : 2
  const compCount = acc.type === 'VEC3' ? 3 : 1
  check(
    view.byteOffset + acc.count * compSize * compCount <= binBuffer.byteLength,
    `accessor in bounds (${acc.count})`,
  )
}
console.log('GLB self-check passed.')
