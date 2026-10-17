import type { ReactNode } from 'react'

import { Footer } from '@/components/site/Footer'
import { Nav } from '@/components/site/Nav'

/**
 * Chrome for the government Gazette (/gov): the civic pine-and-parchment look,
 * with the national ribbon accents in the flag's maroon and gold.
 */
export default function GovLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-parchment-50 text-ink-900">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-pine-900 focus:px-4 focus:py-2 focus:text-sm focus:text-parchment-50"
      >
        Skip to content
      </a>
      <Nav />
      <main id="content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer />
    </div>
  )
}
