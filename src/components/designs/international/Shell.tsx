import type { CSSProperties } from 'react'

import { IntlFooter } from '@/components/intl/IntlFooter'
import { IntlNav } from '@/components/intl/IntlNav'
import { slotVars } from '@/components/styles/slots'

import type { ShellProps } from '../types'

/**
 * The design's voice for pages that render inside the shell without knowing
 * it (the 404): its display face, title colour, accent and link colour.
 */
const VOICE = {
  '--design-display': 'var(--font-record)',
  '--design-weight': '500',
  '--design-ink': 'var(--color-graphite-900)',
  '--design-muted': 'var(--color-graphite-500)',
  '--design-accent': 'var(--color-verdigris-700)',
  '--design-link': 'var(--color-verdigris-700)',
} as CSSProperties

/**
 * Chrome for the International design (/intl): cool registry paper and
 * graphite ink, verdigris for links and rules, the record serif and its
 * mono for numbers — the neutral ground of several nations, hosted by
 * Azania and carrying none of its branding. Its accent slots (the registry's
 * slate) are set here; no style has an International variant yet.
 */
export function Shell({ nav, children }: ShellProps) {
  return (
    <div
      style={{ ...VOICE, ...slotVars('international') }}
      className="flex min-h-screen flex-col bg-paper-50 text-graphite-900"
    >
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-graphite-900 focus:px-4 focus:py-2 focus:text-sm focus:text-paper-50"
      >
        Skip to content
      </a>
      <IntlNav nav={nav} />
      <main id="content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <IntlFooter nav={nav} />
    </div>
  )
}
