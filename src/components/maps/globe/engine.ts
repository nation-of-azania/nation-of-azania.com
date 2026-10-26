'use client'

/**
 * One of only two modules in the codebase that may import three.js; the
 * other is the Model3D block's scene (src/blocks/components/Model3D/Scene.tsx).
 * It is reached only through ./Globe.tsx, which the globe's keeper
 * (./GlobeHost.tsx) mounts; the map's shell fetches the keeper with a plain
 * dynamic import (./support.ts → loadGlobe), only in the browser and only
 * once someone means to open the globe (its button pointed at or focused,
 * the globe asked for, the flat map pulled out past its farthest zoom), so
 * three.js never runs on the server and never rides with the map's first
 * load. Plain three.js: a renderer, a handful of meshes and points with
 * shaders of our own (./shaders.ts), no scene graph to speak of and no
 * camera that does anything. Each class is imported from its own module
 * rather than three.js's whole build, which the Model3D block's scene
 * keeps entire, so the globe brings only the part of three.js it uses.
 */
import {
  BackSide,
  ClampToEdgeWrapping,
  DoubleSide,
  FrontSide,
  GLSL3,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  NoColorSpace,
  NormalBlending,
  RedFormat,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
} from 'three/src/constants.js'
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera.js'
import { BufferAttribute } from 'three/src/core/BufferAttribute.js'
import { BufferGeometry } from 'three/src/core/BufferGeometry.js'
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial.js'
import { Vector2 } from 'three/src/math/Vector2.js'
import { Vector4 } from 'three/src/math/Vector4.js'
import { Mesh } from 'three/src/objects/Mesh.js'
import { Points } from 'three/src/objects/Points.js'
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer.js'
import { Scene } from 'three/src/scenes/Scene.js'
import { DataTexture } from 'three/src/textures/DataTexture.js'
import { Texture } from 'three/src/textures/Texture.js'

import { POLE, radiusAt, type GlobeView } from '@/maps/globe'
import type { Numbers } from '@/maps/raster'

import type { MarkBuffers } from './marks'
import type { ReachRing } from './reach'
import { PALETTE_BYTES } from './palette'
import {
  BACK_FRAGMENT,
  GLOW_FRAGMENT,
  GLOW_VERTEX,
  GROUND_FRAGMENT,
  GROUND_VERTEX,
  POINTS_FRAGMENT,
  POINTS_VERTEX,
  REACH_FRAGMENT,
  REACH_VERTEX,
} from './shaders'

/**
 * How much the device can be asked for. A phone that is short of memory or
 * cores, saving data, or whose GPU can't hold a 4,096-wide texture draws
 * the lite globe: coarser nation numbers and fewer pixels.
 */
export type Tier = 'full' | 'lite'

/**
 * What fades with the globe, and what's picked out on it: borders and
 * fills, the glow, the marks, the world's picture as it comes, the open
 * nation and the one under the pointer (−1 for none), the battles' swell;
 * and, while the flat
 * map curls up or unrolls, the x of the facing spot as the flat map has it
 * (unwrapped: in an echo, past the world's edge), which says where its
 * echoes lie on the sheet.
 */
export type Look = {
  overlay: number
  glow: number
  marks: number
  sheet: number
  selected: number
  hover: number
  flatX: number
  /** Where the battles' rings are in their swell, 0 to 1; 0 when none swells. */
  pulse: number
}

/** The three sets of marks, drawn in this order: the ground's own (Azania's towns, the server's places), the players online, then the sieges over all. */
export type MarkLayer = 'base' | 'players' | 'sieges'

/** What the world's picture may be drawn from. */
export type Picture = ImageBitmap | HTMLImageElement | HTMLCanvasElement

export type Engine = {
  readonly tier: Tier
  /** The size the nation numbers are painted at. */
  readonly numbers: { width: number; height: number }
  resize: (width: number, height: number) => void
  /** Draws one frame; nothing while the context is lost. */
  draw: (view: GlobeView, look: Look) => void
  /**
   * The world's picture: decoded already (./sheet.ts), the flat map's own,
   * an image, or a canvas still filling with tiles (null: the sea alone).
   * Kept, so a lost context given back is given it again.
   */
  setPicture: (picture: Picture | null) => void
  /** The canvas picture has drawn more tiles: take them up. */
  refreshPicture: () => void
  setNumbers: (numbers: Numbers) => void
  setMask: (mask: Uint8Array, width: number, height: number) => void
  /** 256 numbers by three rows, four bytes each: see ./palette.ts. */
  setPalette: (bytes: Uint8Array) => void
  setMarks: (layer: MarkLayer, buffers: MarkBuffers) => void
  /** The reach of Azania's war, a ring of samples about its capital (./reach.ts); null for none. */
  setReach: (ring: ReachRing | null) => void
  pixelRatio: () => number
  /** Whether the context is lost just now, and not yet given back. */
  lost: () => boolean
  /** Draws with fewer pixels, a quarter of a device pixel fewer each time, down to one; false once there. */
  coarsen: () => boolean
  dispose: () => void
}

type Events = {
  /** The context couldn't be made, a shader was refused, or the context was lost and didn't come back. */
  onFail: (reason: 'webgl' | 'shader' | 'lost') => void
  /** The context is lost just now: it may yet come back, and is waited for if this says so; else the globe lets it go. */
  onLost: () => boolean
  /** The context is back after a loss, everything uploaded again from what was kept: draw. */
  onRestored: () => void
}

/** A shader's uniforms: each a value three.js hands to the GPU as it draws. */
type Uniforms = Record<string, { value: unknown }>

/** The ground's mesh: a turn of longitude by half a turn of latitude, as fine as a sphere needs at its closest. */
const ACROSS = 192
const DOWN = 96

/**
 * The sheet's echoes either side, as the flat map repeats the world east
 * and west: drawn only while the sheet is all but flat (t under SKIRT_UNTIL),
 * fading as it curls, so the flat map's twin reaches the page's edges
 * however wide the page.
 */
const SKIRTS = [-2, -1, 1, 2]
const SKIRT_UNTIL = 0.3

/** The borders, fills and marks come in as the sheet curls, all there by this far. */
const OVERLAY_BY = 0.35

const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

/** How long a lost context may take to come back, and how soon a second loss means it won't stay. */
const RESTORE_MS = 2000
const LOSSES_WITHIN_MS = 60_000

function chooseTier(maxTexture: number): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const lite =
    (nav.deviceMemory ?? 8) <= 4 ||
    Boolean(nav.connection?.saveData) ||
    (coarse && (nav.hardwareConcurrency ?? 8) <= 4) ||
    maxTexture < 4096
  return lite ? 'lite' : 'full'
}

/** The sheet's grid: each vertex a longitude from the facing spot and a latitude, wound so the side towards the reader is the front. */
function groundGeometry(): BufferGeometry {
  const positions = new Float32Array((ACROSS + 1) * (DOWN + 1) * 3)
  for (let j = 0; j <= DOWN; j++) {
    for (let i = 0; i <= ACROSS; i++) {
      const at = (j * (ACROSS + 1) + i) * 3
      positions[at] = -Math.PI + (2 * Math.PI * i) / ACROSS
      positions[at + 1] = -Math.PI / 2 + (Math.PI * j) / DOWN
    }
  }
  const index = new Uint32Array(ACROSS * DOWN * 6)
  let k = 0
  for (let j = 0; j < DOWN; j++) {
    for (let i = 0; i < ACROSS; i++) {
      const a = j * (ACROSS + 1) + i
      const b = a + 1
      const c = a + ACROSS + 1
      const d = c + 1
      index.set([a, b, d, a, d, c], k)
      k += 6
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex(new BufferAttribute(index, 1))
  return geometry
}

function quadGeometry(): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3))
  geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1))
  return geometry
}

function pointsGeometry(buffers: MarkBuffers): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(buffers.lonLat, 3))
  geometry.setAttribute('aSize', new BufferAttribute(buffers.size, 1))
  geometry.setAttribute('aStyle', new BufferAttribute(buffers.style, 4))
  geometry.setAttribute('aFill', new BufferAttribute(buffers.fill, 4, true))
  geometry.setAttribute('aRim', new BufferAttribute(buffers.rim, 4, true))
  geometry.setAttribute('aCore', new BufferAttribute(buffers.core, 4, true))
  geometry.setAttribute('aRing', new BufferAttribute(buffers.ring, 4, true))
  geometry.setDrawRange(0, buffers.count)
  return geometry
}

/** The reach's strip: each sample twice, once either side of the line, with its neighbours and how far round it is. */
function reachGeometry(ring: ReachRing): BufferGeometry {
  const n = ring.length
  const position = new Float32Array(n * 2 * 3)
  const prev = new Float32Array(n * 2 * 2)
  const next = new Float32Array(n * 2 * 2)
  const along = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const here = ring[i]
    // At the ends of a ring cut by the world's edge, the line runs on as it was going.
    const before = ring[Math.max(0, i - 1)]
    const after = ring[Math.min(n - 1, i + 1)]
    for (const [k, side] of [[0, -1], [1, 1]] as const) {
      const v = i * 2 + k
      position.set([here.lon, here.lat, side], v * 3)
      prev.set([before.lon, before.lat], v * 2)
      next.set([after.lon, after.lat], v * 2)
      along[v] = here.along
    }
  }
  const index: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(position, 3))
  geometry.setAttribute('aPrev', new BufferAttribute(prev, 2))
  geometry.setAttribute('aNext', new BufferAttribute(next, 2))
  geometry.setAttribute('aAlong', new BufferAttribute(along, 1))
  geometry.setIndex(new BufferAttribute(new Uint16Array(index), 1))
  return geometry
}

/** A texture of bytes, as they are: no colour space, no flip, no filtering unless asked. */
function byteTexture(data: Uint8Array, width: number, height: number, format: typeof RedFormat | typeof RGBAFormat): DataTexture {
  const texture = new DataTexture(data, width, height, format, UnsignedByteType)
  texture.colorSpace = NoColorSpace
  texture.flipY = false
  texture.unpackAlignment = 1
  texture.minFilter = NearestFilter
  texture.magFilter = NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

export function createEngine(canvas: HTMLCanvasElement, events: Events): Engine {
  const devicePixels = window.devicePixelRatio || 1
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      premultipliedAlpha: true,
      antialias: devicePixels < 1.5,
      depth: false,
      stencil: false,
      powerPreference: 'default',
    })
  } catch {
    events.onFail('webgl')
    throw new Error('The globe has no WebGL here.')
  }
  let failed = false
  const fail = (reason: 'webgl' | 'shader' | 'lost') => {
    if (failed) return
    failed = true
    events.onFail(reason)
  }
  renderer.debug.onShaderError = () => fail('shader')
  renderer.setClearColor(0x000000, 0)
  renderer.sortObjects = false
  const maxTexture = renderer.capabilities.maxTextureSize
  const tier = chooseTier(maxTexture)
  const ceiling = Math.min(devicePixels, tier === 'lite' ? 1.5 : 2)
  let ratio = ceiling
  renderer.setPixelRatio(ratio)

  const numbersSize = tier === 'lite' ? { width: 2048, height: 1024 } : { width: 4096, height: 2048 }

  // What every shader shares: the curl and the page.
  const shared: Uniforms = {
    uCurl: { value: 1 },
    uRadius: { value: 300 },
    uFaceLon: { value: 0 },
    uFaceLat: { value: 0 },
    uCentre: { value: new Vector2() },
    uViewport: { value: new Vector2(1, 1) },
    uPixelRatio: { value: ratio },
    uTilt: { value: 1 },
  }

  // The world's picture, the nation numbers, Azania's mask and the palette, each kept on the CPU too,
  // so a lost context can be given them all again.
  const sheet = new Texture()
  sheet.colorSpace = NoColorSpace
  sheet.flipY = false
  sheet.wrapS = RepeatWrapping
  sheet.wrapT = ClampToEdgeWrapping
  sheet.minFilter = LinearMipmapLinearFilter
  sheet.magFilter = LinearFilter
  sheet.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  let hasSheet = false

  const numbers = byteTexture(new Uint8Array(numbersSize.width * numbersSize.height), numbersSize.width, numbersSize.height, RedFormat)
  numbers.wrapS = RepeatWrapping
  numbers.wrapT = ClampToEdgeWrapping
  const mask = byteTexture(new Uint8Array(1024 * 512), 1024, 512, RedFormat)
  mask.wrapS = RepeatWrapping
  mask.wrapT = ClampToEdgeWrapping
  mask.minFilter = LinearMipmapLinearFilter
  mask.magFilter = LinearFilter
  mask.generateMipmaps = true
  const palette = byteTexture(new Uint8Array(PALETTE_BYTES), 256, 3, RGBAFormat)

  const groundUniforms: Uniforms = {
    ...shared,
    uShift: { value: 0 },
    uSheet: { value: sheet },
    uHasSheet: { value: 0 },
    uNumbers: { value: numbers },
    uNumbersSize: { value: new Vector2(numbersSize.width, numbersSize.height) },
    uAzania: { value: mask },
    uPalette: { value: palette },
    uOverlay: { value: 1 },
    uSelected: { value: -1 },
    uHover: { value: -1 },
    uFlatX0: { value: 0 },
    uSkirt: { value: 1 },
    uPole: {
      value: new Vector4(Math.cos(POLE.read.from), Math.cos(POLE.read.to), Math.cos(POLE.fade.from), Math.cos(POLE.fade.to)),
    },
    uPoleGrain: { value: POLE.grain },
    uPoleLevel: { value: 4 },
  }
  const material = (options: ConstructorParameters<typeof ShaderMaterial>[0]) =>
    new ShaderMaterial({
      glslVersion: GLSL3,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      premultipliedAlpha: true,
      blending: NormalBlending,
      toneMapped: false,
      ...options,
    })
  const front = material({ uniforms: groundUniforms, vertexShader: GROUND_VERTEX, fragmentShader: GROUND_FRAGMENT, side: FrontSide })
  // Drawn as the rest are, in order, though it is opaque: three.js would otherwise draw it ahead of the glow.
  const back = material({ uniforms: groundUniforms, vertexShader: GROUND_VERTEX, fragmentShader: BACK_FRAGMENT, side: BackSide })
  const glowUniforms: Uniforms = { ...shared, uGlow: { value: 1 } }
  // Either face: the square is laid out in the page's pixels, y down, which turns it over in clip space.
  const glowMaterial = material({ uniforms: glowUniforms, vertexShader: GLOW_VERTEX, fragmentShader: GLOW_FRAGMENT, side: DoubleSide })
  const pointUniforms: Uniforms = { ...shared, uMarks: { value: 1 }, uPulse: { value: 0 } }
  const pointMaterial = material({ uniforms: pointUniforms, vertexShader: POINTS_VERTEX, fragmentShader: POINTS_FRAGMENT })
  const reachUniforms: Uniforms = { ...shared, uReach: { value: 1 } }
  // Either face: the strip is laid across the line on the page, whichever way round the ring runs.
  const reachMaterial = material({ uniforms: reachUniforms, vertexShader: REACH_VERTEX, fragmentShader: REACH_FRAGMENT, side: DoubleSide })

  const ground = groundGeometry()
  const quad = quadGeometry()
  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const add = <T extends Mesh | Points>(object: T, order: number): T => {
    object.frustumCulled = false
    object.renderOrder = order
    scene.add(object)
    return object
  }
  add(new Mesh(quad, glowMaterial), 0)
  const backMesh = add(new Mesh(ground, back), 1)
  // The echoes: the same sheet and shader, a whole turn or two along, each with its own shift and fade.
  const skirtUniforms = SKIRTS.map((copy) => ({ ...groundUniforms, uShift: { value: copy * 2 * Math.PI }, uSkirt: { value: 1 } }))
  const skirtMaterials = skirtUniforms.map((uniforms) =>
    material({ uniforms, vertexShader: GROUND_VERTEX, fragmentShader: GROUND_FRAGMENT, side: FrontSide }),
  )
  const skirtMeshes = skirtMaterials.map((each) => add(new Mesh(ground, each), 2))
  add(new Mesh(ground, front), 3)
  const reach = add(new Mesh(new BufferGeometry(), reachMaterial), 4)
  reach.visible = false
  const marks: Record<MarkLayer, Points> = {
    base: add(new Points(new BufferGeometry(), pointMaterial), 5),
    players: add(new Points(new BufferGeometry(), pointMaterial), 6),
    sieges: add(new Points(new BufferGeometry(), pointMaterial), 7),
  }
  for (const points of Object.values(marks)) points.visible = false

  // Shaders compiled now, so one that's refused says so before the globe is shown.
  renderer.compile(scene, camera)

  // A lost context (the GPU reset, another tab took it) stops the drawing and waits; one that
  // doesn't come back soon, or is lost twice in a minute, gives up, and the flat map carries on.
  // Both count only while the page is in sight: a context given back only as the reader returns
  // to the tab still comes back in time, and a tab put away, which may lose its context each
  // time as a matter of course, is never taken for a GPU that keeps failing.
  let lost = false
  let lastLoss = -Infinity
  let waiting = 0
  const wait = () => {
    window.clearTimeout(waiting)
    waiting = lost && document.visibilityState === 'visible' ? window.setTimeout(() => fail('lost'), RESTORE_MS) : 0
  }
  const onLost = () => {
    lost = true
    if (!events.onLost()) return
    if (document.visibilityState === 'visible') {
      const now = performance.now()
      if (now - lastLoss < LOSSES_WITHIN_MS) return fail('lost')
      lastLoss = now
    }
    wait()
    document.addEventListener('visibilitychange', wait)
  }
  const onRestored = () => {
    lost = false
    document.removeEventListener('visibilitychange', wait)
    window.clearTimeout(waiting)
    for (const texture of [sheet, numbers, mask, palette]) texture.needsUpdate = true
    events.onRestored()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  let width = 1
  let height = 1
  let picture: Picture | null = null

  return {
    tier,
    numbers: numbersSize,
    resize: (w, h) => {
      width = Math.max(1, w)
      height = Math.max(1, h)
      renderer.setSize(width, height, false)
      ;(shared.uViewport.value as Vector2).set(width, height)
    },
    draw: (view, look) => {
      if (lost || failed) return
      const R = radiusAt(view.zoom)
      shared.uCurl.value = view.t
      shared.uRadius.value = R
      shared.uFaceLon.value = view.lon
      shared.uFaceLat.value = view.lat
      shared.uTilt.value = view.tilt ?? 1
      ;(shared.uCentre.value as Vector2).set(view.cx, view.cy)
      shared.uPixelRatio.value = ratio
      const coming = smoothstep(0, OVERLAY_BY, view.t)
      groundUniforms.uOverlay.value = look.overlay * coming
      groundUniforms.uSelected.value = look.selected
      groundUniforms.uHover.value = look.hover
      groundUniforms.uHasSheet.value = hasSheet ? look.sheet : 0
      groundUniforms.uFlatX0.value = look.flatX
      glowUniforms.uGlow.value = look.glow
      pointUniforms.uMarks.value = look.marks * coming
      pointUniforms.uPulse.value = look.pulse
      reachUniforms.uReach.value = look.overlay * coming
      // Curled all the way, no part of the sheet shows its underside.
      backMesh.visible = view.t < 0.999
      // An echo is drawn while the sheet is nearly flat, and only if, flat, it would reach the page.
      const fade = 1 - smoothstep(0, SKIRT_UNTIL - 0.05, view.t)
      SKIRTS.forEach((copy, i) => {
        const left = view.cx + R * (copy * 2 * Math.PI - Math.PI)
        const right = view.cx + R * (copy * 2 * Math.PI + Math.PI)
        skirtMeshes[i].visible = view.t < SKIRT_UNTIL && fade > 0.004 && right > 0 && left < width
        skirtUniforms[i].uSkirt.value = fade
      })
      renderer.render(scene, camera)
    },
    setPicture: (next) => {
      if (next === picture) return
      picture = next
      hasSheet = Boolean(next)
      if (!next) return
      // The mipmap whose rows are two and a half degrees each, 72 from pole to pole: the circles of latitude about the
      // North Pole take their own colours from it.
      const tall = next instanceof HTMLImageElement ? next.naturalHeight : next.height
      groundUniforms.uPoleLevel.value = Math.max(0, Math.log2(tall / 72))
      sheet.image = next
      sheet.needsUpdate = true
    },
    refreshPicture: () => {
      if (picture) sheet.needsUpdate = true
    },
    setNumbers: (next) => {
      if (next.width !== numbersSize.width || next.height !== numbersSize.height) return
      numbers.image.data = next.ids
      numbers.needsUpdate = true
    },
    setMask: (next, w, h) => {
      if (w !== 1024 || h !== 512) return
      mask.image.data = next
      mask.needsUpdate = true
    },
    setPalette: (bytes) => {
      palette.image.data = bytes
      palette.needsUpdate = true
    },
    setMarks: (layer, buffers) => {
      const points = marks[layer]
      points.geometry.dispose()
      points.geometry = buffers.count ? pointsGeometry(buffers) : new BufferGeometry()
      points.visible = buffers.count > 0
    },
    setReach: (ring) => {
      reach.geometry.dispose()
      reach.geometry = ring ? reachGeometry(ring) : new BufferGeometry()
      reach.visible = Boolean(ring)
    },
    pixelRatio: () => ratio,
    lost: () => lost,
    coarsen: () => {
      if (ratio <= 1) return false
      ratio = Math.max(1, ratio - 0.25)
      renderer.setPixelRatio(ratio)
      renderer.setSize(width, height, false)
      return true
    },
    dispose: () => {
      window.clearTimeout(waiting)
      document.removeEventListener('visibilitychange', wait)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      ground.dispose()
      quad.dispose()
      for (const points of Object.values(marks)) points.geometry.dispose()
      reach.geometry.dispose()
      for (const each of [front, back, glowMaterial, pointMaterial, reachMaterial, ...skirtMaterials]) each.dispose()
      for (const texture of [sheet, numbers, mask, palette]) texture.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
