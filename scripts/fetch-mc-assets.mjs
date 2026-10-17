/**
 * Fetches the vanilla Minecraft block assets DeepSlate needs to render a
 * Litematica build with real textures and shapes, and writes them to
 * `public/litematic/` (git-ignored — Mojang IP is never committed to this repo).
 *
 * Source: misode/mcmeta, the canonical machine-readable Minecraft asset mirror
 * maintained by DeepSlate's own author. We pull:
 *   - summary/assets/block_definition/data.min.json  → block_definition.json
 *   - summary/assets/model/data.min.json             → model.json
 *   - atlas/all/data.min.json  (pixel UV rects)      → uv.json (normalised)
 *   - atlas/all/atlas.png      (block texture atlas) → atlas.png (padded to POT)
 *
 * DeepSlate's TextureAtlas requires power-of-two dimensions; the mcmeta atlas is
 * 2048×2128, so we pad the height up to the next power of two and normalise the
 * UV rectangles against the padded size. The block ids the atlas doesn't cover
 * fall back to DeepSlate's magenta "missing texture" placeholder at runtime.
 *
 * Runs before `dev` and `build` (see package.json). Idempotent: skips the
 * download when the outputs already exist unless invoked with `--force`.
 *
 *   node scripts/fetch-mc-assets.mjs [--force]
 */
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const BASE = 'https://raw.githubusercontent.com/misode/mcmeta'
const SOURCES = {
  defs: `${BASE}/summary/assets/block_definition/data.min.json`,
  models: `${BASE}/summary/assets/model/data.min.json`,
  uv: `${BASE}/atlas/all/data.min.json`,
  atlas: `${BASE}/atlas/all/atlas.png`,
}

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/litematic')
const OUTPUTS = ['block_definition.json', 'model.json', 'uv.json', 'atlas.png', 'meta.json']
const force = process.argv.includes('--force')

const upperPowerOfTwo = (n) => {
  let p = 1
  while (p < n) p *= 2
  return p
}

/**
 * Recent Minecraft versions express a model's texture variables as objects
 * (`{ "sprite": "minecraft:block/glass", "force_translucent": true }`) rather
 * than plain strings. DeepSlate 0.26 still expects the string form and calls
 * `.startsWith('#')` on the value, so we flatten each texture leaf back to its
 * sprite id here. The translucency hint is dropped — we drive that from our own
 * block flags in resources.ts instead.
 */
function normalizeModelTextures(models) {
  for (const model of Object.values(models)) {
    const textures = model?.textures
    if (!textures || typeof textures !== 'object') continue
    for (const [key, value] of Object.entries(textures)) {
      if (value && typeof value === 'object') {
        textures[key] = value.sprite ?? Object.values(value).find((v) => typeof v === 'string') ?? '#missing'
      }
    }
  }
}

async function fetchRetry(url, kind, tries = 4) {
  let lastErr
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return kind === 'json' ? await res.json() : new Uint8Array(await res.arrayBuffer())
    } catch (err) {
      lastErr = err
      if (attempt < tries) {
        const backoff = 500 * attempt
        console.warn(`  retry ${attempt}/${tries - 1} for ${url} (${err.message}); waiting ${backoff}ms`)
        await new Promise((r) => setTimeout(r, backoff))
      }
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastErr?.message}`)
}

async function main() {
  const haveAll = OUTPUTS.every((f) => existsSync(path.join(OUT_DIR, f)))
  if (haveAll && !force) {
    console.log('[mc-assets] already present in public/litematic — skipping (use --force to refetch).')
    return
  }

  await mkdir(OUT_DIR, { recursive: true })
  console.log('[mc-assets] fetching vanilla block assets from misode/mcmeta …')

  const [defs, models, uvPixels, atlasBytes] = await Promise.all([
    fetchRetry(SOURCES.defs, 'json'),
    fetchRetry(SOURCES.models, 'json'),
    fetchRetry(SOURCES.uv, 'json'),
    fetchRetry(SOURCES.atlas, 'bin'),
  ])

  normalizeModelTextures(models)

  // Pad the atlas up to power-of-two dimensions (DeepSlate requires POT).
  const meta = await sharp(atlasBytes).metadata()
  const paddedW = upperPowerOfTwo(meta.width)
  const paddedH = upperPowerOfTwo(meta.height)
  const paddedAtlas = await sharp(atlasBytes)
    .extend({
      top: 0,
      left: 0,
      right: paddedW - meta.width,
      bottom: paddedH - meta.height,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  // Normalise the pixel UV rects [x, y, w, h] to [u0, v0, u1, v1] in the padded
  // atlas so DeepSlate can sample them directly.
  //
  // Animated block textures are square frames stacked vertically — the lantern
  // flame is 16×48 (three 16×16 frames), fire, sea lanterns, flowing liquids and
  // the like are the same. Block models address frame 0 in 0–16 UV space, so we
  // crop such a rect to just its top frame; otherwise the model's UVs stretch
  // across every frame and the texture renders squashed and mispositioned.
  // DeepSlate has no animation support, and a static viewer only needs frame 0.
  // (Vanilla has no non-animated non-square block textures, so the "height is a
  // whole multiple of width" test is a safe way to spot a frame stack.)
  const uv = {}
  let framesCropped = 0
  for (const [id, rect] of Object.entries(uvPixels)) {
    const [x, y, w, h] = rect
    const drawH = h > w && h % w === 0 ? w : h
    if (drawH !== h) framesCropped++
    uv[id] = [x / paddedW, y / paddedH, (x + w) / paddedW, (y + drawH) / paddedH]
  }

  await Promise.all([
    writeFile(path.join(OUT_DIR, 'block_definition.json'), JSON.stringify(defs)),
    writeFile(path.join(OUT_DIR, 'model.json'), JSON.stringify(models)),
    writeFile(path.join(OUT_DIR, 'uv.json'), JSON.stringify(uv)),
    writeFile(path.join(OUT_DIR, 'atlas.png'), paddedAtlas),
    writeFile(
      path.join(OUT_DIR, 'meta.json'),
      JSON.stringify({
        source: 'misode/mcmeta',
        atlas: { width: paddedW, height: paddedH, sourceWidth: meta.width, sourceHeight: meta.height },
        blockDefinitions: Object.keys(defs).length,
        models: Object.keys(models).length,
        textures: Object.keys(uv).length,
      }),
    ),
  ])

  console.log(
    `[mc-assets] wrote ${Object.keys(defs).length} block defs, ${Object.keys(models).length} models, ` +
      `${Object.keys(uv).length} texture UVs (${framesCropped} animated cropped to frame 0), ` +
      `atlas ${paddedW}×${paddedH} → public/litematic/`,
  )
}

main().catch((err) => {
  console.error('[mc-assets] FAILED:', err.message)
  process.exit(1)
})
