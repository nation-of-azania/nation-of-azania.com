import { BlockDefinition, BlockModel, type Identifier, TextureAtlas } from 'deepslate'
import type { BlockFlags, Resources, UV } from 'deepslate'

import { isOccludingCube } from './ambientOcclusion'
import { installUvLock } from './uvlock'

/**
 * Builds the DeepSlate `Resources` bundle from the vanilla Minecraft block
 * assets fetched into `public/litematic/` at build time (see
 * scripts/fetch-mc-assets.mjs). This is the wiring that lets DeepSlate render
 * real block shapes and textures instead of the flat archetype cubes we drew
 * before — it reads Mojang's own blockstate + model JSON and the texture atlas.
 *
 * Client-only: it touches `document`/`createImageBitmap`, and it is reached
 * exclusively through Scene.tsx (loaded via `next/dynamic({ ssr: false })`).
 *
 * The whole ~3 MB bundle is loaded once per page and memoised, so multiple
 * Litematic blocks on a page share a single set of registries and one atlas.
 */

const ASSET_BASE = '/litematic'

/** Glass-like blocks: render in the transparent pass and cull shared faces. */
const TRANSLUCENT = new Set([
  'glass',
  'tinted_glass',
  'ice',
  'frosted_ice',
  'slime_block',
  'honey_block',
  'glass_pane',
  'water',
])

function isTranslucent(path: string): boolean {
  if (TRANSLUCENT.has(path)) return true
  return path.endsWith('_stained_glass') || path.endsWith('_stained_glass_pane')
}

/**
 * Full solid cubes report `opaque` so DeepSlate culls the hidden shared face
 * between two adjacent blocks. Without this, every block draws all six faces and
 * neighbouring blocks leave two coplanar faces fighting over the same depth —
 * the z-fighting shimmer. Only genuine full cubes are marked opaque (via
 * `isOccludingCube`), so a slab/stair/pane never wrongly hides a neighbour's
 * face. Glass-like blocks instead report `semi_transparent` + `self_culling` so
 * they blend correctly and only cull against other glass.
 */
function blockFlags(id: Identifier): BlockFlags {
  if (isTranslucent(id.path)) return { self_culling: true, semi_transparent: true }
  return { opaque: isOccludingCube(id.toString()) }
}

/**
 * Builds an O(1) lookup from an atlas UV to the centre of the sprite containing
 * it. The atlas packs sprites on a 16-texel grid, so we bucket the grid: each
 * sprite stamps its centre into every 16-texel cell it covers, and a query just
 * quantises the UV to a cell. Used by UV-lock to rotate a face's texture about
 * its sprite centre.
 */
function makeSpriteCenterLookup(
  idMap: Record<string, UV>,
  width: number,
  height: number,
): (u: number, v: number) => [number, number] | null {
  const cols = Math.max(1, Math.round(width / 16))
  const rows = Math.max(1, Math.round(height / 16))
  const grid: ([number, number] | null)[] = new Array(cols * rows).fill(null)
  for (const [u0, v0, u1, v1] of Object.values(idMap)) {
    const center: [number, number] = [(u0 + u1) / 2, (v0 + v1) / 2]
    const c0 = Math.floor(u0 * cols + 1e-6)
    const c1 = Math.ceil(u1 * cols - 1e-6)
    const r0 = Math.floor(v0 * rows + 1e-6)
    const r1 = Math.ceil(v1 * rows - 1e-6)
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) grid[r * cols + c] = center
      }
    }
  }
  return (u, v) => {
    const c = Math.min(cols - 1, Math.max(0, Math.floor(u * cols)))
    const r = Math.min(rows - 1, Math.max(0, Math.floor(v * rows)))
    return grid[r * cols + c]
  }
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`)
  return res.json()
}

async function loadAtlasImageData(url: string): Promise<ImageData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`)
  const bitmap = await createImageBitmap(await res.blob())
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable for atlas decode')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

async function build(): Promise<Resources> {
  const [defsJson, modelsJson, uvJson, atlasData] = await Promise.all([
    fetchJson(`${ASSET_BASE}/block_definition.json`),
    fetchJson(`${ASSET_BASE}/model.json`),
    fetchJson(`${ASSET_BASE}/uv.json`),
    loadAtlasImageData(`${ASSET_BASE}/atlas.png`),
  ])

  // mcmeta keys are namespace-less ("oak_planks", "block/oak_planks"); DeepSlate
  // looks resources up by full Identifier ("minecraft:oak_planks"), so prefix.
  const blockDefinitions: Record<string, BlockDefinition> = {}
  for (const id of Object.keys(defsJson)) {
    blockDefinitions[`minecraft:${id}`] = BlockDefinition.fromJson(defsJson[id])
  }

  const blockModels: Record<string, BlockModel> = {}
  for (const id of Object.keys(modelsJson)) {
    blockModels[`minecraft:${id}`] = BlockModel.fromJson(modelsJson[id])
  }
  const modelProvider = { getBlockModel: (id: Identifier) => blockModels[id.toString()] ?? null }
  // Resolve each model's parent chain + texture refs up front.
  Object.values(blockModels).forEach((model) => model.flatten(modelProvider))

  const idMap: Record<string, UV> = {}
  for (const id of Object.keys(uvJson)) {
    idMap[`minecraft:${id}`] = uvJson[id] as UV
  }
  const atlas = new TextureAtlas(atlasData, idMap)

  // Enable UV-lock (see uvlock.ts): needs, per atlas UV, the centre of the sprite
  // that contains it — so it can rotate a rotated face's texture about that centre.
  installUvLock(makeSpriteCenterLookup(idMap, atlasData.width, atlasData.height), [
    atlasData.width,
    atlasData.height,
  ])

  return {
    getBlockDefinition: (id) => blockDefinitions[id.toString()] ?? null,
    getBlockModel: (id) => blockModels[id.toString()] ?? null,
    getTextureUV: (id) => atlas.getTextureUV(id),
    getTextureAtlas: () => atlas.getTextureAtlas(),
    getPixelSize: () => atlas.getPixelSize(),
    getBlockFlags: (id) => blockFlags(id),
    getBlockProperties: () => null,
    getDefaultBlockProperties: () => null,
  }
}

let cached: null | Promise<Resources> = null

/** Loads and memoises the vanilla block resource bundle (once per page). */
export function loadDeepslateResources(): Promise<Resources> {
  if (!cached) {
    cached = build().catch((err) => {
      cached = null // let a later block retry instead of caching the failure
      throw err
    })
  }
  return cached
}
