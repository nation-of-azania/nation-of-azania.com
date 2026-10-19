'use client'

/**
 * The only Skin module that pulls in skinview3d (and, through it, its own
 * copy of three). Reached exclusively via `next/dynamic(..., { ssr: false })`
 * in ./Client.tsx, so it never runs on the server and never ships to a page
 * without a skin block.
 *
 * The texture comes from mc-heads.net, which serves raw skins with
 * `Access-Control-Allow-Origin: *`; skinview-utils requests it with
 * `crossOrigin = "anonymous"`, so WebGL may read the pixels.
 */
import { IdleAnimation, SkinViewer, WalkingAnimation, WaveAnimation, type PlayerAnimation } from 'skinview3d'
import { useEffect, useRef } from 'react'

import { cn } from '../shared'

export type SkinAnimation = 'idle' | 'still' | 'walk' | 'wave'

const skinUrl = (name: string) => `https://mc-heads.net/skin/${encodeURIComponent(name)}`

const ANIMATIONS: Record<Exclude<SkinAnimation, 'still'>, () => PlayerAnimation> = {
  idle: () => new IdleAnimation(),
  walk: () => {
    const walk = new WalkingAnimation()
    walk.speed = 0.7 // a stroll, not a march
    return walk
  },
  wave: () => new WaveAnimation(),
}

/** A three-quarter pose, the way a portrait is taken; the visitor turns it from there. */
const POSE_Y = -0.45

type ViewerProps = {
  animation: SkinAnimation
  className?: string
  name: string
  onError: () => void
  onReady: () => void
}

export default function Viewer({ name, animation, onReady, onError, className }: ViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<SkinViewer | null>(null)
  // The latest callbacks, so the viewer effect needn't rerun when a parent re-renders.
  const callbacks = useRef({ onError, onReady })
  useEffect(() => {
    callbacks.current = { onError, onReady }
  })

  // One viewer per player name, for the life of the canvas.
  useEffect(() => {
    const canvas = canvasRef.current
    const stage = canvas?.parentElement
    if (!canvas || !stage) return

    let viewer: SkinViewer
    try {
      viewer = new SkinViewer({
        canvas,
        width: stage.clientWidth,
        height: stage.clientHeight,
        fov: 40,
        zoom: 0.78,
        // Keep the last frame: the figure survives a page capture, and "Save image" works on it.
        preserveDrawingBuffer: true,
      })
    } catch {
      // No WebGL context: the still picture underneath stays.
      callbacks.current.onError()
      return
    }
    viewerRef.current = viewer
    viewer.controls.enableZoom = false
    viewer.controls.enablePan = false
    viewer.playerWrapper.rotation.y = POSE_Y
    // OrbitControls claims every touch; give vertical swipes back to the page
    // so the figure doesn't trap a reader scrolling past it on a phone.
    canvas.style.touchAction = 'pan-y'

    let disposed = false
    viewer
      .loadSkin(skinUrl(name), { model: 'auto-detect' })
      .then(() => {
        if (!disposed) callbacks.current.onReady()
      })
      .catch(() => {
        if (!disposed) callbacks.current.onError()
      })

    const resize = new ResizeObserver(() => {
      if (!viewer.disposed) viewer.setSize(stage.clientWidth, stage.clientHeight)
    })
    resize.observe(stage)
    // Off screen, stop drawing: no frames spent on a figure nobody is looking at.
    const visible = new IntersectionObserver(([entry]) => {
      if (!viewer.disposed) viewer.renderPaused = !entry.isIntersecting
    })
    visible.observe(stage)

    return () => {
      disposed = true
      resize.disconnect()
      visible.disconnect()
      viewer.dispose()
      viewerRef.current = null
    }
  }, [name])

  // The animation can change without rebuilding the viewer (a motion preference flipping, say).
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.disposed) return
    viewer.animation = animation === 'still' ? null : ANIMATIONS[animation]()
  }, [animation, name])

  return <canvas aria-hidden="true" className={cn('block h-full w-full', className)} ref={canvasRef} />
}
