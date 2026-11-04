'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'

import type { ContinentId } from '@/maps/continents'
import { WORLD_NORTH, WORLD_SOUTH, WORLD_WEST, WORLD_WIDTH } from '@/maps/source'
import type { World } from '@/maps/world'
import type { ContinentStats } from '@/maps/worldStats'

import type { Appearance } from '../hooks'

/** The world view's lazily fetched module (./worldLazy.ts), named as a type only: nothing of the grids is imported here. */
export type WorldLazy = typeof import('./worldLazy')

/**
 * The little map of the world in the world view: the land in a silhouette
 * (src/maps/land-grid.ts), each continent washed by how many of the
 * server's people live there, and every town a dot where its home block
 * stands, Azania's in saffron. The continent under the pointer lights up,
 * and a click chooses it, as a row in the key beneath does; the key says
 * everything the picture does, so the picture is hidden from a screen
 * reader. Drawn on a canvas: the silhouette is a pass over the pixels, the
 * towns a few hundred dots, which the panel can afford on every hover.
 */

const HEIGHT_OF_WIDTH = (WORLD_SOUTH - WORLD_NORTH) / WORLD_WIDTH

/** How the map is painted in each appearance. */
const PAINTS = {
  light: {
    sea: [226, 235, 241],
    land: [233, 224, 203],
    /** The wash a continent's land takes for its people, at full strength. */
    wash: [20, 51, 75],
    washUpTo: 0.5,
    lit: [216, 150, 44],
    litUpTo: 0.78,
    hover: 0.4,
    town: 'rgba(22, 25, 31, 0.6)',
    townFar: 'rgba(22, 25, 31, 0.2)',
    home: '#b2761a',
    homeFar: 'rgba(178, 118, 26, 0.35)',
    halo: 'rgba(251, 248, 241, 0.9)',
    label: '#555c6a',
    labelHalo: 'rgba(251, 248, 241, 0.85)',
  },
  dark: {
    sea: [10, 27, 42],
    land: [47, 81, 110],
    wash: [140, 192, 232],
    washUpTo: 0.5,
    lit: [232, 182, 92],
    litUpTo: 0.85,
    hover: 0.45,
    town: 'rgba(251, 248, 241, 0.65)',
    townFar: 'rgba(251, 248, 241, 0.22)',
    home: '#e8b65c',
    homeFar: 'rgba(232, 182, 92, 0.35)',
    halo: 'rgba(15, 38, 56, 0.9)',
    label: '#b9b2a3',
    labelHalo: 'rgba(15, 38, 56, 0.85)',
  },
} as const

/** Where each continent's name sits, in longitude and latitude: clear of the thick of its towns. */
const LABELS: Record<ContinentId, [lon: number, lat: number]> = {
  'north-america': [-102, 48],
  'south-america': [-58, -18],
  europe: [12, 58],
  africa: [20, 6],
  asia: [92, 56],
  oceania: [136, -27],
  antarctica: [10, -78],
}

const blend = (base: readonly number[], over: readonly number[], a: number): [number, number, number] => [
  base[0] + (over[0] - base[0]) * a,
  base[1] + (over[1] - base[1]) * a,
  base[2] + (over[2] - base[2]) * a,
]

export function WorldMap({
  world,
  ours,
  continents,
  selected,
  hover,
  onHover,
  onSelect,
  appearance,
  lazy,
}: {
  world: World
  /** Azania's own towns, by Towny id. */
  ours: Set<string>
  continents: ContinentStats[]
  selected: ContinentId | null
  hover: ContinentId | null
  onHover: (id: ContinentId | null) => void
  onSelect: (id: ContinentId) => void
  appearance: Appearance
  lazy: WorldLazy
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const paint = PAINTS[appearance === 'dark' ? 'dark' : 'light']
  const most = Math.max(1, ...continents.map((continent) => continent.residents))
  const share = useMemo(() => Object.fromEntries(continents.map((c) => [c.id, c.residents / most])) as Record<ContinentId, number>, [continents, most])

  // The map takes the panel's width, and follows it.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  // The towns as dots: worked out once per reading, biggest first so the small sit on top.
  const towns = useMemo(
    () =>
      world.towns
        .filter((town) => town.kind === 'town')
        .map((town) => ({ spot: lazy.spotOf(town), residents: town.residents, home: town.id ? ours.has(town.id) : false }))
        .filter((town): town is typeof town & { spot: [number, number] } => town.spot !== null)
        .map((town) => ({ ...town, continent: lazy.continentAt(town.spot) }))
        .sort((a, b) => b.residents - a.residents),
    [world, ours, lazy],
  )

  // Which continent each pixel belongs to, and whether it's land: once per size.
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1)
  const pixelWidth = Math.round(width * dpr)
  const pixelHeight = Math.round(width * HEIGHT_OF_WIDTH * dpr)
  const cells = useMemo(() => {
    if (!pixelWidth) return null
    const land = lazy.landGrid()
    const grid = lazy.continentGrid()
    const out = new Uint8Array(pixelWidth * pixelHeight)
    for (let y = 0; y < pixelHeight; y++) {
      const landRow = Math.min(land.rows - 1, Math.floor((y / pixelHeight) * land.rows)) * land.cols
      const gridRow = Math.min(grid.rows - 1, Math.floor((y / pixelHeight) * grid.rows)) * grid.cols
      for (let x = 0; x < pixelWidth; x++) {
        const isLand = land.cells[landRow + Math.min(land.cols - 1, Math.floor((x / pixelWidth) * land.cols))]
        const code = grid.cells[gridRow + Math.min(grid.cols - 1, Math.floor((x / pixelWidth) * grid.cols))]
        out[y * pixelWidth + x] = code | (isLand ? 8 : 0)
      }
    }
    return out
  }, [pixelWidth, pixelHeight, lazy])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !cells || !pixelWidth) return
    const context = canvas.getContext('2d')
    if (!context) return
    canvas.width = pixelWidth
    canvas.height = pixelHeight
    // A colour for each of the sixteen kinds of pixel: sea or land, by continent. The one chosen is lit; the one
    // under the pointer lit a little; with one chosen, the rest fade back.
    const palette: [number, number, number][] = []
    for (let code = 0; code < 16; code++) {
      const id = lazy.CONTINENTS[code & 7]?.id
      if (!(code & 8) || !id) {
        palette.push(paint.sea as unknown as [number, number, number])
        continue
      }
      const washed = blend(paint.land, paint.wash, (share[id] ?? 0) * paint.washUpTo)
      palette.push(
        selected === id
          ? blend(washed, paint.lit, paint.litUpTo)
          : hover === id
            ? blend(washed, paint.lit, paint.hover)
            : selected !== null
              ? blend(paint.land, washed, 0.35)
              : washed,
      )
    }
    const image = context.createImageData(pixelWidth, pixelHeight)
    const data = image.data
    for (let i = 0; i < cells.length; i++) {
      const [r, g, b] = palette[cells[i]]
      data[i * 4] = r
      data[i * 4 + 1] = g
      data[i * 4 + 2] = b
      data[i * 4 + 3] = 255
    }
    context.putImageData(image, 0, 0)

    // The towns.
    const px = (x: number) => ((x - WORLD_WEST) / WORLD_WIDTH) * pixelWidth
    const py = (z: number) => ((z - WORLD_NORTH) / (WORLD_SOUTH - WORLD_NORTH)) * pixelHeight
    context.lineWidth = 0.9 * dpr
    for (const town of towns) {
      const far = selected !== null && town.continent !== selected
      const r = (1.1 + Math.sqrt(town.residents) * 0.5) * dpr
      context.beginPath()
      context.arc(px(town.spot[0]), py(town.spot[1]), r, 0, Math.PI * 2)
      context.fillStyle = town.home ? (far ? paint.homeFar : paint.home) : far ? paint.townFar : paint.town
      context.fill()
      if (town.home && !far) {
        context.strokeStyle = paint.halo
        context.stroke()
      }
    }

    // The names, in spaced capitals with a halo, as the map names the nations.
    context.font = `600 ${9.5 * dpr}px "Source Sans 3", system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.lineJoin = 'round'
    context.lineWidth = 3 * dpr
    for (const continent of continents) {
      const [lon, lat] = LABELS[continent.id]
      const x = ((lon + 180) / 360) * pixelWidth
      const y = ((90 - lat) / 180) * pixelHeight
      const text = continent.short.toUpperCase().split('').join(' ')
      context.globalAlpha = selected !== null && selected !== continent.id ? 0.55 : 1
      context.strokeStyle = paint.labelHalo
      context.strokeText(text, x, y)
      context.fillStyle = selected === continent.id || hover === continent.id ? paint.home : paint.label
      context.fillText(text, x, y)
    }
    context.globalAlpha = 1
  }, [cells, pixelWidth, pixelHeight, dpr, towns, continents, share, selected, hover, paint, lazy])

  /** The continent under a pointer event, by the grid. */
  const under = (event: PointerEvent<HTMLCanvasElement>): ContinentId | null => {
    if (!cells || !pixelWidth) return null
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * pixelWidth)
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * pixelHeight)
    if (x < 0 || y < 0 || x >= pixelWidth || y >= pixelHeight) return null
    return lazy.CONTINENTS[cells[y * pixelWidth + x] & 7]?.id ?? null
  }

  return (
    <canvas
      aria-hidden="true"
      className="block w-full cursor-pointer select-none border border-sand-300"
      onPointerDown={(event) => {
        const id = under(event)
        if (id) onSelect(id)
      }}
      onPointerLeave={() => onHover(null)}
      onPointerMove={(event) => {
        if (event.pointerType === 'mouse') onHover(under(event))
      }}
      ref={canvasRef}
      style={{ aspectRatio: `${WORLD_WIDTH} / ${WORLD_SOUTH - WORLD_NORTH}` }}
    />
  )
}
