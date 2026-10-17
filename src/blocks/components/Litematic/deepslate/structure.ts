import { Structure } from 'deepslate/core'

import { forEachSolidBlock, type LitematicModel } from '@/lib/litematic/parse'

export type BuiltStructure = {
  structure: Structure
  /** Centroid of the placed blocks' bounding box (structure-local) — the orbit pivot. */
  center: [number, number, number]
  /** Bounding-sphere radius of the placed blocks — used to frame the camera. */
  radius: number
}

/**
 * Converts our parsed Litematica model into a DeepSlate `Structure` (real
 * textured Minecraft geometry) and reports the tight bounds of the actual
 * blocks. Our parser keeps each region in Litematica's local order, so we place
 * every non-air block at `regionOffset + local` and let DeepSlate resolve the
 * blockstate → model → texture mapping and culling.
 *
 * The camera should orbit the BLOCKS, not the declared bounding box — a
 * selection can include air margins that push the box centre off the build — so
 * we track the min/max of placed positions here instead of using getSize()/2.
 */
export function litematicToStructure(model: LitematicModel): BuiltStructure {
  const [bx, by, bz] = model.bounds.size
  const structure = new Structure([bx, by, bz])
  const [mx, my, mz] = model.bounds.min

  const lo: [number, number, number] = [Infinity, Infinity, Infinity]
  const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity]

  for (const region of model.regions) {
    const ox = region.min[0] - mx
    const oy = region.min[1] - my
    const oz = region.min[2] - mz
    const { palette } = region

    // Stream non-air voxels straight into the sparse Structure — the parser
    // decodes indices on demand (see forEachSolidBlock), so we never hold a
    // dense per-voxel array for the whole (possibly huge, mostly-air) region.
    forEachSolidBlock(region, (x, y, z, idx) => {
      const px = ox + x
      const py = oy + y
      const pz = oz + z
      const block = palette[idx]
      structure.addBlock([px, py, pz], block.name, block.properties)
      lo[0] = Math.min(lo[0], px)
      lo[1] = Math.min(lo[1], py)
      lo[2] = Math.min(lo[2], pz)
      hi[0] = Math.max(hi[0], px)
      hi[1] = Math.max(hi[1], py)
      hi[2] = Math.max(hi[2], pz)
    })
  }

  if (lo[0] === Infinity) {
    // No blocks — fall back to the declared bounding box.
    return { structure, center: [bx / 2, by / 2, bz / 2], radius: Math.max(1, Math.hypot(bx, by, bz) / 2) }
  }

  // +0.5 because a block at integer p occupies [p, p+1]; centre on the voxel body.
  const center: [number, number, number] = [
    (lo[0] + hi[0] + 1) / 2,
    (lo[1] + hi[1] + 1) / 2,
    (lo[2] + hi[2] + 1) / 2,
  ]
  const radius = Math.max(1, Math.hypot(hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1) / 2)
  return { structure, center, radius }
}
