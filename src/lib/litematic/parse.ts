import { read } from 'nbtify'

/**
 * Parser for the Litematica `.litematic` schematic format (gzipped NBT).
 *
 * A `.litematic` is a gzip-compressed NBT compound with one or more named
 * Regions. Each region carries a block-state Palette and a bit-packed
 * `BlockStates` long array whose per-voxel indices use Litematica's PRE-1.16
 * "spanning" packing — an index may straddle a 64-bit long boundary. This is
 * NOT the padded/non-spanning packing vanilla chunks switched to in 1.16, and
 * reusing chunk-unpack code corrupts every index past the first long. See
 * `decodeBlockIndex` below.
 *
 * nbtify handles the gzip decompression and NBT decode (longs arrive as a
 * signed BigInt64Array); everything Litematica-specific — palette, spanning
 * unpack, negative-Size axis mirroring, multi-region placement — lives here.
 *
 * MEMORY MODEL — the parser is STREAMING. A region can declare an enormous
 * bounding box that is mostly air (air is index 0, which gzip crushes to almost
 * nothing), so materialising one index per voxel would allocate a dense array
 * far larger than the file and OOM the tab. We therefore never expand the voxels
 * into a dense array: we keep the packed `BlockStates` (re-chunked once into
 * 32-bit words so the hot decode path avoids BigInt) and hand callers a
 * `decodeBlockIndex`/`forEachSolidBlock` decoder that walks voxels on demand.
 * Peak memory scales with the PACKED size (bits/8 per voxel) plus the number of
 * NON-AIR blocks the consumer keeps — not with the bounding-box volume.
 *
 * The output keeps each region's voxels in Litematica's LOCAL enumeration order
 * (the same frame its block-state facings are baked in), so a renderer places
 * `min + local` and directional blocks stay consistent. A negative Size axis just
 * reflects that local frame relative to true world; we do NOT reflect it back, or
 * the facings would desync — stairs/doors would point the wrong way (see
 * parseRegion).
 */

export type BlockState = {
  /** Full block id, e.g. "minecraft:oak_stairs". */
  name: string
  /** Block-state properties, e.g. { facing: "north", half: "bottom" }. */
  properties: Record<string, string>
}

export type LitematicRegion = {
  name: string
  /** True world-space minimum corner (accounts for negative Size axes). */
  min: [number, number, number]
  /** Absolute dimensions. */
  size: [number, number, number]
  palette: BlockState[]
  /** Parallel to `palette`: whether that entry is an air variant (skip it). */
  isAir: boolean[]
  /** Bits per packed index (Litematica's rule; see bitsForPalette). */
  bitsPerBlock: number
  /**
   * The region's `BlockStates` re-chunked into little-endian 32-bit words (two
   * per source long: low half then high half). Decoding stays in 32-bit integer
   * math — no BigInt on the per-voxel hot path. Voxel indices are read out with
   * `decodeBlockIndex`; iterate solids with `forEachSolidBlock`. We keep this
   * packed form instead of a dense per-voxel array (see the MEMORY MODEL note).
   */
  packed: Uint32Array
}

export type LitematicModel = {
  regions: LitematicRegion[]
  bounds: {
    min: [number, number, number]
    max: [number, number, number]
    size: [number, number, number]
  }
  /** Non-air blocks across all regions. */
  blockCount: number
  regionCount: number
}

/**
 * Bounding-box volume cap (voxels), enforced per region AND across all regions.
 *
 * With the streaming decoder this is a SANITY BACKSTOP, not the memory strategy:
 * we no longer allocate a dense per-voxel array, so peak memory tracks the packed
 * size and the non-air block count rather than the volume. The cap still bounds
 * the O(volume) decode SWEEP (we must visit every voxel to find the non-air ones)
 * so a corrupt or hostile file that declares billions of voxels can't spin the
 * tab. 128M voxels is a couple of seconds of tight 32-bit decoding (we sweep
 * twice — once to count, once to place); real builds are far smaller, and dense
 * ones hit the renderer's block-count limit long before this.
 */
export const MAX_VOLUME = 128_000_000

/**
 * Decompressed-size cap (bytes). nbtify decompresses the whole file before we see
 * its structure, so a file that inflates to gigabytes could OOM inside
 * decompression regardless of how we stream afterwards. gzip records the
 * uncompressed size in its 4-byte trailer, so we reject oversized files in O(1)
 * up front. A real build at the volume cap decompresses to well under this even
 * with a large palette. (ISIZE is modulo 2^32; a >4 GB payload that wraps is
 * still caught afterwards by the volume guard, assuming decompression survives.)
 */
export const MAX_DECOMPRESSED_BYTES = 256 * 1024 * 1024

/** Thrown when a schematic's bounding-box volume or decompressed size is too large. */
export class SchematicTooLargeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SchematicTooLargeError'
  }
}

/** gzip trailer's ISIZE (uncompressed size mod 2^32), or null if not a gzip stream. */
function gzipDecompressedSize(bytes: Uint8Array): null | number {
  if (bytes.length < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return null
  const n = bytes.length
  return (bytes[n - 4] | (bytes[n - 3] << 8) | (bytes[n - 2] << 16) | (bytes[n - 1] << 24)) >>> 0
}

const AIR_NAMES = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air'])

export function isAirName(name: string): boolean {
  return AIR_NAMES.has(name)
}

/** Coerce an nbtify numeric wrapper (Int8/Int16/Int32/…) or bigint to a number. */
function num(value: unknown): number {
  return Number(value as number)
}

/** Bits per index = max(2, ceil(log2(paletteSize))), Litematica's rule. */
function bitsForPalette(paletteSize: number): number {
  if (paletteSize <= 1) return 2
  return Math.max(2, 32 - Math.clz32(paletteSize - 1))
}

/**
 * Re-chunk the signed `BlockStates` longs into little-endian 32-bit words (low
 * half then high half of each long). This is the ONLY place BigInt is touched —
 * once per long, not once per voxel — so `decodeBlockIndex` can stay in fast
 * 32-bit integer math. Only the `needed` longs that actually cover the volume
 * are converted; any trailing padding is ignored.
 */
function packLongsToWords(longs: BigInt64Array, needed: number): Uint32Array {
  const LO32 = 0xffffffffn
  const words = new Uint32Array(needed * 2)
  for (let k = 0; k < needed; k++) {
    const u = BigInt.asUintN(64, longs[k])
    words[2 * k] = Number(u & LO32)
    words[2 * k + 1] = Number((u >> 32n) & LO32)
  }
  return words
}

/**
 * Read voxel `i`'s palette index out of the packed 32-bit words. Litematica's
 * spanning packing places index `i` at bit `i * bits`; a value may cross a 32-bit
 * word boundary, so we OR in the high word when it does. Pure 32-bit ops (`>>>`
 * keeps it unsigned); `bits` is small (<= ~16 for real palettes), so the value
 * always fits in the two consecutive words `w` and `w + 1`.
 */
export function decodeBlockIndex(packed: Uint32Array, bits: number, i: number): number {
  const bitStart = i * bits
  const w = bitStart >>> 5
  const off = bitStart & 31
  const mask = bits >= 32 ? 0xffffffff : (1 << bits) - 1
  let value = packed[w] >>> off
  if (off + bits > 32) value |= packed[w + 1] << (32 - off)
  return value & mask
}

/**
 * Visit every NON-AIR voxel of a region in Litematica's local order, decoding
 * each index on the fly — the streaming replacement for a dense index array.
 * `visit` gets the local `(x, y, z)` and the palette index. Air voxels are
 * skipped without allocating anything, so memory stays O(1) here regardless of
 * how large (and empty) the bounding box is.
 */
export function forEachSolidBlock(
  region: LitematicRegion,
  visit: (x: number, y: number, z: number, paletteIndex: number) => void,
): void {
  const [sx, sy, sz] = region.size
  const { bitsPerBlock, isAir, packed } = region
  let i = 0
  for (let y = 0; y < sy; y++) {
    for (let z = 0; z < sz; z++) {
      for (let x = 0; x < sx; x++, i++) {
        const idx = decodeBlockIndex(packed, bitsPerBlock, i)
        if (isAir[idx]) continue
        visit(x, y, z, idx)
      }
    }
  }
}

/** Count the non-air voxels of a region by streaming — no dense array. */
function countSolidBlocks(region: LitematicRegion): number {
  let n = 0
  forEachSolidBlock(region, () => {
    n++
  })
  return n
}

type RawRegion = {
  Position?: { x: unknown; y: unknown; z: unknown }
  Size?: { x: unknown; y: unknown; z: unknown }
  BlockStatePalette?: Array<{ Name?: unknown; Properties?: Record<string, unknown> }>
  BlockStates?: BigInt64Array
}

function parseRegion(name: string, raw: RawRegion): LitematicRegion | null {
  const palette: BlockState[] = (raw.BlockStatePalette ?? []).map((entry) => {
    const properties: Record<string, string> = {}
    if (entry.Properties) {
      for (const [key, val] of Object.entries(entry.Properties)) properties[key] = String(val)
    }
    return { name: String(entry.Name ?? 'minecraft:air'), properties }
  })
  if (palette.length === 0) return null
  const isAir = palette.map((b) => isAirName(b.name))

  const px = num(raw.Position?.x)
  const py = num(raw.Position?.y)
  const pz = num(raw.Position?.z)
  const rawSx = num(raw.Size?.x)
  const rawSy = num(raw.Size?.y)
  const rawSz = num(raw.Size?.z)
  const sx = Math.abs(rawSx)
  const sy = Math.abs(rawSy)
  const sz = Math.abs(rawSz)
  const volume = sx * sy * sz
  if (volume === 0) return null
  // Backstop the O(volume) decode sweep BEFORE we touch the packed data (see MAX_VOLUME).
  if (volume > MAX_VOLUME) {
    throw new SchematicTooLargeError(
      `Region "${name}" is too large to preview: ${sx}×${sy}×${sz} = ${volume.toLocaleString()} voxels ` +
        `(limit ${MAX_VOLUME.toLocaleString()}).`,
    )
  }

  const longs = raw.BlockStates
  if (!longs || longs.length === 0) return null
  const bitsPerBlock = bitsForPalette(palette.length)
  const needed = Math.ceil((volume * bitsPerBlock) / 64)
  if (longs.length < needed) {
    throw new Error(
      `Region "${name}" is truncated: expected >= ${needed} longs for ${volume} blocks at ${bitsPerBlock} bits, got ${longs.length}.`,
    )
  }

  // Re-chunk to 32-bit words once (see packLongsToWords); we decode voxels lazily
  // from this, never expanding a dense per-voxel array.
  const packed = packLongsToWords(longs, needed)

  // World-min corner per axis, and whether an axis is mirrored (negative Size).
  const minX = rawSx >= 0 ? px : px - (sx - 1)
  const minY = rawSy >= 0 ? py : py - (sy - 1)
  const minZ = rawSz >= 0 ? pz : pz - (sz - 1)

  // Litematica stores each region's block array in LOCAL enumeration order, and
  // the block-state facings are baked in that same local frame. So we render the
  // array as-is (matching Litematica and abfielder's viewer): a negative Size
  // axis only means the local frame is reflected relative to true world —
  // reflecting the positions back while leaving the local-frame facings alone
  // would desync them (stairs, doors… would point the wrong way). The sign
  // therefore affects only the min corner used to lay out regions, not the order.

  return { name, min: [minX, minY, minZ], size: [sx, sy, sz], palette, isAir, bitsPerBlock, packed }
}

/**
 * Parse a `.litematic` file (its raw bytes) into a normalised voxel model.
 * Throws on malformed input; callers should surface a friendly error.
 */
export async function parseLitematic(data: ArrayBuffer | Uint8Array): Promise<LitematicModel> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  // Reject a huge payload before decompressing it into memory (see MAX_DECOMPRESSED_BYTES).
  const decompressedSize = gzipDecompressedSize(bytes)
  if (decompressedSize !== null && decompressedSize > MAX_DECOMPRESSED_BYTES) {
    throw new SchematicTooLargeError(
      `Schematic is too large to preview: ~${Math.round(decompressedSize / 1048576)} MB uncompressed ` +
        `(limit ${Math.round(MAX_DECOMPRESSED_BYTES / 1048576)} MB).`,
    )
  }
  const nbt = await read(bytes)
  const root = nbt.data as { Regions?: Record<string, RawRegion> }
  const rawRegions = root.Regions
  if (!rawRegions || typeof rawRegions !== 'object') {
    throw new Error('Not a Litematica schematic: no Regions compound found.')
  }

  const regions: LitematicRegion[] = []
  let blockCount = 0
  let totalVolume = 0
  for (const [name, raw] of Object.entries(rawRegions)) {
    const region = parseRegion(name, raw)
    if (!region) continue
    // Cumulative volume cap: many regions each under the per-region limit can
    // still sum past the sweep backstop.
    totalVolume += region.size[0] * region.size[1] * region.size[2]
    if (totalVolume > MAX_VOLUME) {
      throw new SchematicTooLargeError(
        `Schematic is too large to preview: ${totalVolume.toLocaleString()} voxels across regions ` +
          `(limit ${MAX_VOLUME.toLocaleString()}).`,
      )
    }
    blockCount += countSolidBlocks(region)
    regions.push(region)
  }
  if (regions.length === 0) {
    throw new Error('Litematica schematic contains no non-empty regions.')
  }

  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const r of regions) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], r.min[a])
      max[a] = Math.max(max[a], r.min[a] + r.size[a])
    }
  }
  const size: [number, number, number] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]

  return { regions, bounds: { min, max, size }, blockCount, regionCount: regions.length }
}
