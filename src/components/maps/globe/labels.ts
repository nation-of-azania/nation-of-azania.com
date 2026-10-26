import { namedFrom, nationFontSize, type Abroad } from '@/maps/abroad'
import { spoken } from '@/maps/data'
import type { Point } from '@/maps/geo'
import { BLOCKS_PER_RADIAN, curlPoint, radiusAt, toLonLat, type GlobeView, type LonLat } from '@/maps/globe'
import { GROUND } from '@/maps/palette'

import { LabelPlacer, textWidth, type Rect } from '../layers/projection'
import { mix, smoothstep } from './motion'

/**
 * The nations' names on the globe, set as the flat map sets them far out
 * (src/components/maps/layers/AbroadLayer.tsx): spaced capitals across each
 * heartland, sized by the ground it holds, only the great ones at the scale
 * of the world, Azania's first and bold, underscored in saffron. They are
 * SVG over the globe's canvas, in the flat map's own type and whitewash
 * halo, so they read as its names do. Each is made once per reading of the
 * world; a frame only moves them and fades them, as they come round the
 * limb and go, and lays them on the curve: towards the limb a name grows a
 * little smaller and is foreshortened along the way to the limb, as if
 * printed on the ground. A name with no room, or round the back, isn't
 * shown.
 */

const SVG = 'http://www.w3.org/2000/svg'

/** Azania's name, and where it's set: the middle of its heartland, across its width in blocks. */
export type HomeName = { name: string; heart: Point; across: number }

type Name = {
  /** The nation's address; null for Azania's own. */
  slug: string | null
  text: string
  heart: LonLat
  /** The heartland's width, in blocks. */
  across: number
  chunks: number
  home: boolean
  group: SVGGElement
  label: SVGTextElement
  underline: SVGPathElement | null
  /** What's set on the elements now, so a frame writes only what changed. */
  size: number
  tracking: number
  /** Where it was placed in the last frame drawn; null when it wasn't. */
  box: Rect | null
}

export type Names = {
  /** Makes the names for a reading of the world (Azania's alone before one has come). */
  build: (world: Abroad | null, home: HomeName | null) => void
  /** Sets the names' inks, by the nation's address: its own colour's dark shade, or its stance's. */
  colour: (inkOf: (slug: string) => string) => void
  /**
   * Places the names for a frame: each about its heartland, where it faces
   * the reader enough to be read and finds room, after `taken`, which the
   * marks have claimed. `shown` fades them all; `world` says whether the
   * other nations' names show at all.
   */
  place: (view: GlobeView, taken: Rect[], shown: number, world: boolean) => void
  /** The nation whose name is under a point: its address, 'home' for Azania's, null for none. */
  at: (x: number, y: number) => string | null
  dispose: () => void
}

export function createNames(svg: SVGSVGElement): Names {
  let names: Name[] = []

  const make = (entry: Omit<Name, 'group' | 'label' | 'underline' | 'size' | 'tracking' | 'box'>): Name => {
    const group = document.createElementNS(SVG, 'g')
    group.setAttribute('visibility', 'hidden')
    const label = document.createElementNS(SVG, 'text')
    label.setAttribute('class', 'font-display')
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('font-weight', entry.home ? '700' : '500')
    label.setAttribute('stroke-width', entry.home ? '3.5' : '2.5')
    if (entry.home) label.setAttribute('fill', GROUND.sea800)
    label.textContent = entry.text
    group.appendChild(label)
    let underline: SVGPathElement | null = null
    if (entry.home) {
      underline = document.createElementNS(SVG, 'path')
      underline.setAttribute('stroke', GROUND.saffron)
      underline.setAttribute('stroke-width', '2')
      underline.setAttribute('stroke-linecap', 'round')
      group.appendChild(underline)
    }
    svg.appendChild(group)
    return { ...entry, group, label, underline, size: 0, tracking: -1, box: null }
  }

  return {
    build: (world, home) => {
      for (const name of names) name.group.remove()
      names = []
      if (home)
        names.push(
          make({ slug: null, text: spoken(home.name).toUpperCase(), heart: toLonLat(home.heart), across: home.across, chunks: 0, home: true }),
        )
      // Every nation that might be named at the globe's zooms, the greatest first.
      const least = namedFrom(-5)
      for (const nation of [...(world?.nations ?? [])].sort((a, b) => b.chunks - a.chunks)) {
        if (nation.chunks < least || !nation.heart || !nation.extent) continue
        names.push(
          make({
            slug: nation.slug,
            text: spoken(nation.name).toUpperCase(),
            heart: toLonLat(nation.heart),
            across: nation.extent.maxX - nation.extent.minX,
            chunks: nation.chunks,
            home: false,
          }),
        )
      }
    },
    colour: (inkOf) => {
      for (const name of names) if (name.slug) name.label.setAttribute('fill', inkOf(name.slug))
    },
    place: (view, taken, shown, world) => {
      const placer = new LabelPlacer()
      for (const rect of taken) placer.claim(rect)
      const R = radiusAt(view.zoom)
      const least = namedFrom(view.zoom)
      for (const name of names) {
        name.box = null
        const spot = curlPoint(name.heart, view)
        const wanted = shown > 0 && spot.facing >= 0.15 && (name.home || (world && name.chunks >= least))
        if (!wanted) {
          name.group.setAttribute('visibility', 'hidden')
          continue
        }
        const size = nationFontSize(name.chunks, view.zoom, name.home)
        const bare = textWidth(name.text, size)
        const across = (name.across / BLOCKS_PER_RADIAN) * R * Math.cos(name.heart.lat)
        const spread = (across * 0.75 - bare) / Math.max(1, name.text.length - 1)
        const tracking = Math.max(size * (name.home ? 0.3 : 0.12), Math.min(size * 0.7, spread))
        // Laid on the curve: a touch smaller towards the limb, and foreshortened along the way to it.
        const facing = Math.min(1, Math.max(0, spot.facing))
        const shrink = 0.8 + 0.2 * facing
        const squash = mix(1, facing, 0.55)
        const radial = Math.atan2(spot.y - view.cy, spot.x - view.cx)
        const angle = (radial * 180) / Math.PI
        const natural = bare + tracking * name.text.length + 6
        // The room it takes on the page, foreshortened: the box the squashed name fits in, square to the page.
        const q = 1 - squash
        const [c, sn] = [Math.cos(radial), Math.sin(radial)]
        const [hw, hh] = [(natural * shrink) / 2, ((size + 6) * shrink) / 2]
        const width = 2 * (Math.abs(1 - q * c * c) * hw + Math.abs(q * c * sn) * hh)
        const height = 2 * (Math.abs(q * c * sn) * hw + Math.abs(1 - q * sn * sn) * hh)
        const box = (y: number): Rect => ({ x: spot.x - width / 2, y: y - height / 2, width, height })
        // A name stays on the ground: a spot that would set either end of it out past the limb isn't tried.
        const inside = (x: number, y: number) => Math.hypot(x - view.cx, y - view.cy) < R * 0.97
        const onGlobe = (y: number) =>
          view.t < 0.999 || (view.tilt ?? 1) < 0.999 || (inside(spot.x - width / 2, y) && inside(spot.x + width / 2, y))
        const placed = placer.tryPlace([spot.y, spot.y - height * 1.1, spot.y + height * 1.1].filter(onGlobe).map(box))
        if (!placed) {
          name.group.setAttribute('visibility', 'hidden')
          continue
        }
        name.box = placed
        if (size !== name.size || Math.abs(tracking - name.tracking) > 0.25) {
          name.size = size
          name.tracking = tracking
          name.label.setAttribute('font-size', String(size))
          name.label.setAttribute('letter-spacing', tracking.toFixed(2))
          // Spacing follows each letter, the last too: the line is set back by half of it to stay centred.
          name.label.setAttribute('x', (tracking / 2).toFixed(2))
          name.label.setAttribute('y', (size * 0.36).toFixed(2))
          name.underline?.setAttribute('d', `M${(-natural * 0.2).toFixed(1)} ${(size * 0.36 + 5).toFixed(1)}h${(natural * 0.4).toFixed(1)}`)
        }
        const at = `translate(${(placed.x + width / 2).toFixed(1)} ${(placed.y + height / 2).toFixed(1)})`
        const lying = squash > 0.995 ? '' : ` rotate(${angle.toFixed(1)}) scale(${squash.toFixed(3)} 1) rotate(${(-angle).toFixed(1)})`
        name.group.setAttribute('transform', `${at}${lying} scale(${shrink.toFixed(3)})`)
        name.group.setAttribute('opacity', ((name.home ? 1 : 0.85) * smoothstep(0.15, 0.45, spot.facing) * shown).toFixed(3))
        name.group.setAttribute('visibility', 'visible')
      }
    },
    at: (x, y) => {
      for (const name of names) {
        const box = name.box
        if (box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) return name.slug ?? 'home'
      }
      return null
    },
    dispose: () => {
      for (const name of names) name.group.remove()
      names = []
    },
  }
}
