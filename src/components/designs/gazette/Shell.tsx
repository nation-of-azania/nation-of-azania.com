import { Footer } from '@/components/site/Footer'
import { Nav } from '@/components/site/Nav'

import type { ShellProps } from '../types'

/**
 * Chrome for the Gazette design (Government, /gov): the civic sea-and-sand
 * look, with the national ribbon in saffron and coral over the deep-water
 * masthead.
 */
export function Shell({ nav, children }: ShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-sand-50 text-ink-900">
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
