/**
 * UV-lock regression test. DeepSlate ignores blockstate `uvlock`, so we restore
 * it (src/.../deepslate/uvlock.ts). This exercises the SHIPPED `uvLockMesh` on
 * every uvlock'd variant in the vanilla block set and asserts the invariant that
 * defines uvlock: a locked face must end up with the same texture orientation a
 * non-rotated face of its final world-facing has.
 *
 *   pnpm test:uvlock
 *
 * No browser needed — the render BlockModel/BlockDefinition code is pure; we feed
 * it a square stub atlas so UV orientation is all that matters.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BlockDefinition, BlockModel, Identifier, type Quad } from 'deepslate'
import { glMatrix, mat4 } from 'gl-matrix'

import { deriveKTable, uvLockMesh } from '../src/blocks/components/Litematic/deepslate/uvlock'

let failed = false
function assert(cond: boolean, msg: string): void {
  console.log(`${cond ? 'ok  ' : 'FAIL'} — ${msg}`)
  if (!cond) failed = true
}

const round = (n: number) => Math.round(n)
type Face = '?' | 'down' | 'east' | 'north' | 'south' | 'up' | 'west'
function faceOf(x: number, y: number, z: number): Face {
  if (round(y) === 1) return 'up'
  if (round(y) === -1) return 'down'
  if (round(z) === 1) return 'south'
  if (round(z) === -1) return 'north'
  if (round(x) === 1) return 'east'
  if (round(x) === -1) return 'west'
  return '?'
}
function tangents(face: Face): [number, number] {
  if (face === 'up' || face === 'down') return [0, 2]
  if (face === 'north' || face === 'south') return [0, 1]
  return [1, 2]
}
type Grad = [number, number, number, number] // [du/da, du/db, dv/da, dv/db]
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
  // Normalise magnitudes to signs (orientation only) so a square stub suffices.
  const sgn = (n: number) => (Math.abs(n) < 1e-6 ? 0 : Math.sign(n))
  return [sgn(a[0]), sgn(b[0]), sgn(a[1]), sgn(b[1])]
}
const gEq = (a: Grad, b: Grad) => a.every((n, i) => n === b[i])

function rotationMatrix(xDeg: number, yDeg: number): mat4 {
  const t = mat4.create()
  mat4.translate(t, t, [8, 8, 8])
  mat4.rotateY(t, t, -glMatrix.toRadian(yDeg))
  mat4.rotateX(t, t, -glMatrix.toRadian(xDeg))
  mat4.translate(t, t, [-8, -8, -8])
  return t
}

// Square stub atlas → UV orientation is all that matters.
const atlas = { getTextureUV: () => [0, 0, 1, 1] as [number, number, number, number] }
const spriteCenter = () => [0.5, 0.5] as [number, number]
const ATLAS_SIZE: [number, number] = [1, 1]

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const load = async (f: string) =>
    JSON.parse(await readFile(path.resolve(here, '../public/litematic', f), 'utf8')) as Record<string, unknown>
  const modelsJson = await load('model.json')
  const defsJson = await load('block_definition.json')

  const blockModels: Record<string, BlockModel> = {}
  for (const id of Object.keys(modelsJson)) blockModels[`minecraft:${id}`] = BlockModel.fromJson(modelsJson[id])
  const provider = { getBlockModel: (id: Identifier) => blockModels[id.toString()] ?? null }
  Object.values(blockModels).forEach((m) => m.flatten(provider))

  // ── Sanity: derived table is identity when there is no rotation ─────────────
  const table = deriveKTable()
  assert(
    ['up', 'down', 'south', 'north', 'east', 'west'].every((f) => table[f]['0,0'] === 0),
    'no rotation → no UV-lock (all faces map to 0 steps)',
  )

  // ── Canonical face orientations from an unrotated cube ──────────────────────
  const full: [number, number, number, number] = [0, 0, 16, 16]
  const face = (t: string) => ({ texture: t, uv: full })
  const cube = new BlockModel(undefined, { all: 'minecraft:x' }, [
    { from: [0, 0, 0], to: [16, 16, 16], faces: { up: face('#all'), down: face('#all'), north: face('#all'), south: face('#all'), east: face('#all'), west: face('#all') } },
  ] as never)
  const canonical: Record<string, Grad> = {}
  for (const q of cube.getMesh(atlas as never, {} as never, undefined).quads) {
    const n = q.normal()
    const g = gradient(q, faceOf(n.x, n.y, n.z))
    if (g) canonical[faceOf(n.x, n.y, n.z)] = g
  }

  type VariantLike = { model: string; uvlock?: boolean; x?: number; y?: number }
  const collect = (def: BlockDefinition): VariantLike[] => {
    const d = def as unknown as { multipart?: { apply: VariantLike | VariantLike[] }[]; variants?: Record<string, VariantLike | VariantLike[]> }
    const out: VariantLike[] = []
    for (const v of Object.values(d.variants ?? {})) out.push(...(Array.isArray(v) ? v : [v]))
    for (const p of d.multipart ?? []) out.push(...(Array.isArray(p.apply) ? p.apply : [p.apply]))
    return out
  }

  // ── Every uvlock'd variant in vanilla must lock to canonical ────────────────
  // A face is only compared to the cube canonical when it is intrinsically
  // STANDARD (its unrotated UV already matches the cube). A few decal blocks
  // (vine, sculk_vein) mirror their UVs in the model itself — [16,0,0,16] —
  // so they never match a plain cube; uvlock still rotates them correctly about
  // their centre, but there's no cube reference to assert against, so we skip
  // and count them.
  let blocks = 0
  let variants = 0
  let quadsChecked = 0
  let skippedMirrored = 0
  let controlDiffs = 0 // faces where NOT locking would leave them wrong (proves the fix bites)
  let clampViolations = 0 // rotated UVs falling outside their clamp region (the solid-grey bug)
  for (const id of Object.keys(defsJson)) {
    const def = BlockDefinition.fromJson(defsJson[id])
    blocks++
    for (const v of collect(def)) {
      if (!v.uvlock || (!v.x && !v.y)) continue
      const model = blockModels[Identifier.parse(v.model).toString()]
      if (!model) continue
      variants++

      const plain = model.getMesh(atlas as never, {} as never, undefined) // unrotated, unlocked
      const nolock = model.getMesh(atlas as never, {} as never, undefined) // rotated, unlocked (control)
      nolock.transform(rotationMatrix(v.x ?? 0, v.y ?? 0))
      const locked = model.getMesh(atlas as never, {} as never, undefined)
      uvLockMesh(locked, v.x ?? 0, v.y ?? 0, spriteCenter, ATLAS_SIZE)
      locked.transform(rotationMatrix(v.x ?? 0, v.y ?? 0))

      plain.quads.forEach((pq, i) => {
        const on = pq.normal()
        const origFace = faceOf(on.x, on.y, on.z)
        const g0 = gradient(pq, origFace)
        const lq = locked.quads[i]
        const cq = nolock.quads[i]
        const ln = lq.normal()
        const finalFace = faceOf(ln.x, ln.y, ln.z)
        const gl = gradient(lq, finalFace)
        const gc = gradient(cq, finalFace)
        // Every rotated UV must stay inside its clamp region (else it collapses to
        // one colour under the shader's texLimit clamp).
        for (const v of lq.vertices()) {
          const t = v.texture
          const lim = v.textureLimit
          if (!t || !lim) continue
          const eps = 1e-6
          if (t[0] < lim[0] - eps || t[0] > lim[2] + eps || t[1] < lim[1] - eps || t[1] > lim[3] + eps) clampViolations++
        }
        if (!g0 || !gl || !canonical[origFace] || !canonical[finalFace]) return
        if (!gEq(g0, canonical[origFace])) {
          skippedMirrored++ // intrinsically mirrored / rotated in the model
          return
        }
        quadsChecked++
        if (gc && !gEq(gc, canonical[finalFace])) controlDiffs++ // rotation alone broke it
        if (!gEq(gl, canonical[finalFace])) {
          assert(false, `${id} [${v.model} x:${v.x ?? 0} y:${v.y ?? 0}] face ${finalFace} not world-locked`)
        }
      })
    }
  }

  console.log(
    `\nscanned ${blocks} blocks; ${variants} uvlock variants; ${quadsChecked} standard faces verified, ` +
      `${skippedMirrored} intrinsically-mirrored faces skipped`,
  )
  assert(variants > 100, `found a meaningful set of uvlock variants (${variants})`)
  assert(quadsChecked > 500, `verified many locked faces (${quadsChecked})`)
  assert(controlDiffs > 50, `UV-lock actually changes the result on ${controlDiffs} faces (not a no-op)`)
  assert(clampViolations === 0, `no rotated UVs escape their clamp region (${clampViolations} violations)`)

  // ── Focused: stone_brick_stairs straight tops match across all four facings ──
  {
    const def = BlockDefinition.fromJson(defsJson['stone_brick_stairs'])
    const upGrads = new Set<string>()
    for (const facing of ['east', 'south', 'west', 'north']) {
      const props = { facing, half: 'bottom', shape: 'straight' }
      const key = Object.keys((def as unknown as { variants: Record<string, unknown> }).variants).find((k) =>
        k.split(',').every((p) => { const [a, b] = p.split('='); return (props as Record<string, string>)[a] === b }),
      )!
      const raw = (def as unknown as { variants: Record<string, VariantLike | VariantLike[]> }).variants[key]
      const v = Array.isArray(raw) ? raw[0] : raw
      const model = blockModels[Identifier.parse(v.model).toString()]
      const mesh = model.getMesh(atlas as never, {} as never, undefined)
      if (v.uvlock && (v.x || v.y)) uvLockMesh(mesh, v.x ?? 0, v.y ?? 0, spriteCenter, ATLAS_SIZE)
      mesh.transform(rotationMatrix(v.x ?? 0, v.y ?? 0))
      for (const q of mesh.quads) if (round(q.normal().y) === 1) upGrads.add(JSON.stringify(gradient(q, 'up')))
    }
    assert(upGrads.size === 1, `stone_brick_stairs top faces share one orientation across facings (got ${upGrads.size})`)
  }

  console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS')
  process.exit(failed ? 1 : 0)
}

try {
  await main()
} catch (err) {
  console.error('threw:', err)
  process.exit(1)
}
