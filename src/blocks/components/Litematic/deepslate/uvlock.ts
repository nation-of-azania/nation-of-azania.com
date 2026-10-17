import { BlockColors, BlockDefinition, BlockModel, Cull, Identifier, Mesh } from 'deepslate'
import type { Quad } from 'deepslate'
import { glMatrix, mat4 } from 'gl-matrix'

/**
 * UV-lock — the missing half of blockstate rotation in DeepSlate.
 *
 * Minecraft has ONE stair/log/trapdoor model and rotates it per facing via the
 * blockstate's `x`/`y`. To stop the texture spinning with the model, those
 * variants set `uvlock: true`, which locks each face's texture to the world axes.
 * DeepSlate applies the geometry rotation but ignores `uvlock` entirely (it's in
 * its type declaration, never in its code) — so a west-facing stair's top ends up
 * rotated 180° from a slab's top, e.g. the bevel light in stone-brick crevices
 * runs the wrong way. This restores it.
 *
 * A uvlock'd face must end up with the SAME texture orientation a non-rotated
 * face of that final world-facing would have. We achieve it by rotating each
 * face's UVs about its sprite centre by a fixed number of 90° steps before the
 * geometry rotation is applied (the two commute — one touches positions, the
 * other UVs). The step count depends only on (original face, x, y); we DERIVE
 * that table from DeepSlate's own cube geometry so it always matches whatever UV
 * conventions the pinned build uses, rather than hard-coding 96 magic numbers.
 *
 * Installed by patching `BlockDefinition.prototype.getMesh` (all the pieces it
 * needs are public exports); guarded to patch once. Pinned to deepslate 0.26.
 */

const FACE_ORDER = ['up', 'down', 'south', 'north', 'east', 'west'] as const
type Face = '?' | (typeof FACE_ORDER)[number]

const round = (n: number) => Math.round(n)

function faceOf(x: number, y: number, z: number): Face {
  if (round(y) === 1) return 'up'
  if (round(y) === -1) return 'down'
  if (round(z) === 1) return 'south'
  if (round(z) === -1) return 'north'
  if (round(x) === 1) return 'east'
  if (round(x) === -1) return 'west'
  return '?'
}

/** The two world-axis indices tangent to a face, in a fixed order. */
function tangents(face: Face): [number, number] {
  if (face === 'up' || face === 'down') return [0, 2] // x, z
  if (face === 'north' || face === 'south') return [0, 1] // x, y
  return [1, 2] // y, z (east / west)
}

type Grad = [[number, number], [number, number]]

/** 2×2 orientation of a quad's UVs vs its tangent world axes (integer, ±1/0). */
function gradient(quad: Quad, face: Face): Grad | null {
  const [ta, tb] = tangents(face)
  const vs = quad.vertices().map((v) => ({ p: [v.pos.x, v.pos.y, v.pos.z], t: v.texture ?? [0, 0] }))
  const v1 = vs[0]
  let a: null | number[] = null
  let b: null | number[] = null
  for (const v of vs.slice(1)) {
    const dp = [v.p[0] - v1.p[0], v.p[1] - v1.p[1], v.p[2] - v1.p[2]]
    const dt = [v.t[0] - v1.t[0], v.t[1] - v1.t[1]]
    if (Math.abs(dp[ta]) > 1e-6 && Math.abs(dp[tb]) < 1e-6) a = [dt[0] / dp[ta], dt[1] / dp[ta]]
    if (Math.abs(dp[tb]) > 1e-6 && Math.abs(dp[ta]) < 1e-6) b = [dt[0] / dp[tb], dt[1] / dp[tb]]
  }
  if (!a || !b) return null
  return [
    [round(a[0]), round(b[0])],
    [round(a[1]), round(b[1])],
  ]
}

// A k-step UV rotation, as a matrix that left-multiplies a gradient.
const UVROT: Grad[] = [
  [
    [1, 0],
    [0, 1],
  ],
  [
    [0, -1],
    [1, 0],
  ],
  [
    [-1, 0],
    [0, -1],
  ],
  [
    [0, 1],
    [-1, 0],
  ],
]
function mul(R: Grad, G: Grad): Grad {
  return [
    [R[0][0] * G[0][0] + R[0][1] * G[1][0], R[0][0] * G[0][1] + R[0][1] * G[1][1]],
    [R[1][0] * G[0][0] + R[1][1] * G[1][0], R[1][0] * G[0][1] + R[1][1] * G[1][1]],
  ]
}
function mEq(A: Grad, B: Grad): boolean {
  return A[0][0] === B[0][0] && A[0][1] === B[0][1] && A[1][0] === B[1][0] && A[1][1] === B[1][1]
}

function rotationMatrix(xDeg: number, yDeg: number): mat4 {
  // Geometry rotation DeepSlate applies (about the block centre) — linear part only.
  const t = mat4.create()
  mat4.rotateY(t, t, -glMatrix.toRadian(yDeg))
  mat4.rotateX(t, t, -glMatrix.toRadian(xDeg))
  return t
}

/**
 * Number of 90° UV-rotation steps per (original face, x, y), derived once from a
 * reference cube: rotate the cube, and for each face find the UV rotation that
 * puts it back into the world-locked orientation a non-rotated face of its final
 * facing has. Memoised.
 */
let kTable: null | Record<string, Record<string, number>> = null
export function deriveKTable(): Record<string, Record<string, number>> {
  if (kTable) return kTable
  const atlas = { getTextureUV: () => [0, 0, 16, 16] as [number, number, number, number] }
  const full: [number, number, number, number] = [0, 0, 16, 16]
  const face = (texture: string) => ({ texture, uv: full })
  const cube = new BlockModel(undefined, { all: 'minecraft:x' }, [
    {
      from: [0, 0, 0],
      to: [16, 16, 16],
      faces: { up: face('#all'), down: face('#all'), north: face('#all'), south: face('#all'), east: face('#all'), west: face('#all') },
    },
  ] as never)

  const canonical: Record<string, Grad> = {}
  for (const q of cube.getMesh(atlas as never, {} as never, undefined).quads) {
    const n = q.normal()
    const f = faceOf(n.x, n.y, n.z)
    const g = gradient(q, f)
    if (g) canonical[f] = g
  }

  const table: Record<string, Record<string, number>> = {}
  for (const f of FACE_ORDER) table[f] = {}
  for (const xDeg of [0, 90, 180, 270]) {
    for (const yDeg of [0, 90, 180, 270]) {
      const mesh = cube.getMesh(atlas as never, {} as never, undefined)
      const R = rotationMatrix(xDeg, yDeg)
      mesh.quads.forEach((q, i) => {
        q.transform(R)
        const n = q.normal()
        const finalFace = faceOf(n.x, n.y, n.z)
        const g = gradient(q, finalFace)
        const target = canonical[finalFace]
        let steps = 0
        if (g && target) for (let k = 0; k < 4; k++) if (mEq(mul(UVROT[k], g), target)) { steps = k; break }
        table[FACE_ORDER[i]][`${xDeg},${yDeg}`] = steps
      })
    }
  }
  kTable = table
  return table
}

// Our single atlas's geometry, set at install time.
let spriteCenterAt: ((u: number, v: number) => [number, number] | null) | null = null
let atlasW = 0
let atlasH = 0

/**
 * Rotate each uvlock'd face's UVs about its sprite centre, in TEXEL space (the
 * atlas isn't square, so rotating normalised UVs would distort the sprite).
 * Applied to the model mesh BEFORE DeepSlate rotates the geometry — the two
 * commute. Pure (no module state) so it can be unit-tested directly.
 */
export function uvLockMesh(
  mesh: Mesh,
  xDeg: number,
  yDeg: number,
  spriteCenter: (u: number, v: number) => [number, number] | null,
  atlasSize: [number, number],
): void {
  const table = deriveKTable()
  const [aw, ah] = atlasSize
  for (const quad of mesh.quads) {
    const n = quad.normal()
    const k = table[faceOf(n.x, n.y, n.z)]?.[`${xDeg},${yDeg}`]
    if (!k) continue
    const tl = quad.v1.textureLimit
    if (!tl) continue
    const c = spriteCenter((tl[0] + tl[2]) / 2, (tl[1] + tl[3]) / 2)
    if (!c) continue
    const verts = quad.vertices()
    for (const v of verts) {
      const t = v.texture
      if (!t) continue
      let du = (t[0] - c[0]) * aw
      let dv = (t[1] - c[1]) * ah
      for (let s = 0; s < k; s++) {
        const nu = -dv
        dv = du
        du = nu
      }
      v.texture = [c[0] + du / aw, c[1] + dv / ah]
    }
    // The clamp region (textureLimit) must move with the UVs. Recompute it as the
    // bounding box of the rotated UVs, else the shader clamps the moved UVs to the
    // stale extent and a sub-region face (e.g. a stair step) collapses to one colour.
    let lu = Infinity
    let lv = Infinity
    let hu = -Infinity
    let hv = -Infinity
    for (const v of verts) {
      const t = v.texture
      if (!t) continue
      lu = Math.min(lu, t[0])
      lv = Math.min(lv, t[1])
      hu = Math.max(hu, t[0])
      hv = Math.max(hv, t[1])
    }
    const limit: [number, number, number, number] = [lu, lv, hu, hv]
    for (const v of verts) v.textureLimit = limit
  }
}

/** Module-state wrapper used by the installed patch. */
function applyUvLock(mesh: Mesh, xDeg: number, yDeg: number): void {
  if (!spriteCenterAt) return
  uvLockMesh(mesh, xDeg, yDeg, spriteCenterAt, [atlasW, atlasH])
}

let patched = false

/**
 * Enables UV-lock for the whole viewer. `spriteCenter` maps an atlas UV to the
 * centre of the sprite that contains it (built from the atlas index in
 * resources.ts); `atlasSize` is the padded atlas dimensions in texels.
 */
export function installUvLock(
  spriteCenter: (u: number, v: number) => [number, number] | null,
  atlasSize: [number, number],
): void {
  spriteCenterAt = spriteCenter
  atlasW = atlasSize[0]
  atlasH = atlasSize[1]
  if (patched) return
  patched = true

  BlockDefinition.prototype.getMesh = function getMeshWithUvLock(this: BlockDefinition, name, props, atlas, blockModelProvider, cull) {
    // Faithful re-implementation of DeepSlate 0.26's getMesh, with one addition:
    // uvlock'd variants have their face UVs pre-rotated before the geometry turns.
    const variants = (this as unknown as { getModelVariants: (p: typeof props) => VariantLike[] }).getModelVariants(props)
    const mesh = new Mesh()
    for (const variant of variants) {
      const newCull = Cull.rotate(cull, variant.x ?? 0, variant.y ?? 0)
      const blockModel = blockModelProvider.getBlockModel(Identifier.parse(variant.model))
      if (!blockModel) throw new Error(`Cannot find block model ${variant.model}`)
      const tint = name ? BlockColors[name.path]?.(props) : undefined
      const variantMesh = blockModel.getMesh(atlas, newCull, tint)
      if (variant.x || variant.y) {
        if (variant.uvlock) applyUvLock(variantMesh, variant.x ?? 0, variant.y ?? 0)
        const t = mat4.create()
        mat4.translate(t, t, [8, 8, 8])
        mat4.rotateY(t, t, -glMatrix.toRadian(variant.y ?? 0))
        mat4.rotateX(t, t, -glMatrix.toRadian(variant.x ?? 0))
        mat4.translate(t, t, [-8, -8, -8])
        variantMesh.transform(t)
      }
      mesh.merge(variantMesh)
    }
    const t = mat4.create()
    mat4.scale(t, t, [0.0625, 0.0625, 0.0625])
    return mesh.transform(t)
  } as typeof BlockDefinition.prototype.getMesh
}

type VariantLike = { model: string; uvlock?: boolean; x?: number; y?: number }
