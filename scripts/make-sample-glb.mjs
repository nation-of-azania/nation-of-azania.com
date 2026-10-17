/**
 * Generates src/seed/assets/azania-lighthouse.glb — a small, dependency-free
 * glTF 2.0 binary of the Lighthouse on Founders' Point, Azania's national
 * monument: a whitewashed, ochre-banded tower on a coral-stone plinth, with a
 * bronze gallery, a golden lantern and a verdigris dome. Used by the seed
 * script's Model3D demo article.
 *
 *   node scripts/make-sample-glb.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outFile = resolve(here, '../src/seed/assets/azania-lighthouse.glb')

// ── geometry helpers ─────────────────────────────────────────────────────────

/**
 * Flat-shaded regular n-gon frustum centered on the Y axis, base at y=0.
 * rb/rt: base/top circumradius (rt = 0 for a cone), h: height.
 * Returns { positions, normals, indices }.
 */
function frustum(sides, rb, rt, h) {
  const ring = (r, y) =>
    Array.from({ length: sides }, (_, i) => {
      // offset by half a step so a flat face, not an edge, faces the viewer
      const a = ((i + 0.5) / sides) * Math.PI * 2
      return [Math.cos(a) * r, y, Math.sin(a) * r]
    })
  const b = ring(rb, 0)
  const t = ring(rt, h)

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
    // triangle fan (faces are convex)
    for (let i = 1; i < verts.length - 1; i++) indices.push(base, base + i, base + i + 1)
  }

  // sides (counter-clockwise seen from outside); a cone's sides are triangles
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides
    addFace(rt > 0 ? [b[i], t[i], t[j], b[j]] : [b[i], t[i], b[j]])
  }
  // bottom (faces down) and top (faces up, skipped for a cone)
  addFace([...b])
  if (rt > 0) addFace([...t].reverse())

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  }
}

// ── lighthouse parts ─────────────────────────────────────────────────────────

const ROCK = [0.36, 0.38, 0.4, 1]
const CORAL_STONE = [0.84, 0.76, 0.64, 1]
const WHITEWASH = [0.95, 0.93, 0.88, 1]
const OCHRE = [0.78, 0.45, 0.2, 1]
const BRONZE = [0.33, 0.27, 0.2, 1]
const LANTERN = [0.98, 0.8, 0.36, 1]
const VERDIGRIS = [0.22, 0.47, 0.46, 1]

// Stacked bottom to top; each part sits on the one before it.
const stack = [
  { geom: frustum(10, 2.0, 1.75, 0.35), color: ROCK, rough: 0.95, metal: 0 },
  { geom: frustum(8, 1.3, 1.2, 0.45), color: CORAL_STONE, rough: 0.9, metal: 0 },
  { geom: frustum(8, 0.95, 0.85, 1.05), color: WHITEWASH, rough: 0.8, metal: 0 },
  { geom: frustum(8, 0.85, 0.77, 0.6), color: OCHRE, rough: 0.8, metal: 0 },
  { geom: frustum(8, 0.77, 0.68, 1.05), color: WHITEWASH, rough: 0.8, metal: 0 },
  { geom: frustum(8, 0.95, 0.95, 0.12), color: BRONZE, rough: 0.6, metal: 0.4 },
  { geom: frustum(8, 0.5, 0.5, 0.55), color: LANTERN, rough: 0.3, metal: 0.6 },
  { geom: frustum(8, 0.62, 0, 0.42), color: VERDIGRIS, rough: 0.5, metal: 0.3 },
  { geom: frustum(4, 0.06, 0, 0.22), color: LANTERN, rough: 0.35, metal: 0.9 },
]

let height = 0
const parts = stack.map((part) => {
  const y = height
  const top = part.geom.positions.reduce((max, v, i) => (i % 3 === 1 ? Math.max(max, v) : max), 0)
  height += top
  return { ...part, y }
})

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
  asset: { version: '2.0', generator: 'azania make-sample-glb' },
  scene: 0,
  scenes: [{ name: 'AzaniaLighthouse', nodes: nodes.map((_, i) => i) }],
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
