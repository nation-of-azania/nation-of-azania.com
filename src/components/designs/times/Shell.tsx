import { TimesFooter } from '@/components/times/TimesFooter'
import { TimesNav } from '@/components/times/TimesNav'

import type { ShellProps } from '../types'

/**
 * Chrome for the Azanian Times (/times): cool newsprint ground, a cinnabar
 * and lagoon-teal palette, and the Archivo nameplate — the independent paper.
 */
export function Shell({ nav, children }: ShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-news-50 text-news-900">
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
