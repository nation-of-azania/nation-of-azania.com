'use client'

import dynamic from 'next/dynamic'
import { Component, type ReactNode } from 'react'

import type { Media } from '@/payload-types'

import { cn } from '../shared'

/**
 * The three.js scene is loaded lazily and only in the browser. All
 * three/@react-three imports live in ./Scene — this module must never
 * import them directly.
 */
const Scene = dynamic(() => import('./Scene'), {
  loading: () => <ExhibitPlaceholder message={'Preparing exhibit…'} />,
  ssr: false,
})

function ExhibitPlaceholder({ message, pulse = true }: { message: string; pulse?: boolean }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <p
        className={cn(
          'font-display text-sm tracking-[0.18em] text-ink-400 uppercase',
          pulse && 'animate-pulse',
        )}
      >
        {message}
      </p>
    </div>
  )
}

type BoundaryProps = {
  children: ReactNode
  fallback: ReactNode
}

/** Minimal error boundary so a broken .glb (or missing WebGL) never takes down the page. */
class SceneBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

type Model3DClientProps = {
  autoRotate: boolean
  label: string
  model?: Media | null | number
}

/**
 * Resolves the .glb URL from the model field (populated Media object with a
 * url → use it; bare ID or missing → null, which renders the built-in
 * placeholder monument). Failure ladder: real model → placeholder scene →
 * static text, so the block always renders something.
 */
export function Model3DClient({ model, autoRotate, label }: Model3DClientProps) {
  const url =
    model && typeof model === 'object' && typeof model.url === 'string' && model.url.length > 0
      ? model.url
      : null

  return (
    <div aria-label={label} className="absolute inset-0" role="img">
      <SceneBoundary fallback={<ExhibitPlaceholder message="Exhibit unavailable" pulse={false} />}>
        {url ? (
          <SceneBoundary fallback={<Scene autoRotate={autoRotate} url={null} />}>
            <Scene autoRotate={autoRotate} url={url} />
          </SceneBoundary>
        ) : (
          <Scene autoRotate={autoRotate} url={null} />
        )}
      </SceneBoundary>
    </div>
  )
}
