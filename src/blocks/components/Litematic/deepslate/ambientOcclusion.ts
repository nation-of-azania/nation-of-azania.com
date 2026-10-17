import type { Mesh, StructureRenderer } from 'deepslate'
import type { Structure } from 'deepslate/core'

/**
 * Vertex-color shading baked into the mesh after DeepSlate builds the structure,
 * to make builds read as solid. Two effects, both multiplied into vertex colors:
 *
 *   1. Directional FACE shading (top brightest → bottom darkest). DeepSlate's own
 *      shader shades very mildly (~0.6–1.0), leaving builds flat; this is the
 *      change you actually see, because it covers whole faces.
 *   2. Corner AMBIENT OCCLUSION — soft darkening where blocks meet. Physically
 *      correct but subtle on a convex build (it only touches face corners), so
 *      it's the finishing detail on top of the face shading, not the main event.
 *
 * DeepSlate exposes no hook for this, so we reach into the built chunk meshes
 * (their `quads`/`Vertex.color` are public and mutable), darken each face-corner
 * vertex by the occupancy of the three blocks touching that corner on the
 * outward side, and re-upload. The `chunkBuilder`/`atlasTexture` access is the
 * one place we depend on DeepSlate internals; it is guarded so a version bump
 * degrades to "no AO" rather than a crash. Pinned to deepslate 0.26.
 */

const MC_NAMESPACE = 'minecraft:'

/** Full solid blocks that occlude a neighbour's corner for AO purposes. */
const TRANSPARENT = new Set([
  'air',
  'cave_air',
  'void_air',
  'water',
  'lava',
  'barrier',
  'light',
  'structure_void',
  'glass',
  'tinted_glass',
  'ice',
  'frosted_ice',
  'slime_block',
  'honey_block',
])
const NON_FULL_EXACT = new Set([
  'ladder',
  'iron_bars',
  'chain',
  'vine',
  'glow_lichen',
  'scaffolding',
  'snow',
  'lantern',
  'soul_lantern',
  'lever',
  'tripwire',
  'tripwire_hook',
  'flower_pot',
  'cobweb',
  'grass',
  'short_grass',
  'tall_grass',
  'fern',
  'large_fern',
  'dead_bush',
  'sea_pickle',
  'turtle_egg',
  'conduit',
  'end_rod',
  'lightning_rod',
  'bell',
  'bamboo',
  'sugar_cane',
  'kelp',
  'seagrass',
  'cake',
])
const NON_FULL_SUFFIX = [
  '_slab',
  '_stairs',
  '_fence',
  '_fence_gate',
  '_wall',
  '_pane',
  '_door',
  '_trapdoor',
  '_carpet',
  '_bed',
  '_button',
  '_pressure_plate',
  '_sign',
  '_banner',
  '_candle',
  '_torch',
  '_head',
  '_skull',
  '_sapling',
  '_rail',
  '_fan',
  '_leaves',
]

/** True for full opaque cubes — the blocks that cast AO onto their neighbours. */
export function isOccludingCube(fullName: string): boolean {
  const name = fullName.startsWith(MC_NAMESPACE) ? fullName.slice(MC_NAMESPACE.length) : fullName
  if (TRANSPARENT.has(name) || NON_FULL_EXACT.has(name)) return false
  if (name.endsWith('_stained_glass') || name.endsWith('_stained_glass_pane')) return false
  for (const suffix of NON_FULL_SUFFIX) if (name.endsWith(suffix)) return false
  return true
}

/** Minecraft corner AO level: 3 = fully open, 0 = both edges occluded (darkest). */
export function aoLevel(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 0
  return 3 - (side1 ? 1 : 0) - (side2 ? 1 : 0) - (corner ? 1 : 0)
}

/** Brightness multiplier for an AO level, scaled by strength (0 = off, 1 = strong). */
export function aoBrightness(level: number, strength: number): number {
  const ramp = [1 - strength * 0.65, 1 - strength * 0.48, 1 - strength * 0.28, 1]
  return ramp[level] ?? 1
}

/**
 * Minecraft-style directional face shading, baked per face. DeepSlate's own
 * shader shades very mildly (~0.6–1.0), which leaves builds looking flat; this
 * darkens whole faces by orientation (top brightest, bottom darkest) for a much
 * stronger sense of solidity. Applied to every vertex of a face, so — unlike
 * corner AO — it covers the full face and actually reads.
 */
export function faceShade(nx: number, ny: number, nz: number): number {
  if (ny > 0) return 1 // top
  if (ny < 0) return 0.5 // bottom
  if (nz !== 0) return 0.8 // north / south
  return 0.62 // east / west
}

type ChunkBuilderLike = { getMeshes?: () => Mesh[] }

export function bakeAmbientOcclusion(
  renderer: StructureRenderer,
  structure: Structure,
  gl: WebGLRenderingContext,
  strength = 0.5,
): void {
  const chunkBuilder = (renderer as unknown as { chunkBuilder?: ChunkBuilderLike }).chunkBuilder
  const meshes = chunkBuilder?.getMeshes?.()
  if (!meshes) return

  const occludes = (x: number, y: number, z: number): boolean => {
    const block = structure.getBlock([x, y, z])
    return block ? isOccludingCube(block.state.getName().toString()) : false
  }

  for (const mesh of meshes) {
    for (const quad of mesh.quads) {
      const n = quad.normal().components()
      const nx = Math.round(n[0])
      const ny = Math.round(n[1])
      const nz = Math.round(n[2])
      // Only axis-aligned block faces get AO — skip cross/diagonal models (plants…).
      if (Math.abs(nx) + Math.abs(ny) + Math.abs(nz) !== 1) continue
      const axis = nx !== 0 ? 0 : ny !== 0 ? 1 : 2
      const sign = nx + ny + nz
      const t1 = (axis + 1) % 3
      const t2 = (axis + 2) % 3
      const shade = faceShade(nx, ny, nz)

      for (const v of quad.vertices()) {
        const p = v.pos.components()
        const bp = v.blockPos?.components()
        if (!bp) continue
        // Which corner of the face is this vertex? (±1 along each tangent axis)
        const s1 = p[t1] > bp[t1] + 0.5 ? 1 : -1
        const s2 = p[t2] > bp[t2] + 0.5 ? 1 : -1
        // The three neighbours touching this corner on the outward (normal) side.
        const base = [bp[0], bp[1], bp[2]]
        base[axis] += sign
        const side1 = [...base]
        side1[t1] += s1
        const side2 = [...base]
        side2[t2] += s2
        const corner = [...base]
        corner[t1] += s1
        corner[t2] += s2
        const level = aoLevel(
          occludes(side1[0], side1[1], side1[2]),
          occludes(side2[0], side2[1], side2[2]),
          occludes(corner[0], corner[1], corner[2]),
        )
        const f = aoBrightness(level, strength) * shade
        // New array (vertex colors may share a reference within a quad).
        v.color = [v.color[0] * f, v.color[1] * f, v.color[2] * f]
      }
    }
    mesh.rebuild(gl, { blockPos: true, color: true, normal: true, pos: true, texture: true })
  }
}

/**
 * FALLBACK atlas filtering, used only when the antialiased-nearest shader can't
 * be installed (no derivatives extension — see textureShader.ts). NEAREST
 * magnification keeps pixel-art texels sharp when zoomed in; mipmapped
 * minification (the chain DeepSlate already generated) tames shimmer on faces
 * shrunk into the distance. This still lets block edges crawl a little as the
 * build rotates — the shader path is what removes that — but it's the safe
 * degrade, and the extension is present on effectively all current GPUs.
 */
export function fixAtlasFilter(renderer: StructureRenderer, gl: WebGLRenderingContext): void {
  const texture = (renderer as unknown as { atlasTexture?: WebGLTexture }).atlasTexture
  if (!texture) return
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
}
