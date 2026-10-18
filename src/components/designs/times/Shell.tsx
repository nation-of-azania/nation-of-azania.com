import type { CSSProperties } from 'react'

import { TimesFooter } from '@/components/times/TimesFooter'
import { TimesNav } from '@/components/times/TimesNav'

import type { ShellProps } from '../types'

/**
 * The design's voice for pages that render inside the shell without knowing
 * it (the 404): its display face, title colour, accent and link colour.
 */
const VOICE = {
  '--design-display': 'var(--font-news)',
  '--design-weight': '900',
  '--design-ink': 'var(--color-news-900)',
  '--design-muted': 'var(--color-news-500)',
  '--design-accent': 'var(--color-cinnabar-700)',
  '--design-link': 'var(--color-cinnabar-700)',
} as CSSProperties

/**
 * Chrome for the Azanian Times (/times): cool newsprint ground, a cinnabar
 * and lagoon-teal palette, and the Archivo nameplate — the independent paper.
 */
export function Shell({ nav, children }: ShellProps) {
  return (
    <div style={VOICE} className="flex min-h-screen flex-col bg-news-50 text-news-900">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-cinnabar-800 focus:px-4 focus:py-2 focus:text-sm focus:text-news-50"
      >
        Skip to content
      </a>
      <TimesNav nav={nav} />
      <main id="content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <TimesFooter nav={nav} />
    </div>
  )
}
