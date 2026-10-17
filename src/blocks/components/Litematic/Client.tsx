'use client'

import dynamic from 'next/dynamic'
import { Component, type ReactNode } from 'react'

import type { Media } from '@/payload-types'

import { cn } from '../shared'

/**
 * The three.js scene (and the .litematic parser it pulls in) is loaded lazily
 * and only in the browser. All three/@react-three imports live in ./Scene —
 * this module must never import them directly.
 */
const Scene = dynamic(() => import('./Scene'), {
  loading: () => <ExhibitPlaceholder message={'Preparing build…'} />,
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

/** Minimal error boundary so a broken schematic (or missing WebGL) never takes down the page. */
class SceneBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

type LitematicClientProps = {
  autoRotate: boolean
  label: string
  schematic?: Media | null | number
}

/**
 * Resolves the .litematic URL from the schematic field (populated Media doc
 * with a url → use it; bare ID or missing → null, which renders an empty
 * placeholder). Failure ladder: real build → placeholder → static text, so the
 * block always renders something.
 */
export function LitematicClient({ schematic, autoRotate, label }: LitematicClientProps) {
  const url =
    schematic &&
    typeof schematic === 'object' &&
    typeof schematic.url === 'string' &&
    schematic.url.length > 0
      ? schematic.url
      : null

  return (
    <div aria-label={label} className="absolute inset-0" role="img">
      <SceneBoundary fallback={<ExhibitPlaceholder message="Build unavailable" pulse={false} />}>
        <Scene autoRotate={autoRotate} url={url} />
      </SceneBoundary>
    </div>
  )
}
