import type { ReactNode } from 'react'

import { TimesFooter } from '@/components/times/TimesFooter'
import { TimesNav } from '@/components/times/TimesNav'

/**
 * Chrome for the Condor Times (/times): a warm news ground, maroon-and-gold
 * flag palette, and the Archivo nameplate — the independent digital paper.
 */
export default function TimesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-news-50 text-news-900">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-maroon-800 focus:px-4 focus:py-2 focus:text-sm focus:text-news-50"
      >
        Skip to content
      </a>
      <TimesNav />
      <main id="content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <TimesFooter />
    </div>
  )
}
