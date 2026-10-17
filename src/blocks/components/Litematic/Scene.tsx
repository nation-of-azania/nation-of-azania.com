'use client'

/**
 * The only Litematic module that pulls in the WebGL renderer. Reached
 * exclusively via `next/dynamic(..., { ssr: false })` in ./Client.tsx, so
 * nothing here runs on the server or ships to pages without a litematic block.
 *
 * Rendering is delegated to DeepSlate (misode/deepslate, MIT), which consumes
 * Mojang's own blockstate + model JSON and a texture atlas to draw faithful
 * block SHAPES and real TEXTURES — no hand-authored geometry. We keep our own
 * parser (parse.ts → structure.ts) and supply the vanilla assets fetched into
 * public/litematic/ (resources.ts). This file owns only the GL lifecycle: a raw
 * canvas, an orbit camera (gl-matrix), the render loop, and teardown.
 */
import { StructureRenderer } from 'deepslate'
import { mat4 } from 'gl-matrix'
import { useEffect, useRef, useState } from 'react'

import { parseLitematic, SchematicTooLargeError } from '@/lib/litematic/parse'

import { cn } from '../shared'
import { bakeAmbientOcclusion, fixAtlasFilter } from './deepslate/ambientOcclusion'
import { loadDeepslateResources } from './deepslate/resources'
import { litematicToStructure } from './deepslate/structure'
import { installSharpTextureShader } from './deepslate/textureShader'

type SceneProps = {
  autoRotate: boolean
  url: null | string
}

type Status = 'empty' | 'error' | 'loading' | 'ready' | 'toobig'

/**
 * Face count is ~6× the block count with our no-cull setup; past this we bail to
 * a friendly message rather than freeze the tab building millions of faces.
 */
const MAX_BLOCKS = 200_000

/** DeepSlate's internal perspective FOV (degrees) — used to frame the build. */
const FOV = 70
/** Pleasant default three-quarter view; both are easy to tweak. */
const DEFAULT_YAW = -Math.PI / 4
const DEFAULT_PITCH = 0.42
/** Idle spin speed (radians/frame) — gentle. */
const AUTO_ROTATE_SPEED = 0.00075
/** Per-frame easing of the camera toward its target — a light touch of smoothing. */
const CAMERA_SMOOTHING = 0.3
/** Ambient-occlusion strength (0 = off, 1 = strong corner darkening). */
const AO_STRENGTH = 0.55
/**
 * Render resolution as a multiple of the CSS size — a fixed factor rather than
 * the device pixel ratio, so the build is reliably crisp on every display
 * (native resolution looks soft, badly so on 1x screens). Supersampling here is
 * for overall sharpness and geometry antialiasing (alongside MSAA); the
 * block-edge texture shimmer is handled separately by the antialiased-nearest
 * shader (see textureShader.ts), not by resolution. We render at least MIN× and
 * never above MAX×; capped by MAX_RENDER_DIM so a large or hi-dpi embed never
 * over-allocates.
 */
const MIN_RENDER_SCALE = 3
const MAX_RENDER_SCALE = 4
const MAX_RENDER_DIM = 3000

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

type Camera = {
  distance: number
  pitch: number
  targetDistance: number
  targetPitch: number
  targetYaw: number
  yaw: number
}

/** Shared pointer state the render loop reads to gate auto-rotate. */
type PointerState = { dragging: boolean; hovering: boolean }

/**
 * Drag-to-rotate + wheel-zoom. Updates the camera's TARGET angles/distance; the
 * render loop eases the actual camera toward them (see CAMERA_SMOOTHING). Also
 * tracks hover/drag so the loop can pause the idle spin while the pointer is on
 * the canvas. Returns a teardown that removes every listener.
 */
function attachControls(
  canvas: HTMLCanvasElement,
  camera: Camera,
  input: PointerState,
  zoom: { max: number; min: number },
  onChange: () => void,
): () => void {
  let lastX = 0
  let lastY = 0

  const down = (e: PointerEvent) => {
    input.dragging = true
    lastX = e.clientX
    lastY = e.clientY
    canvas.setPointerCapture(e.pointerId)
  }
  const move = (e: PointerEvent) => {
    if (!input.dragging) return
    camera.targetYaw += (e.clientX - lastX) * 0.008
    camera.targetPitch = clamp(camera.targetPitch + (e.clientY - lastY) * 0.008, -1.5, 1.5)
    lastX = e.clientX
    lastY = e.clientY
    onChange()
  }
  const up = (e: PointerEvent) => {
    input.dragging = false
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
  }
  const wheel = (e: WheelEvent) => {
    e.preventDefault()
    camera.targetDistance = clamp(camera.targetDistance * Math.exp(e.deltaY * 0.001), zoom.min, zoom.max)
    onChange()
  }
  const enter = () => {
    input.hovering = true
  }
  const leave = () => {
    input.hovering = false
  }

  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  canvas.addEventListener('pointerenter', enter)
  canvas.addEventListener('pointerleave', leave)
  canvas.addEventListener('wheel', wheel, { passive: false })

  return () => {
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', up)
    canvas.removeEventListener('pointerenter', enter)
    canvas.removeEventListener('pointerleave', leave)
    canvas.removeEventListener('wheel', wheel)
  }
}

function Overlay({ status }: { status: Exclude<Status, 'ready'> }) {
  const message =
    status === 'loading'
      ? 'Preparing build…'
      : status === 'empty'
        ? 'No build to display'
        : status === 'toobig'
          ? 'Build too large to preview'
          : 'Build unavailable'
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <p
        className={cn(
          'font-display text-sm tracking-[0.18em] text-ink-400 uppercase',
          status === 'loading' && 'animate-pulse',
        )}
      >
        {message}
      </p>
    </div>
  )
}

export default function Scene({ autoRotate, url }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<Status>(url ? 'loading' : 'empty')

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!url || !canvas || !container) {
      setStatus(url ? 'loading' : 'empty')
      return
    }

    let cancelled = false
    let raf = 0
    let ro: null | ResizeObserver = null
    let detachControls: (() => void) | null = null

    setStatus('loading')

    const run = async () => {
      let model: Awaited<ReturnType<typeof parseLitematic>>
      let resources: Awaited<ReturnType<typeof loadDeepslateResources>>
      try {
        ;[resources, model] = await Promise.all([
          loadDeepslateResources(),
          fetch(url)
            .then((r) => {
              if (!r.ok) throw new Error(`Failed to load schematic (${r.status})`)
              return r.arrayBuffer()
            })
            .then(parseLitematic),
        ])
      } catch (err) {
        if (!cancelled) setStatus(err instanceof SchematicTooLargeError ? 'toobig' : 'error')
        return
      }
      if (cancelled) return
      if (model.blockCount === 0) {
        setStatus('empty')
        return
      }
      if (model.blockCount > MAX_BLOCKS) {
        setStatus('toobig')
        return
      }

      const gl = canvas.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true })
      if (!gl) {
        setStatus('error')
        return
      }

      let renderer: StructureRenderer
      let center: [number, number, number]
      let radius: number
      try {
        const built = litematicToStructure(model)
        // useInvisibleBlockBuffer:false is essential, not cosmetic: with it on
        // (DeepSlate's default) the renderer's constructor sweeps EVERY voxel of
        // the bounding box and builds a wireframe line-cube per air voxel — an
        // O(volume) allocation of Line/Vertex objects that OOMs the tab on a
        // large, mostly-air build. We only ever call drawStructure(), never
        // drawInvisibleBlocks(), so that debug mesh is pure waste. Off, the
        // renderer's cost tracks the non-air block count instead of the volume.
        renderer = new StructureRenderer(gl, built.structure, resources, {
          chunkSize: 16,
          useInvisibleBlockBuffer: false,
        })
        // Prefer the antialiased-nearest shader (crisp AND crawl-free); if the
        // GPU lacks derivatives, fall back to plain mipmapped filtering.
        const atlas = resources.getTextureAtlas()
        if (!installSharpTextureShader(renderer, gl, [atlas.width, atlas.height])) {
          fixAtlasFilter(renderer, gl)
        }
        bakeAmbientOcclusion(renderer, built.structure, gl, AO_STRENGTH)
        center = built.center
        radius = built.radius
      } catch {
        if (!cancelled) setStatus('error')
        return
      }
      if (cancelled) return

      const fitDistance = (radius / Math.sin(((FOV / 2) * Math.PI) / 180)) * 1.05
      const camera: Camera = {
        distance: fitDistance,
        pitch: DEFAULT_PITCH,
        targetDistance: fitDistance,
        targetPitch: DEFAULT_PITCH,
        targetYaw: DEFAULT_YAW,
        yaw: DEFAULT_YAW,
      }
      const input: PointerState = { dragging: false, hovering: false }
      const zoom = { max: radius * 12, min: radius * 0.35 }
      let dirty = true

      const resize = () => {
        const w = container.clientWidth
        const h = container.clientHeight
        if (w === 0 || h === 0) return
        const scale = Math.min(Math.max(window.devicePixelRatio || 1, MIN_RENDER_SCALE), MAX_RENDER_SCALE)
        let rw = Math.round(w * scale)
        let rh = Math.round(h * scale)
        const over = Math.max(rw, rh) / MAX_RENDER_DIM
        if (over > 1) {
          rw = Math.round(rw / over)
          rh = Math.round(rh / over)
        }
        canvas.width = rw
        canvas.height = rh
        renderer.setViewport(0, 0, rw, rh)
        dirty = true
      }
      ro = new ResizeObserver(resize)
      ro.observe(container)
      resize()

      detachControls = attachControls(canvas, camera, input, zoom, () => {
        dirty = true
      })

      const draw = () => {
        const view = mat4.create()
        mat4.translate(view, view, [0, 0, -camera.distance])
        mat4.rotateX(view, view, camera.pitch)
        mat4.rotateY(view, view, camera.yaw)
        mat4.translate(view, view, [-center[0], -center[1], -center[2]])
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        renderer.drawStructure(view)
      }

      const loop = () => {
        if (cancelled) return
        // Idle spin only while the pointer isn't on the canvas ("out of focus").
        const spinning = autoRotate && !input.hovering && !input.dragging
        if (spinning) camera.targetYaw += AUTO_ROTATE_SPEED
        const dyaw = camera.targetYaw - camera.yaw
        const dpitch = camera.targetPitch - camera.pitch
        const ddist = camera.targetDistance - camera.distance
        const easing = Math.abs(dyaw) > 1e-4 || Math.abs(dpitch) > 1e-4 || Math.abs(ddist) > 1e-4
        if (dirty || spinning || easing) {
          camera.yaw += dyaw * CAMERA_SMOOTHING
          camera.pitch += dpitch * CAMERA_SMOOTHING
          camera.distance += ddist * CAMERA_SMOOTHING
          draw()
          dirty = false
        }
        raf = requestAnimationFrame(loop)
      }

      setStatus('ready')
      draw() // one synchronous frame so the build shows even if rAF is throttled
      raf = requestAnimationFrame(loop)
    }

    void run()

    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      ro?.disconnect()
      detachControls?.()
    }
  }, [url, autoRotate])

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas className="block h-full w-full" ref={canvasRef} style={{ touchAction: 'none' }} />
      {status !== 'ready' && <Overlay status={status} />}
    </div>
  )
}
