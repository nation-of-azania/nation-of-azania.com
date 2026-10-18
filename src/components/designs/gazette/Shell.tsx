import type { CSSProperties } from 'react'

import { Footer } from '@/components/site/Footer'
import { Nav } from '@/components/site/Nav'

import type { ShellProps } from '../types'

/**
 * The design's voice for pages that render inside the shell without knowing
 * it (the 404): its display face, title colour, accent and link colour.
 */
const VOICE = {
  '--design-display': 'var(--font-display)',
  '--design-weight': '400',
  '--design-ink': 'var(--color-sea-950)',
  '--design-muted': 'var(--color-ink-500)',
  '--design-accent': 'var(--color-saffron-600)',
  '--design-link': 'var(--color-sea-700)',
} as CSSProperties

/**
 * Chrome for the Gazette design (Government, /gov): the civic sea-and-sand
 * look, with the national ribbon in saffron and coral over the deep-water
 * masthead.
 */
export function Shell({ nav, children }: ShellProps) {
  return (
    <div style={VOICE} className="flex min-h-screen flex-col bg-sand-50 text-ink-900">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-sea-900 focus:px-4 focus:py-2 focus:text-sm focus:text-sand-50"
      >
        Skip to content
      </a>
      <Nav nav={nav} />
      <main id="content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer nav={nav} />
    </div>
  )
}
