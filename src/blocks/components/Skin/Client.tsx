'use client'

import dynamic from 'next/dynamic'
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '../shared'
import type { SkinAnimation } from './Viewer'

/**
 * The viewer (skinview3d and its copy of three) is loaded lazily, only in
 * the browser, and only once the figure comes near the viewport. All
 * skinview3d imports live in ./Viewer — this module must never import it
 * directly.
 */
const Viewer = dynamic(() => import('./Viewer'), { ssr: false })

/** A still render of the whole player from the same service as the heads, for before and without WebGL. */
const STILL_WIDTH = 180
const STILL_HEIGHT = 432
const stillUrl = (name: string) => `https://mc-heads.net/body/${encodeURIComponent(name)}/${STILL_WIDTH}`

const hasWebGL = () => {
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'))
  } catch {
    return false
  }
}

type BoundaryProps = { children: ReactNode; onError: () => void }

/** A viewer that throws (a lost context, a bad texture) falls back to the still, never takes the page down. */
class ViewerBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

type Phase = 'failed' | 'live' | 'loading' | 'still'

type SkinClientProps = {
  animation: SkinAnimation
  /** Shown over the stage once the viewer is live, to say it can be turned. */
  hint: { className: string; text: string }
  name: string
}

/**
 * The stage of the Skin block: the still render first (server-rendered, so
 * it's there before hydration and stays wherever WebGL is missing), then the
 * live viewer faded in over it once the texture has loaded. Visitors who ask
 * for reduced motion get the still pose in the viewer, and can still turn it.
 */
export function SkinClient({ name, animation, hint }: SkinClientProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('still')
  const [motion, setMotion] = useState(false)

  useEffect(() => {
    if (!hasWebGL()) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const follow = () => setMotion(!reduced.matches)
    follow()
    reduced.addEventListener('change', follow)

    const stage = stageRef.current
    const near = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPhase((current) => (current === 'still' ? 'loading' : current))
          near.disconnect()
        }
      },
      { rootMargin: '320px' },
    )
    if (stage) near.observe(stage)

    return () => {
      reduced.removeEventListener('change', follow)
      near.disconnect()
    }
  }, [])

  const live = phase === 'live'

  return (
    <div className="absolute inset-0" ref={stageRef}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a third-party render at a fixed size; next/image would only proxy it */}
      <img
        alt=""
        className={cn(
          'pixelated absolute inset-0 m-auto h-full w-auto max-w-full object-contain transition-opacity duration-500',
          live && 'opacity-0',
        )}
        decoding="async"
        height={STILL_HEIGHT}
        loading="lazy"
        src={stillUrl(name)}
        width={STILL_WIDTH}
      />
      {phase === 'loading' || live ? (
        <ViewerBoundary onError={() => setPhase('failed')}>
          <Viewer
            animation={motion ? animation : 'still'}
            className={cn('absolute inset-0 transition-opacity duration-500', live ? 'opacity-100' : 'opacity-0')}
            name={name}
            onError={() => setPhase('failed')}
            onReady={() => setPhase('live')}
          />
        </ViewerBoundary>
      ) : null}
      {live ? (
        <span aria-hidden="true" className={cn('pointer-events-none absolute select-none', hint.className)}>
          {hint.text}
        </span>
      ) : null}
    </div>
  )
}
